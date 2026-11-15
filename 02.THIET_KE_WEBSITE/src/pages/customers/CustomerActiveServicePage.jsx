import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  FileText,
  ImagePlus,
  Info,
  Trash2,
  X,
} from 'lucide-react';
import Button from '../../components/ui/Button.jsx';
import DataTable from '../../components/ui/DataTable.jsx';
import Modal from '../../components/ui/Modal.jsx';
import FeedbackDialog from '../../components/ui/FeedbackDialog.jsx';
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

function dateLabel(value) {
  if (!value) return '--';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short' }).format(date);
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
    startDate: dateLabel(record.purchaseDate),
    expectedEndDate: record.endedAt ? dateLabel(record.endedAt) : '',
    purchaseDate: dateLabel(record.purchaseDate),
    paymentStatus: record.paymentStatus || '—',
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
  const [notice, setNotice] = useState('');
  const sessionInputRefs = useRef({});

  const selectedSession = usage?.sessions.find((session) => session.number === selectedSessionNumber) ?? null;
  const completedCount = completedSessionCount(usage?.sessions ?? []);
  const remainingCount = Math.max(0, (usage?.totalSessions ?? 0) - completedCount);
  const serviceStatus = completedCount >= (usage?.totalSessions ?? 0) ? 'Hoàn thành' : usage?.status;
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
      setNotice('Đã bắt đầu buổi và lưu trạng thái vào SQL.');
    } catch (error) {
      setNotice(error.message || 'Không thể bắt đầu buổi.');
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
      setNotice('Đã lưu kết quả và trạng thái buổi vào SQL.');
    } catch (error) {
      setNotice(error.message || 'Không thể hoàn tất buổi.');
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
      setNotice(persistedPath
        ? `Đã lưu một ảnh sau điều trị của Buổi ${sessionNumber} vào SQL. Ảnh bổ sung và ảnh trước điều trị chỉ hiển thị trong phiên hiện tại.`
        : `Ảnh đã thêm trong phiên hiện tại. Cơ sở dữ liệu hiện chỉ lưu một ảnh sau điều trị cho mỗi buổi.`);
    } catch (error) {
      setNotice(error.message || 'Không thể lưu hình ảnh.');
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
      setNotice(image?.persisted ? 'Đã xóa ảnh khỏi SQL.' : 'Đã xóa ảnh khỏi phiên hiện tại.');
    } catch (error) {
      setNotice(error.message || 'Không thể xóa hình ảnh.');
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
      setNotice('Đã lưu kết quả buổi vào SQL.');
    } catch (error) {
      setNotice(error.message || 'Không thể lưu kết quả.');
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
          <Button onClick={() => setReportOpen(true)}><FileText size={16} />XUẤT BÁO CÁO</Button>
        </header>
        <dl className="customer-active-service-summary__facts">
          <div><dt>Mã đơn mua</dt><dd>{usage.purchaseOrder}</dd></div>
          <div><dt>Giá dịch vụ</dt><dd>{formatCurrency(usage.price)}</dd></div>
          <div><dt>Ngày bắt đầu</dt><dd>{usage.startDate || 'Chưa cập nhật'}</dd></div>
          <div><dt>Ngày kết thúc dự kiến</dt><dd>{usage.expectedEndDate || 'Chưa cập nhật'}</dd></div>
          <div><dt>Khách hàng</dt><dd>{customer.name} <small>{customer.id} · {customer.phone}</small></dd></div>
          <div><dt>Ngày mua</dt><dd>{usage.purchaseDate}</dd></div>
          <div><dt>Trạng thái thanh toán</dt><dd><StatusBadge tone={statusTone(usage.paymentStatus)}>{usage.paymentStatus}</StatusBadge></dd></div>
          <div><dt>Tổng số buổi</dt><dd>{usage.totalSessions} buổi</dd></div>
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

      {notice && <div className="customer-active-service-notice" role="status"><span>{notice}</span><button type="button" aria-label="Đóng thông báo" onClick={() => setNotice('')}><X size={16} /></button></div>}
      <Modal
        open={Boolean(selectedSession)}
        title={selectedSession ? `CHI TIẾT BUỔI ${selectedSession.number}` : ''}
        onClose={() => setSelectedSessionNumber(null)}
        size="large"
        className="customer-service-session-modal"
        headerActions={selectedSession?.status === 'Chưa thực hiện' ? <Button onClick={startSession}>Bắt đầu buổi</Button> : selectedSession?.status === 'Đang thực hiện' ? <Button onClick={completeSession}>Hoàn thành buổi</Button> : null}
      >
        {selectedSession && <div className="customer-service-session-detail">
          <dl className="customer-service-session-detail__meta">
            <div><dt>Thời gian thực hiện</dt><dd>{selectedSession.duration} phút</dd></div>
            <div><dt>Ngày thực hiện</dt><dd>{selectedSession.date}</dd></div>
            <div><dt>Trạng thái thực hiện</dt><dd><StatusBadge tone={statusTone(selectedSession.status)}>{selectedSession.status}</StatusBadge></dd></div>
            <div><dt>Xác nhận khách hàng</dt><dd><StatusBadge tone={statusTone(selectedSession.customerConfirmation)}>{selectedSession.customerConfirmation}</StatusBadge></dd></div>
          </dl>

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
                {editingResult ? (
                  <div className="customer-service-session-result-editor">
                    <textarea value={resultDraft} onChange={(event) => setResultDraft(event.target.value)} aria-label="Kết quả điều trị" />
                    <div><Button variant="secondary" onClick={() => { setEditingResult(false); setResultDraft(selectedSession.result || ''); }}>Hủy</Button><Button onClick={saveSessionResult}>Lưu kết quả</Button></div>
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
        onResult={setNotice}
      />
    </div>
  );
}
