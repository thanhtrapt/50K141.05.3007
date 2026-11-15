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
import { activeServiceUsage, formatCurrency } from '../../data/mockData.js';
import { dateTimeLabel } from '../../utils/treatmentReport.js';

const STORAGE_PREFIX = 'huong-spa:active-service:';
const acceptedImageTypes = ['image/png', 'image/jpeg'];

function makeId() {
  return globalThis.crypto?.randomUUID?.() ?? `img-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function dateLabel(date = new Date()) {
  return new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short' }).format(date);
}

function initialUsage(customer) {
  return {
    ...activeServiceUsage,
    id: `${activeServiceUsage.id}-${customer.id}`,
    customerId: customer.id,
    customerName: customer.name,
    customerPhone: customer.phone,
    galleryImages: [],
    deliveryHistory: [],
    deliveryMilestones: [...activeServiceUsage.deliveryMilestones],
    sessions: activeServiceUsage.sessions.map((session) => ({
      ...session,
      employee: session.employee || '',
      notes: session.notes || '',
      techniques: [...activeServiceUsage.techniques],
      products: activeServiceUsage.products.map((product) => ({ ...product })),
      beforeImages: [...(session.beforeImages ?? [])],
      afterImages: [...(session.afterImages ?? [])],
    })),
  };
}

function loadUsage(customer) {
  const defaults = initialUsage(customer);
  try {
    const saved = JSON.parse(window.localStorage.getItem(`${STORAGE_PREFIX}${customer.id}`) || 'null');
    if (!saved) return defaults;
    return {
      ...defaults,
      ...saved,
      customerId: customer.id,
      customerName: customer.name,
      customerPhone: customer.phone,
      galleryImages: Array.isArray(saved.galleryImages) ? saved.galleryImages : [],
      deliveryHistory: Array.isArray(saved.deliveryHistory) ? saved.deliveryHistory : [],
      deliveryMilestones: Array.isArray(saved.deliveryMilestones) ? saved.deliveryMilestones : defaults.deliveryMilestones,
      sessions: defaults.sessions.map((session) => {
        const savedSession = saved.sessions?.find((item) => item.number === session.number);
        return {
          ...session,
          ...(savedSession ?? {}),
          techniques: Array.isArray(savedSession?.techniques) && savedSession.techniques.length ? savedSession.techniques : session.techniques,
          products: Array.isArray(savedSession?.products) && savedSession.products.length ? savedSession.products : session.products,
          beforeImages: Array.isArray(savedSession?.beforeImages) ? savedSession.beforeImages : [],
          afterImages: Array.isArray(savedSession?.afterImages) ? savedSession.afterImages : [],
        };
      }),
    };
  } catch {
    return defaults;
  }
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

export default function CustomerActiveServicePage({ customer, onBack, fallbackPath }) {
  const [usage, setUsage] = useState(() => loadUsage(customer));
  const [selectedSessionNumber, setSelectedSessionNumber] = useState(null);
  const [lightbox, setLightbox] = useState(null);
  const [reportOpen, setReportOpen] = useState(false);
  const [startErrorOpen, setStartErrorOpen] = useState(false);
  const [resultMissingOpen, setResultMissingOpen] = useState(false);
  const [resultDraft, setResultDraft] = useState('');
  const [editingResult, setEditingResult] = useState(false);
  const [notice, setNotice] = useState('');
  const [storageError, setStorageError] = useState(false);
  const sessionInputRefs = useRef({});

  const storageKey = `${STORAGE_PREFIX}${customer.id}`;
  const selectedSession = usage.sessions.find((session) => session.number === selectedSessionNumber) ?? null;
  const completedCount = completedSessionCount(usage.sessions);
  const remainingCount = Math.max(0, usage.totalSessions - completedCount);
  const serviceStatus = completedCount >= usage.totalSessions ? 'Hoàn thành' : usage.status;
  const lightboxImages = useMemo(() => {
    if (!lightbox) return [];
    const session = usage.sessions.find((item) => item.number === lightbox.sessionNumber);
    return session?.[lightbox.side] ?? [];
  }, [lightbox, usage.sessions]);
  const activeLightboxImage = lightboxImages[lightbox?.index ?? -1] ?? null;

  useEffect(() => {
    setUsage(loadUsage(customer));
    setSelectedSessionNumber(null);
    setLightbox(null);
  }, [customer.id]);

  useEffect(() => {
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(usage));
      setStorageError(false);
    } catch {
      setStorageError(true);
    }
  }, [storageKey, usage]);

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

  const startSession = () => {
    if (!selectedSession) return;
    const earlierSessionIsActive = usage.sessions.some((session) => (
      session.number < selectedSession.number
      && !['Đã hoàn thành', 'Chờ xác nhận'].includes(session.status)
    ));
    if (earlierSessionIsActive) {
      setStartErrorOpen(true);
      return;
    }
    updateSession(selectedSession.number, { status: 'Đang thực hiện', date: dateLabel() });
  };

  const completeSession = () => {
    if (!selectedSession) return;
    if (!resultDraft.trim()) { setResultMissingOpen(true); return; }
    updateSession(selectedSession.number, {
      status: 'Đã hoàn thành',
      result: resultDraft.trim(),
      date: selectedSession.date === '--' ? dateLabel() : selectedSession.date,
    });
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
      setNotice(replaceId ? `Đã cập nhật ảnh của Buổi ${sessionNumber}.` : `${images.length} ảnh đã được lưu cho Buổi ${sessionNumber}.`);
    } catch (error) {
      setNotice(error.message || 'Không thể lưu hình ảnh.');
    }
  };

  const removeSessionImage = (sessionNumber, side, imageId) => {
    setUsage((current) => ({
      ...current,
      sessions: current.sessions.map((session) => session.number === sessionNumber
        ? { ...session, [side]: session[side].filter((image) => image.id !== imageId) }
        : session),
    }));
  };

  const saveSessionResult = () => {
    if (!selectedSession) return;
    updateSession(selectedSession.number, { result: resultDraft.trim() });
    setEditingResult(false);
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
      {storageError && <div className="customer-active-service-storage-error" role="alert">Bộ nhớ trình duyệt đã đầy nên thay đổi mới chưa được lưu. Hãy xóa bớt ảnh rồi thử lại.</div>}

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

      <FeedbackDialog open={startErrorOpen} title="" message="Vui lòng hoàn thành buổi trước theo đúng thứ tự !" onClose={() => setStartErrorOpen(false)} layer={2} />
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
