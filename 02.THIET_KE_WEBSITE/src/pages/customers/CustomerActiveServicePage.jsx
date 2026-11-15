import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  FileText,
  ImagePlus,
  Info,
  MessageCircleCheck,
  PenLine,
  Trash2,
} from 'lucide-react';
import Button from '../../components/ui/Button.jsx';
import DataTable from '../../components/ui/DataTable.jsx';
import Modal from '../../components/ui/Modal.jsx';
import FeedbackDialog from '../../components/ui/FeedbackDialog.jsx';
import { useFeedback } from '../../components/ui/FeedbackContext.jsx';
import PageHeader from '../../components/ui/PageHeader.jsx';
import StatusBadge from '../../components/ui/StatusBadge.jsx';
import TreatmentReportModal from '../../components/reports/TreatmentReportModal.jsx';
import { apiRequest } from '../../api.js';
import { formatCurrency } from '../../data/mockData.js';
import { dateTimeLabel } from '../../utils/treatmentReport.js';

const acceptedImageTypes = ['image/png', 'image/jpeg'];

function makeId() {
  return globalThis.crypto?.randomUUID?.() ?? `img-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function toISODate(value) {
  if (!value) return '';
  if (value instanceof Date && !Number.isNaN(value.valueOf())) return value.toISOString().slice(0, 10);
  const text = String(value);
  const iso = text.match(/^(\d{4}-\d{2}-\d{2})/);
  if (iso) return iso[1];
  const local = text.match(/^(\d{2})\/(\d{2})\/(\d{2}|\d{4})$/);
  if (local) return (local[3].length === 2 ? '20' + local[3] : local[3]) + '-' + local[2] + '-' + local[1];
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10);
}

function formatDateInput(value) {
  const iso = toISODate(value);
  if (!iso) return '';
  const [year, month, day] = iso.split('-');
  return day + '/' + month + '/' + year.slice(-2);
}

function parseDateInput(value) {
  const match = String(value || '').trim().match(/^(\d{2})\/(\d{2})\/(\d{2})$/);
  if (!match) return '';
  const [, day, month, shortYear] = match;
  const year = '20' + shortYear;
  const date = new Date(year + '-' + month + '-' + day + 'T00:00:00Z');
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === year + '-' + month + '-' + day ? year + '-' + month + '-' + day : '';
}

function dateLabel(value) {
  return formatDateInput(value) || '--';
}

function validatePackageEdit(values) {
  const errors = {};
  if (!['Chưa thanh toán', 'Đã thanh toán'].includes(values.paymentStatus)) errors.paymentStatus = 'Chọn trạng thái thanh toán hợp lệ.';
  if (String(values.note ?? '').length > 255) errors.note = 'Ghi chú tối đa 255 ký tự.';
  if (String(values.summaryFile ?? '').length > 255) errors.summaryFile = 'Đường dẫn tệp tối đa 255 ký tự.';
  return errors;
}

function toDateTimeLocal(value) {
  return value ? String(value).replace(' ', 'T').slice(0, 16) : '';
}

function showApiError(notify, error, fallback) {
  if (error?.isServerError || error?.code === 'NETWORK_ERROR') return;
  notify(error?.message || fallback, 'error');
}

function parseProducts(value) {
  if (!value) return [];
  let parsed = value;
  if (typeof parsed === 'string') {
    try { parsed = JSON.parse(parsed); } catch { return [{ name: parsed, amount: '—' }]; }
  }
  const rows = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.products) ? parsed.products : [];
  return rows.map((product) => ({
    name: product.name ?? product.tenMyPham ?? product.productName ?? 'Mỹ phẩm',
    amount: product.amount ?? product.dinhLuong ?? product.quantity ?? '—',
  }));
}

function normalizePackage(record, customer) {
  const sessions = (record.sessions ?? []).map((session, index) => ({
    id: session.id,
    number: index + 1,
    name: session.name || `Buổi ${index + 1}`,
    status: session.status || 'Chưa thực hiện',
    customerConfirmation: session.customerConfirmation || 'Chưa xác nhận',
    date: dateLabel(session.performedAt),
    performedAtValue: toDateTimeLocal(session.performedAt),
    duration: Number(session.durationMinutes) || 0,
    employee: session.staffName || '',
    result: session.result || '',
    notes: session.note || '',
    techniques: session.technique ? [session.technique] : [],
    products: parseProducts(session.cosmeticsUsage),
    beforeImages: [],
    afterImages: session.image ? [{ id: `sql-${session.id}`, name: 'Ảnh tình trạng', dataUrl: session.image, persisted: true }] : [],
  }));
  return {
    id: record.id,
    customerId: record.customerId || customer.id,
    customerName: record.customerName || customer.name,
    customerPhone: record.customerPhone || customer.phone,
    name: record.serviceName || 'Dịch vụ',
    purchaseOrder: record.id,
    price: Number(record.purchasePrice) || 0,
    purchaseDate: dateLabel(record.purchaseDate),
    purchaseDateValue: toISODate(record.purchaseDate),
    paymentStatus: record.paymentStatus || '—',
    note: record.note || '',
    summaryFile: record.summaryFile || '',
    status: record.completionStatus || 'Chưa thực hiện',
    totalSessions: Number(record.totalSessions) || sessions.length,
    sessions,
  };
}

function completedSessionCount(sessions) {
  return sessions.filter((session) => ['Đã hoàn thành', 'Chờ xác nhận'].includes(session.status)).length;
}

function statusTone(status) {
  if (status === 'Đã hoàn thành' || status === 'Hoàn thành' || status === 'Đã thanh toán') return 'success';
  if (status === 'Chờ xác nhận' || status === 'Chưa xác nhận') return 'warning';
  if (status === 'Đang thực hiện') return 'progress';
  if (status === 'Chưa thực hiện') return 'neutral';
  return 'info';
}

function compressImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Không đọc được tệp hình ảnh.'));
    reader.onload = () => {
      const image = new Image();
      image.onerror = () => reject(new Error('Tệp không phải là hình ảnh hợp lệ.'));
      image.onload = () => {
        const scale = Math.min(1, 1800 / Math.max(image.naturalWidth, image.naturalHeight));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
        canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
        const context = canvas.getContext('2d');
        if (!context) {
          reject(new Error('Trình duyệt không thể xử lý hình ảnh này.'));
          return;
        }
        context.fillStyle = '#ffffff';
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.86));
      };
      image.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

export default function CustomerActiveServicePage({ customer, packageId: requestedPackageId, onBack, fallbackPath }) {
  const packageId = requestedPackageId || customer.activeServices?.[0]?.id;
  const [usage, setUsage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [selectedSessionNumber, setSelectedSessionNumber] = useState(null);
  const [lightbox, setLightbox] = useState(null);
  const [reportOpen, setReportOpen] = useState(false);
  const [resultMissingOpen, setResultMissingOpen] = useState(false);
  const [resultDraft, setResultDraft] = useState('');
  const [editingResult, setEditingResult] = useState(false);
  const [editValues, setEditValues] = useState(null);
  const [editErrors, setEditErrors] = useState({});
  const [editingDetails, setEditingDetails] = useState(false);
  const [editingSession, setEditingSession] = useState(false);
  const [sessionEditDraft, setSessionEditDraft] = useState(null);
  const [sessionEditErrors, setSessionEditErrors] = useState({});
  const [savingDetails, setSavingDetails] = useState(false);
  const [simulatingConfirmation, setSimulatingConfirmation] = useState(false);
  const { notify, showDialog } = useFeedback();
  const sessionInputRefs = useRef({});
  const simulationEnabled = import.meta.env.VITE_ENABLE_ZALO_SIMULATION === 'true';

  const selectedSession = usage?.sessions.find((session) => session.number === selectedSessionNumber) ?? null;
  const completedCount = completedSessionCount(usage?.sessions ?? []);
  const remainingCount = Math.max(0, (usage?.totalSessions ?? 0) - completedCount);
  const serviceStatus = usage?.status || 'Chưa thực hiện';
  const lightboxImages = useMemo(() => {
    if (!lightbox) return [];
    const session = usage?.sessions.find((item) => item.number === lightbox.sessionNumber);
    return session?.[lightbox.side] ?? [];
  }, [lightbox, usage?.sessions]);
  const activeLightboxImage = lightboxImages[lightbox?.index ?? -1] ?? null;

  useEffect(() => {
    let active = true;
    setLoading(true);
    setLoadError('');
    setUsage(null);
    setEditingDetails(false);
    setEditingSession(false);
    setSessionEditDraft(null);
    setEditValues(null);
    setEditErrors({});
    setSelectedSessionNumber(null);
    setLightbox(null);
    if (!packageId) {
      setLoadError('Khách hàng chưa có mã liệu trình để tải.');
      setLoading(false);
      return () => { active = false; };
    }
    apiRequest(`/api/service-packages/${encodeURIComponent(packageId)}`)
      .then((record) => { if (active) setUsage(normalizePackage(record, customer)); })
      .catch((error) => { if (active) setLoadError(error.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [customer, packageId]);

  const refreshUsage = async () => {
    const record = await apiRequest(`/api/service-packages/${encodeURIComponent(packageId)}`);
    const next = normalizePackage(record, customer);
    setUsage(next);
    return next;
  };

  const initialEditValues = () => ({
    paymentStatus: usage?.paymentStatus || '',
    note: usage?.note || '',
    summaryFile: usage?.summaryFile || '',
  });

  const beginEditing = () => {
    setEditValues(initialEditValues());
    setEditErrors({});
    setEditingDetails(true);
  };

  const changeEditValue = (field, value) => {
    const next = { ...editValues, [field]: value };
    setEditValues(next);
    setEditErrors(validatePackageEdit(next));
  };

  const cancelEditing = () => {
    if (JSON.stringify(editValues) === JSON.stringify(initialEditValues())) {
      setEditingDetails(false);
      setEditErrors({});
      return;
    }
    showDialog({
      tone: 'warning',
      title: 'Xác nhận hủy chỉnh sửa',
      message: 'Các thay đổi sẽ không được lưu. Bạn có chắc chắn muốn hủy?',
      actions: [
        { label: 'Quay lại', variant: 'secondary', onClick: () => {} },
        { label: 'Xác nhận', onClick: () => { setEditingDetails(false); setEditValues(null); setEditErrors({}); } },
      ],
    });
  };

  const savePackageDetails = async () => {
    if (!editValues) return;
    const errors = validatePackageEdit(editValues);
    setEditErrors(errors);
    if (Object.keys(errors).length) return;
    setSavingDetails(true);
    try {
      await apiRequest('/api/service-packages/' + encodeURIComponent(packageId), {
        method: 'PUT',
        body: {
          paymentStatus: editValues.paymentStatus,
          note: editValues.note || null,
          summaryFile: editValues.summaryFile || null,
        },
      });
      await refreshUsage();
      setEditingDetails(false);
      setEditValues(null);
      setEditErrors({});
      showDialog({ tone: 'success', title: 'Cập nhật thành công', message: 'Thông tin dịch vụ sau cập nhật đã được lưu', closeLabel: 'Đóng' });
    } catch (error) {
      const apiErrors = Object.fromEntries((error.fieldErrors || []).map((item) => [item.field, item.message]));
      setEditErrors(apiErrors);
      showApiError(notify, error, 'Không thể cập nhật thông tin liệu trình.');
    } finally {
      setSavingDetails(false);
    }
  };

  const beginSessionEditing = () => {
    if (!selectedSession) return;
    setEditingResult(false);
    setSessionEditDraft({
      performedAt: selectedSession.performedAtValue,
      result: selectedSession.result || '',
      status: selectedSession.status,
      customerConfirmation: selectedSession.customerConfirmation,
      image: selectedSession.afterImages.find((item) => item.persisted)?.dataUrl || '',
      note: selectedSession.notes || '',
    });
    setSessionEditErrors({});
    setEditingSession(true);
  };

  const saveSessionDetails = async () => {
    if (!selectedSession || !sessionEditDraft) return;
    const errors = {};
    if (!['Chưa thực hiện', 'Đang thực hiện', 'Chờ xác nhận', 'Đã hoàn thành'].includes(sessionEditDraft.status)) errors.status = 'Chọn trạng thái thực hiện hợp lệ.';
    if (!['Chưa xác nhận', 'Đã xác nhận'].includes(sessionEditDraft.customerConfirmation)) errors.customerConfirmation = 'Chọn trạng thái xác nhận hợp lệ.';
    if (sessionEditDraft.result.length > 255) errors.result = 'Kết quả tối đa 255 ký tự.';
    if (sessionEditDraft.image.length > 255) errors.image = 'Đường dẫn ảnh tối đa 255 ký tự.';
    if (sessionEditDraft.note.length > 255) errors.note = 'Ghi chú tối đa 255 ký tự.';
    setSessionEditErrors(errors);
    if (Object.keys(errors).length) return;
    setSavingDetails(true);
    try {
      await apiRequest(`/api/service-packages/${encodeURIComponent(packageId)}/sessions/${encodeURIComponent(selectedSession.id)}`, {
        method: 'PUT',
        body: {
          // datetime-local is already in the user's local wall-clock time. Keep that
          // value when sending timestamp-without-time-zone to PostgreSQL.
          performedAt: sessionEditDraft.performedAt ? `${sessionEditDraft.performedAt.replace('T', ' ')}:00` : null,
          result: sessionEditDraft.result || null,
          status: sessionEditDraft.status,
          customerConfirmation: sessionEditDraft.customerConfirmation,
          image: sessionEditDraft.image || null,
          note: sessionEditDraft.note || null,
        },
      });
      await refreshUsage();
      setEditingSession(false);
      setSessionEditDraft(null);
      showDialog({ tone: 'success', title: 'Cập nhật thành công', message: 'Thông tin buổi dịch vụ đã được lưu.', closeLabel: 'Đóng' });
    } catch (error) {
      const apiErrors = Object.fromEntries((error.fieldErrors || []).map((item) => [item.field, item.message]));
      setSessionEditErrors(apiErrors);
      showApiError(notify, error, 'Không thể cập nhật buổi dịch vụ.');
    } finally { setSavingDetails(false); }
  };

  const simulateCustomerConfirmation = async () => {
    if (!selectedSession || simulatingConfirmation) return;
    setSimulatingConfirmation(true);
    try {
      await apiRequest('/api/dev/simulate-zalo-session-confirmed', {
        method: 'POST', body: { packageId, sessionId: selectedSession.id },
      });
      await refreshUsage();
      notify('Khách hàng đã xác nhận.', 'success');
    } catch (error) {
      showApiError(notify, error, 'Không thể cập nhật xác nhận khách hàng.');
    } finally {
      setSimulatingConfirmation(false);
    }
  };

  const updateSession = (sessionNumber, updates) => setUsage((current) => ({
    ...current,
    sessions: current.sessions.map((session) => session.number === sessionNumber
      ? { ...session, ...updates }
      : session),
  }));

  const openSession = (session) => {
    setSelectedSessionNumber(session.number);
    setResultDraft(session.result || '');
    setEditingResult(false);
  };

  const startSession = async () => {
    if (!selectedSession) return;
    try {
      await apiRequest(`/api/service-packages/${encodeURIComponent(packageId)}/sessions/${encodeURIComponent(selectedSession.id)}/start`, { method: 'POST', body: {} });
      await refreshUsage();
      notify('Đã bắt đầu buổi và lưu trạng thái vào SQL.', 'success');
    } catch (error) {
      notify(error.message || 'Không thể bắt đầu buổi.', 'error');
    }
  };

  const completeSession = async () => {
    if (!selectedSession) return;
    if (!resultDraft.trim()) { setResultMissingOpen(true); return; }
    try {
      await apiRequest(`/api/service-packages/${encodeURIComponent(packageId)}/sessions/${encodeURIComponent(selectedSession.id)}/complete`, {
        method: 'POST', body: { result: resultDraft.trim() },
      });
      await refreshUsage();
      notify('Đã lưu kết quả và trạng thái buổi vào SQL.', 'success');
    } catch (error) {
      notify(error.message || 'Không thể hoàn tất buổi.', 'error');
    }
  };

  const openLightbox = (index, sessionNumber, side) => setLightbox({ index, sessionNumber, side });

  const moveLightbox = (offset) => {
    if (!lightboxImages.length) return;
    setLightbox((current) => ({
      ...current,
      index: (current.index + offset + lightboxImages.length) % lightboxImages.length,
    }));
  };

  const buildImages = async (files) => Promise.all([...files].map(async (file) => {
    if (!acceptedImageTypes.includes(file.type)) throw new Error('Chỉ hỗ trợ ảnh PNG hoặc JPG.');
    return {
      id: makeId(),
      name: file.name,
      dataUrl: await compressImage(file),
      uploadedAt: dateTimeLabel(),
    };
  }));

  const addSessionImages = async (sessionNumber, side, files, replaceId = null) => {
    if (!files?.length) return;
    try {
      const images = await buildImages(files);
      const existingSession = usage.sessions.find((session) => session.number === sessionNumber);
      const persistedImage = existingSession?.afterImages.find((image) => image.persisted);
      const shouldPersist = side === 'afterImages' && (replaceId === persistedImage?.id || (!replaceId && !persistedImage));
      let persistedPath = null;
      if (shouldPersist) {
        const image = images[0];
        const uploaded = await apiRequest('/api/files/images', {
          method: 'POST',
          body: { mimeType: 'image/jpeg', base64: image.dataUrl, originalName: image.name },
        });
        persistedPath = uploaded.path;
        await apiRequest(`/api/service-packages/${encodeURIComponent(packageId)}/sessions/${encodeURIComponent(existingSession.id)}`, {
          method: 'PUT', body: { image: persistedPath },
        });
        images[0] = { ...image, id: `sql-${existingSession.id}`, dataUrl: persistedPath, persisted: true };
      }
      setUsage((current) => ({
        ...current,
        sessions: current.sessions.map((session) => {
          if (session.number !== sessionNumber) return session;
          const currentImages = session[side] ?? [];
          return {
            ...session,
            [side]: replaceId
              ? currentImages.map((image) => image.id === replaceId ? { ...image, ...images[0] } : image)
              : [...currentImages, ...images],
          };
        }),
      }));
      notify(persistedPath
        ? `Đã lưu một ảnh sau điều trị của Buổi ${sessionNumber} vào SQL. Ảnh bổ sung và ảnh trước điều trị chỉ hiển thị trong phiên hiện tại.`
        : `Ảnh đã thêm trong phiên hiện tại. Cơ sở dữ liệu hiện chỉ lưu một ảnh sau điều trị cho mỗi buổi.`, 'success');
    } catch (error) {
      notify(error.message || 'Không thể lưu hình ảnh.', 'error');
    }
  };

  const removeSessionImage = async (sessionNumber, side, imageId) => {
    const session = usage.sessions.find((item) => item.number === sessionNumber);
    const image = session?.[side].find((item) => item.id === imageId);
    try {
      if (image?.persisted) {
        await apiRequest(`/api/service-packages/${encodeURIComponent(packageId)}/sessions/${encodeURIComponent(session.id)}`, {
          method: 'PUT', body: { image: null },
        });
      }
    setUsage((current) => ({
      ...current,
      sessions: current.sessions.map((session) => session.number === sessionNumber
        ? { ...session, [side]: session[side].filter((image) => image.id !== imageId) }
        : session),
    }));
      notify(image?.persisted ? 'Đã xóa ảnh khỏi SQL.' : 'Đã xóa ảnh khỏi phiên hiện tại.', 'error');
    } catch (error) {
      notify(error.message || 'Không thể xóa hình ảnh.', 'error');
    }
  };

  const saveSessionResult = async () => {
    if (!selectedSession) return;
    try {
      await apiRequest(`/api/service-packages/${encodeURIComponent(packageId)}/sessions/${encodeURIComponent(selectedSession.id)}`, {
        method: 'PUT', body: { result: resultDraft.trim() },
      });
      await refreshUsage();
      setEditingResult(false);
      notify('Đã lưu kết quả buổi vào SQL.', 'success');
    } catch (error) {
      notify(error.message || 'Không thể lưu kết quả.', 'error');
    }
  };

  const showSessionImage = (sessionNumber, side, index) => openLightbox(index, sessionNumber, side);

  const renderSessionPhotos = (session, side, label) => {
    const images = session[side] ?? [];
    const inputKey = `${session.number}-${side}`;
    return (
      <section className="active-service-session-photo-group">
        <h4>{label}</h4>
        <div className="active-service-session-photo-grid">
          {images.map((image, index) => (
            <article className="active-service-session-photo" key={image.id}>
              <button type="button" className="active-service-session-photo__preview" onClick={() => showSessionImage(session.number, side, index)} aria-label={`Xem ảnh ${label.toLowerCase()} ${index + 1}`}>
                <img src={image.dataUrl} alt={image.name} />
              </button>
              <div className="active-service-session-photo__actions">
                <button type="button" onClick={() => {
                  const input = sessionInputRefs.current[inputKey];
                  if (input) {
                    input.dataset.replaceId = image.id;
                    input.click();
                  }
                }}>Cập nhật</button>
                <button type="button" aria-label={`Xóa ảnh ${image.name}`} onClick={() => removeSessionImage(session.number, side, image.id)}><Trash2 size={14} /></button>
              </div>
            </article>
          ))}
          <button type="button" className="active-service-session-photo__add" onClick={() => {
            const input = sessionInputRefs.current[inputKey];
            if (input) {
              delete input.dataset.replaceId;
              input.click();
            }
          }}>
            <ImagePlus size={30} />
            <span>{images.length ? 'Thêm ảnh' : '+ Thêm ảnh'}</span>
          </button>
          <input
            ref={(node) => { sessionInputRefs.current[inputKey] = node; }}
            className="visually-hidden"
            type="file"
            accept="image/png,image/jpeg"
            multiple
            onChange={(event) => {
              const replaceId = event.currentTarget.dataset.replaceId || null;
              const files = replaceId ? [event.currentTarget.files[0]].filter(Boolean) : event.currentTarget.files;
              delete event.currentTarget.dataset.replaceId;
              addSessionImages(session.number, side, files, replaceId);
              event.currentTarget.value = '';
            }}
          />
        </div>
      </section>
    );
  };

  if (loading) return <div className="panel data-loading" role="status">Đang tải liệu trình từ cơ sở dữ liệu SQL…</div>;
  if (loadError) return <div className="panel data-error" role="alert">Không tải được liệu trình từ SQL: {loadError}</div>;
  if (!usage) return <div className="panel data-error" role="alert">Không tìm thấy dữ liệu liệu trình trong SQL.</div>;

  return (
    <div className="page-stack customer-active-service-page">
      <PageHeader
        title={usage.name}
        fallbackPath={fallbackPath || `/khach-hang/${customer.id}`}
        onBack={onBack}
      />

      <section className="panel customer-active-service-summary">
        <header className="customer-active-service-summary__header">
          <div>
            <h2>Dịch vụ đang sử dụng</h2>
            <p>Hình ảnh, kết quả và thông tin được tổng hợp trực tiếp từ các buổi đã ghi nhận trong liệu trình.</p>
          </div>
          <div className="customer-active-service-summary__actions">
            {editingDetails ? <>
              <Button variant="secondary" className="customer-active-service-edit-button" onClick={cancelEditing}>Hủy</Button>
              <Button onClick={savePackageDetails} disabled={savingDetails}>{savingDetails ? 'Đang lưu…' : 'Lưu'}</Button>
            </> : <Button variant="secondary" className="customer-active-service-edit-button" onClick={beginEditing}><PenLine size={15} />Chỉnh sửa</Button>}
            <Button onClick={() => setReportOpen(true)}><FileText size={16} />XUẤT BÁO CÁO</Button>
          </div>
        </header>
        <dl className="customer-active-service-summary__facts">
          <div className="is-readonly"><dt>Mã đơn mua</dt><dd>{usage.purchaseOrder}</dd></div>
          <div className="is-readonly"><dt>Giá dịch vụ</dt><dd>{formatCurrency(usage.price)}</dd></div>
          <div className="is-readonly"><dt>Ngày mua</dt><dd>{usage.purchaseDate}</dd></div>
          <div className="is-readonly"><dt>Khách hàng</dt><dd>{customer.name} <small>{customer.id} · {customer.phone}</small></dd></div>
          <div><dt>Trạng thái thanh toán</dt><dd>{editingDetails ? <><select className="customer-active-service-edit-input" value={editValues.paymentStatus} aria-invalid={Boolean(editErrors.paymentStatus)} onChange={(event) => changeEditValue('paymentStatus', event.target.value)}><option value="">Chọn trạng thái</option><option value="Chưa thanh toán">Chưa thanh toán</option><option value="Đã thanh toán">Đã thanh toán</option></select>{editErrors.paymentStatus && <small className="customer-active-service-field-error">{editErrors.paymentStatus}</small>}</> : <StatusBadge tone={statusTone(usage.paymentStatus)}>{usage.paymentStatus}</StatusBadge>}</dd></div>
          <div className="is-readonly"><dt>Tổng số buổi</dt><dd>{usage.totalSessions} buổi</dd></div>
          <div><dt>Ghi chú</dt><dd>{editingDetails ? <><textarea className="customer-active-service-edit-input customer-active-service-edit-input--textarea" value={editValues.note} aria-invalid={Boolean(editErrors.note)} onChange={(event) => changeEditValue('note', event.target.value)} />{editErrors.note && <small className="customer-active-service-field-error">{editErrors.note}</small>}</> : usage.note || '—'}</dd></div>
          <div><dt>Tệp tổng hợp</dt><dd>{editingDetails ? <><input className="customer-active-service-edit-input" value={editValues.summaryFile} aria-invalid={Boolean(editErrors.summaryFile)} placeholder="Đường dẫn tệp" onChange={(event) => changeEditValue('summaryFile', event.target.value)} />{editErrors.summaryFile && <small className="customer-active-service-field-error">{editErrors.summaryFile}</small>}</> : usage.summaryFile ? <a href={usage.summaryFile} target="_blank" rel="noreferrer">Mở tệp tổng hợp</a> : '—'}</dd></div>
        </dl>
        <div className="customer-active-service-progress">
          <div className="customer-active-service-progress__status">
            <span>Trạng thái liệu trình</span>
            <StatusBadge tone={statusTone(serviceStatus)}>{serviceStatus}</StatusBadge>
          </div>
          <div className="customer-active-service-progress__bar-group">
            <span className="customer-active-service-progress__label">Tiến độ thực hiện</span>
            <div className="customer-active-service-progress__segments" role="progressbar" aria-label="Tiến độ liệu trình" aria-valuemin="0" aria-valuemax={usage.totalSessions} aria-valuenow={completedCount}>
              {Array.from({ length: usage.totalSessions }, (_, index) => <span className={index < completedCount ? 'is-complete' : ''} key={index} />)}
            </div>
            <small>Đã thực hiện {completedCount}/{usage.totalSessions} buổi</small>
          </div>
          <div className="customer-active-service-progress__remaining">
            <span>Còn lại</span>
            <strong>{String(remainingCount).padStart(2, '0')} <small>/ {String(usage.totalSessions).padStart(2, '0')} buổi</small></strong>
          </div>
        </div>
      </section>

      <section className="panel customer-active-service-sessions">
        <h2>Danh sách các buổi</h2>
        <DataTable
          ariaLabel="Các buổi trong liệu trình"
          rowKey="number"
          rows={usage.sessions}
          columns={[
            { key: 'number', label: 'STT', width: '10%', align: 'center' },
            { key: 'name', label: 'Tên buổi', width: '32%', render: (session) => <button type="button" className="customer-active-service-sessions__link" onClick={() => openSession(session)}>Buổi {session.number}</button> },
            { key: 'status', label: 'Trạng thái buổi', width: '28%', align: 'center', render: (session) => <StatusBadge tone={statusTone(session.status)}>{session.status}</StatusBadge> },
            { key: 'date', label: 'Ngày thực hiện', width: '30%', align: 'center' },
          ]}
        />
      </section>
      <Modal
        open={Boolean(selectedSession)}
        title={selectedSession ? `CHI TIẾT BUỔI ${selectedSession.number}` : ''}
        onClose={() => setSelectedSessionNumber(null)}
        size="large"
        className="customer-service-session-modal"
        headerActions={selectedSession && (editingSession ? <>
          <Button variant="secondary" onClick={() => { setEditingSession(false); setSessionEditDraft(null); setSessionEditErrors({}); }}>Hủy</Button>
          <Button onClick={saveSessionDetails} disabled={savingDetails}>{savingDetails ? 'Đang lưu…' : 'Lưu'}</Button>
        </> : <>
          <Button variant="secondary" onClick={beginSessionEditing}><PenLine size={15} />Chỉnh sửa buổi</Button>
          {selectedSession.status === 'Chưa thực hiện' ? <Button onClick={startSession}>Bắt đầu buổi</Button> : selectedSession.status === 'Đang thực hiện' ? <Button onClick={completeSession}>Hoàn thành buổi</Button> : null}
        </>)}
      >
        {selectedSession && <div className="customer-service-session-detail">
          {editingSession && sessionEditDraft ? <div className="customer-service-session-edit-grid">
            <label className="field"><span className="field__label">Ngày thực hiện</span><input className="field__control" type="datetime-local" value={sessionEditDraft.performedAt} onChange={(event) => setSessionEditDraft((current) => ({ ...current, performedAt: event.target.value }))} aria-invalid={Boolean(sessionEditErrors.performedAt)} />{sessionEditErrors.performedAt && <small className="field__error">{sessionEditErrors.performedAt}</small>}</label>
            <label className="field"><span className="field__label">Thời lượng</span><input className="field__control" value={`${selectedSession.duration} phút`} readOnly /></label>
            <label className="field"><span className="field__label">Trạng thái thực hiện</span><select className="field__control field__select" value={sessionEditDraft.status} onChange={(event) => setSessionEditDraft((current) => ({ ...current, status: event.target.value }))}><option>Chưa thực hiện</option><option>Đang thực hiện</option><option>Chờ xác nhận</option><option>Đã hoàn thành</option></select>{sessionEditErrors.status && <small className="field__error">{sessionEditErrors.status}</small>}</label>
            <label className="field"><span className="field__label">Xác nhận khách hàng</span><select className="field__control field__select" value={sessionEditDraft.customerConfirmation} onChange={(event) => setSessionEditDraft((current) => ({ ...current, customerConfirmation: event.target.value }))}><option>Chưa xác nhận</option><option>Đã xác nhận</option></select>{sessionEditErrors.customerConfirmation && <small className="field__error">{sessionEditErrors.customerConfirmation}</small>}</label>
            <label className="field customer-service-session-edit-grid__wide"><span className="field__label">Kết quả</span><textarea className="field__control" maxLength={255} value={sessionEditDraft.result} onChange={(event) => setSessionEditDraft((current) => ({ ...current, result: event.target.value }))} />{sessionEditErrors.result && <small className="field__error">{sessionEditErrors.result}</small>}</label>
            <label className="field customer-service-session-edit-grid__wide"><span className="field__label">Hình ảnh</span><input className="field__control" maxLength={255} value={sessionEditDraft.image} onChange={(event) => setSessionEditDraft((current) => ({ ...current, image: event.target.value }))} />{sessionEditErrors.image && <small className="field__error">{sessionEditErrors.image}</small>}</label>
            <label className="field customer-service-session-edit-grid__wide"><span className="field__label">Ghi chú</span><textarea className="field__control" maxLength={255} value={sessionEditDraft.note} onChange={(event) => setSessionEditDraft((current) => ({ ...current, note: event.target.value }))} />{sessionEditErrors.note && <small className="field__error">{sessionEditErrors.note}</small>}</label>
          </div> : <dl className="customer-service-session-detail__meta">
            <div><dt>Thời gian thực hiện</dt><dd>{selectedSession.duration} phút</dd></div>
            <div><dt>Ngày thực hiện</dt><dd>{selectedSession.date}</dd></div>
            <div><dt>Trạng thái thực hiện</dt><dd><StatusBadge tone={statusTone(selectedSession.status)}>{selectedSession.status}</StatusBadge></dd></div>
            <div><dt>Xác nhận khách hàng</dt><dd><StatusBadge tone={statusTone(selectedSession.customerConfirmation)}>{selectedSession.customerConfirmation}</StatusBadge></dd></div>
          </dl>}
          {simulationEnabled && selectedSession.status === 'Chờ xác nhận' && selectedSession.customerConfirmation === 'Chưa xác nhận' && <div className="customer-active-service-simulation">
            <span>Demo/Zalo</span>
            <Button variant="secondary" className="customer-active-service-simulation__button" onClick={simulateCustomerConfirmation} disabled={simulatingConfirmation}><MessageCircleCheck size={16} />{simulatingConfirmation ? 'Đang cập nhật…' : 'Giả lập: khách đã xác nhận'}</Button>
          </div>}

          <dl className="customer-service-session-detail__facts">
            <div><dt>Dịch vụ</dt><dd>{usage.name}</dd></div>
            <div><dt>Nhân viên thực hiện</dt><dd>{selectedSession.employee || '—'}</dd></div>
          </dl>

          <div className="customer-service-session-detail__grid">
            <section className="customer-service-session-card customer-service-session-card--techniques">
              <h3>Nội dung chăm sóc · Quy trình kỹ thuật</h3>
              <ul>{selectedSession.techniques.map((technique, index) => <li key={`${index}-${technique}`}>Bước {index + 1}: {technique}</li>)}</ul>
            </section>

            <section className="customer-service-session-card customer-service-session-card--products">
              <h3>Sản phẩm sử dụng</h3>
              <div className="table-scroll" role="region" aria-label="Sản phẩm sử dụng trong buổi" tabIndex={0}>
                <table className="data-table customer-service-session-detail__products">
                  <thead><tr><th scope="col" style={{ width: '15%', textAlign: 'center' }}>STT</th><th scope="col" style={{ width: '55%' }}>Tên mỹ phẩm</th><th scope="col" style={{ width: '30%', textAlign: 'center' }}>Định lượng sử dụng</th></tr></thead>
                  <tbody>{selectedSession.products.map((product, index) => <tr key={`${product.name}-${index}`}><td className="data-table__cell--center">{index + 1}</td><td>{product.name}</td><td className="data-table__cell--center">{product.amount}</td></tr>)}</tbody>
                </table>
              </div>
            </section>

            <section className="customer-service-session-card customer-service-session-card--result">
              <h3>Kết quả điều trị</h3>
              <div className="customer-service-session-card__body">
                {editingSession ? <p>{sessionEditDraft?.result || 'Chưa có kết quả ghi nhận'}</p> : editingResult ? (
                  <div className="customer-service-session-result-editor">
                    <textarea value={resultDraft} onChange={(event) => setResultDraft(event.target.value)} aria-label="Kết quả điều trị" />
                    <div><Button variant="secondary" onClick={() => { setEditingResult(false, 'error'); setResultDraft(selectedSession.result || ''); }}>Hủy</Button><Button onClick={saveSessionResult}>Lưu kết quả</Button></div>
                  </div>
                ) : selectedSession.result ? (
                  <p>{selectedSession.result}</p>
                ) : (
                  <p className="customer-service-session-card__empty"><Info size={17} />Chưa có kết quả ghi nhận</p>
                )}
                {!editingResult && <Button variant="secondary" onClick={() => { setResultDraft(selectedSession.result || ''); setEditingResult(true); }}>{selectedSession.result ? 'Cập nhật kết quả' : '+ Thêm kết quả'}</Button>}
              </div>
            </section>

            <section className="customer-service-session-card customer-service-session-card--photos">
              <h3>Hình ảnh tình trạng</h3>
              <div className="customer-service-session-detail__photos">
                {renderSessionPhotos(selectedSession, 'beforeImages', 'Trước điều trị')}
                {renderSessionPhotos(selectedSession, 'afterImages', 'Sau điều trị')}
              </div>
            </section>

          </div>
        </div>}
      </Modal>

      <FeedbackDialog open={resultMissingOpen} title="" message="Vui lòng nhập kết quả buổi !" onClose={() => setResultMissingOpen(false)} layer={2} />

      <Modal
        open={Boolean(lightbox && activeLightboxImage)}
        title={activeLightboxImage?.name || 'Xem hình ảnh'}
        onClose={() => setLightbox(null)}
        size="large"
        layer={2}
        className="customer-service-image-lightbox"
        headerActions={lightboxImages.length > 1 && <div className="customer-service-image-lightbox__stepper">
          <Button variant="secondary" aria-label="Ảnh trước" onClick={() => moveLightbox(-1)}><ChevronLeft size={17} /></Button>
          <span>{(lightbox?.index ?? 0) + 1} / {lightboxImages.length}</span>
          <Button variant="secondary" aria-label="Ảnh sau" onClick={() => moveLightbox(1)}><ChevronRight size={17} /></Button>
        </div>}
      >
        {activeLightboxImage && <img className="customer-service-image-lightbox__image" src={activeLightboxImage.dataUrl} alt={activeLightboxImage.name} />}
      </Modal>

      <TreatmentReportModal
        open={reportOpen}
        onClose={() => setReportOpen(false)}
        customer={customer}
        usage={usage}
        serviceStatus={serviceStatus}
        completedCount={completedCount}
        remainingCount={remainingCount}
        onResult={(message) => notify(message, message.startsWith('Báo cáo đã sẵn sàng') ? 'success' : 'warning')}
      />
    </div>
  );
}
