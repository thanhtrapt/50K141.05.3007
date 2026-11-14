import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  FileText,
  ImagePlus,
  Images,
  Info,
  MessageCircle,
  Trash2,
  X,
} from 'lucide-react';
import Button from '../../components/ui/Button.jsx';
import Modal from '../../components/ui/Modal.jsx';
import PageHeader from '../../components/ui/PageHeader.jsx';
import StatusBadge from '../../components/ui/StatusBadge.jsx';
import { activeServiceUsage, formatCurrency } from '../../data/mockData.js';

const STORAGE_PREFIX = 'huong-spa:active-service:';
const acceptedImageTypes = ['image/png', 'image/jpeg'];

function makeId() {
  return globalThis.crypto?.randomUUID?.() ?? `img-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function dateTimeLabel(date = new Date()) {
  return new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short' }).format(date);
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

function hasRecordedSessionData(session) {
  const hasCompletedVisit = session.status !== 'Chưa thực hiện' && session.date && session.date !== '--';
  return Boolean(
    hasCompletedVisit
    || session.result?.trim()
    || session.notes?.trim()
    || session.employee?.trim()
    || session.beforeImages?.length
    || session.afterImages?.length,
  );
}

function escapeHtml(value = '') {
  return String(value).replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character]);
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

export default function CustomerActiveServicePage({ customer, onBack }) {
  const [usage, setUsage] = useState(() => loadUsage(customer));
  const [selectedSessionNumber, setSelectedSessionNumber] = useState(null);
  const [lightbox, setLightbox] = useState(null);
  const [startErrorOpen, setStartErrorOpen] = useState(false);
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
  const reportSessions = useMemo(
    () => [...usage.sessions].sort((first, second) => first.number - second.number).filter(hasRecordedSessionData),
    [usage.sessions],
  );
  const treatmentSessions = useMemo(
    () => [...usage.sessions].sort((first, second) => first.number - second.number),
    [usage.sessions],
  );
  const lightboxImages = useMemo(() => {
    if (!lightbox) return [];
    if (lightbox.scope === 'treatment') return usage.galleryImages;
    const session = usage.sessions.find((item) => item.number === lightbox.sessionNumber);
    return session?.[lightbox.side] ?? [];
  }, [lightbox, usage.galleryImages, usage.sessions]);
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
    updateSession(selectedSession.number, {
      status: 'Đã hoàn thành',
      date: selectedSession.date === '--' ? dateLabel() : selectedSession.date,
    });
  };

  const openLightbox = (scope, index, sessionNumber = null, side = null) => setLightbox({ scope, index, sessionNumber, side });

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

  const exportPdf = () => {
    const hasImages = reportSessions.some((session) => session.beforeImages?.length || session.afterImages?.length)
      || usage.galleryImages.length > 0;
    const hasSessionDetails = reportSessions.some((session) => (
      session.result?.trim()
      || session.notes?.trim()
      || session.employee?.trim()
      || session.techniques?.length
      || session.products?.length
    ));
    if (!reportSessions.length && !hasImages && !hasSessionDetails) {
      setNotice('Chưa có dữ liệu liệu trình để tạo báo cáo.');
      return;
    }

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      setNotice('Trình duyệt đã chặn cửa sổ báo cáo. Hãy cho phép cửa sổ bật lên rồi thử lại.');
      return;
    }

    const renderImages = (images, label) => images?.length
      ? `<div class="photos">${images.map((image) => `<figure><img src="${escapeHtml(image.dataUrl)}" alt="${escapeHtml(image.name || label)}"><figcaption>${escapeHtml(image.name || label)}</figcaption></figure>`).join('')}</div>`
      : `<p class="empty">Chưa ghi nhận hình ảnh ${escapeHtml(label.toLowerCase())}.</p>`;

    const sessionsMarkup = reportSessions.map((session) => {
      const techniques = session.techniques ?? [];
      const products = session.products ?? [];
      const productRows = products.length
        ? products.map((product, index) => `<tr><td>${index + 1}</td><td>${escapeHtml(product.name || '—')}</td><td>${escapeHtml(product.amount || '—')}</td></tr>`).join('')
        : '<tr><td colspan="3" class="empty">Chưa ghi nhận mỹ phẩm sử dụng.</td></tr>';
      return `<section class="session">
        <div class="session-title"><h2>Buổi ${escapeHtml(session.number)}</h2><span>${escapeHtml(session.date || 'Chưa cập nhật ngày')}</span></div>
        <div class="meta"><div><b>Trạng thái</b><span>${escapeHtml(session.status || '—')}</span></div><div><b>Nhân viên</b><span>${escapeHtml(session.employee || 'Chưa ghi nhận')}</span></div><div><b>Thời lượng</b><span>${escapeHtml(session.duration ? `${session.duration} phút` : '—')}</span></div><div><b>Xác nhận khách hàng</b><span>${escapeHtml(session.customerConfirmation || '—')}</span></div></div>
        <h3>Quy trình kỹ thuật</h3>${techniques.length ? `<ol>${techniques.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ol>` : '<p class="empty">Chưa ghi nhận quy trình kỹ thuật.</p>'}
        <h3>Mỹ phẩm sử dụng</h3><table><thead><tr><th>STT</th><th>Tên mỹ phẩm</th><th>Định lượng</th></tr></thead><tbody>${productRows}</tbody></table>
        <h3>Kết quả điều trị</h3><p class="result">${escapeHtml(session.result?.trim() || 'Chưa ghi nhận kết quả điều trị.')}</p>
        ${session.notes?.trim() ? `<h3>Thông tin ghi nhận khác</h3><p class="result">${escapeHtml(session.notes)}</p>` : ''}
        <div class="photo-columns"><div><h3>Trước điều trị</h3>${renderImages(session.beforeImages, 'trước điều trị')}</div><div><h3>Sau điều trị</h3>${renderImages(session.afterImages, 'sau điều trị')}</div></div>
      </section>`;
    }).join('');
    const overviewImages = usage.galleryImages.length
      ? `<section class="overview"><h2>Hình ảnh tổng quan liệu trình</h2>${renderImages(usage.galleryImages, 'tổng quan')}</section>`
      : '';
    const recordedResults = reportSessions
      .filter((session) => session.result?.trim())
      .map((session) => `Buổi ${session.number}: ${session.result.trim()}`)
      .join('\n');
    const exportedAt = dateTimeLabel();

    printWindow.document.open();
    printWindow.document.write(`<!doctype html><html lang="vi"><head><meta charset="utf-8"><title>Báo cáo liệu trình - ${escapeHtml(customer.name)}</title><style>
      @page{size:A4;margin:16mm}*{box-sizing:border-box}body{margin:0;color:#382d26;font:13px/1.5 Arial,sans-serif}h1{margin:0;color:#684a35;font-size:24px}h2{margin:0;color:#684a35;font-size:18px}h3{margin:18px 0 8px;color:#684a35;font-size:14px}p{margin:0;white-space:pre-wrap}.subtitle{margin:4px 0 18px;color:#76685d}.summary{display:grid;grid-template-columns:1fr 1fr;gap:10px 18px;padding:15px;background:#fff8ef;border:1px solid #e8d7c3;border-radius:8px}.summary div,.meta div{display:grid;gap:2px}.summary b,.meta b{color:#80664f;font-size:11px;font-weight:600}.summary span,.meta span{font-weight:600}.progress{margin:12px 0 0;color:#684a35;font-weight:700}.session,.overview{margin-top:22px;padding-top:18px;border-top:1px solid #e8d7c3;break-inside:auto}.overall{margin-top:18px}.overall h2{margin-bottom:8px}.session-title{display:flex;justify-content:space-between;align-items:center;gap:12px}.session-title span{color:#76685d}.meta{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-top:12px;padding:12px;background:#faf7f3;border-radius:6px}.empty{color:#8a817a;font-style:italic}.result{padding:10px 12px;background:#faf7f3;border-radius:6px}.photos{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px;margin-top:8px}.photos figure{margin:0;break-inside:avoid}.photos img{display:block;width:100%;height:210px;object-fit:contain;background:#f8f4ef;border-radius:5px}.photos figcaption{padding-top:4px;color:#76685d;font-size:10px;overflow-wrap:anywhere}.photo-columns{display:grid;grid-template-columns:1fr 1fr;gap:14px}.photo-columns h3{margin-top:12px}table{width:100%;border-collapse:collapse;font-size:12px}th,td{padding:7px 9px;text-align:left;border:1px solid #e8d7c3}th{background:#fff8ef;color:#684a35}.report-footer{margin-top:24px;padding-top:10px;border-top:1px solid #e8d7c3;color:#76685d;font-size:11px}@media print{.session{break-inside:auto}.session-title,.meta,table tr,.photos figure{break-inside:avoid}img{print-color-adjust:exact}}
    </style></head><body><header><h1>HÌNH ẢNH LIỆU TRÌNH</h1><p class="subtitle">Báo cáo tổng hợp dữ liệu đã ghi nhận trong quá trình thực hiện</p></header>
      <section class="summary"><div><b>Khách hàng</b><span>${escapeHtml(customer.name)}</span></div><div><b>Mã khách hàng</b><span>${escapeHtml(customer.id)}</span></div><div><b>Số điện thoại</b><span>${escapeHtml(customer.phone || '—')}</span></div><div><b>Dịch vụ</b><span>${escapeHtml(usage.name)}</span></div><div><b>Giá dịch vụ</b><span>${escapeHtml(formatCurrency(usage.price))}</span></div><div><b>Mã đơn mua</b><span>${escapeHtml(usage.purchaseOrder || '—')}</span></div><div><b>Ngày mua</b><span>${escapeHtml(usage.purchaseDate || 'Chưa cập nhật')}</span></div><div><b>Ngày bắt đầu</b><span>${escapeHtml(usage.startDate || 'Chưa cập nhật')}</span></div><div><b>Kết thúc dự kiến</b><span>${escapeHtml(usage.expectedEndDate || 'Chưa cập nhật')}</span></div><div><b>Trạng thái liệu trình</b><span>${escapeHtml(serviceStatus)}</span></div></section>
      <p class="progress">Tiến độ: ${completedCount}/${usage.totalSessions} buổi đã hoàn thành · Còn ${remainingCount} buổi</p>
      <section class="overall"><h2>Kết quả tổng hợp</h2><p class="result">${escapeHtml(recordedResults || 'Chưa có kết quả điều trị được ghi nhận.')}</p></section>
      ${sessionsMarkup || '<p class="empty" style="margin-top:18px">Chưa có buổi thực hiện nào được ghi nhận.</p>'}${overviewImages}<footer class="report-footer">Ngày xuất báo cáo: ${escapeHtml(exportedAt)}</footer>
      <script>window.addEventListener('load',()=>{const imgs=[...document.images];Promise.all(imgs.map((img)=>img.decode?.().catch(()=>{})??Promise.resolve())).then(()=>setTimeout(()=>window.print(),150))});</script></body></html>`);
    printWindow.document.close();
    setNotice('Báo cáo đã sẵn sàng. Chọn “Lưu dưới dạng PDF” trong hộp thoại in của trình duyệt.');
  };

  const showSessionImage = (sessionNumber, side, index) => openLightbox('session', index, sessionNumber, side);

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
        actions={<Button variant="secondary" onClick={onBack}><ArrowLeft size={17} />Quay lại hồ sơ khách hàng</Button>}
      />

      <section className="panel customer-active-service-summary">
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
        <div className="table-scroll" role="region" aria-label="Các buổi trong liệu trình" tabIndex={0}>
          <table className="data-table customer-active-service-sessions__table">
            <thead><tr><th scope="col">STT</th><th scope="col">Tên buổi</th><th scope="col">Trạng thái buổi</th><th scope="col">Ngày thực hiện</th></tr></thead>
            <tbody>
              {usage.sessions.map((session) => (
                <tr key={session.number}>
                  <td>{session.number}</td>
                  <td><button type="button" className="customer-active-service-sessions__link" onClick={() => openSession(session)}>Buổi {session.number}</button></td>
                  <td><StatusBadge tone={statusTone(session.status)}>{session.status}</StatusBadge></td>
                  <td>{session.date}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel customer-active-service-gallery">
        <header className="customer-active-service-gallery__header">
          <div>
            <h2>Hình ảnh liệu trình</h2>
            <p>Ảnh, kết quả và thông tin được tổng hợp trực tiếp từ các buổi đã ghi nhận.</p>
          </div>
          <Button onClick={exportPdf}><FileText size={16} />XUẤT BÁO CÁO PDF</Button>
        </header>

        {reportSessions.length ? (
          <div className="customer-active-service-session-list">
            {reportSessions.map((session) => (
              <article className="customer-active-service-session-card" key={session.number}>
                <header className="customer-active-service-session-card__header">
                  <div><h3>Buổi {session.number}</h3><span>{session.date || 'Chưa cập nhật ngày thực hiện'}</span></div>
                  <StatusBadge tone={statusTone(session.status)}>{session.status}</StatusBadge>
                </header>
                <div className="customer-active-service-session-card__photos">
                  {[
                    { side: 'beforeImages', label: 'Trước điều trị' },
                    { side: 'afterImages', label: 'Sau điều trị' },
                  ].map(({ side, label }) => {
                    const images = session[side] ?? [];
                    return (
                      <section className="customer-active-service-session-card__photo-group" key={side}>
                        <h4>{label}</h4>
                        {images.length ? (
                          <div className="customer-active-service-session-card__photo-grid">
                            {images.map((image, index) => (
                              <button type="button" key={image.id} onClick={() => openLightbox('session', index, session.number, side)} aria-label={`Xem ảnh ${label.toLowerCase()} buổi ${session.number}`}>
                                <img src={image.dataUrl} alt={`${label} - Buổi ${session.number}`} />
                              </button>
                            ))}
                          </div>
                        ) : <p className="customer-active-service-session-card__empty-photo">Chưa có ảnh</p>}
                      </section>
                    );
                  })}
                </div>
                <div className="customer-active-service-session-card__details">
                  <div><strong>Kết quả điều trị</strong><p>{session.result?.trim() || 'Chưa ghi nhận kết quả.'}</p></div>
                  <div><strong>Nhân viên thực hiện</strong><p>{session.employee || 'Chưa ghi nhận'}</p></div>
                  {session.notes?.trim() && <div className="customer-active-service-session-card__notes"><strong>Thông tin ghi nhận</strong><p>{session.notes}</p></div>}
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="customer-active-service-gallery__empty">
            <Images size={34} aria-hidden="true" />
            <strong>Chưa có dữ liệu buổi thực hiện</strong>
            <span>Hình ảnh và kết quả sẽ tự hiển thị sau khi được ghi nhận trong chi tiết buổi.</span>
          </div>
        )}

        {usage.galleryImages.length > 0 && (
          <section className="customer-active-service-overview-gallery">
            <h3>Hình ảnh tổng quan đã lưu</h3>
            <div className="customer-active-service-gallery__grid">
              {usage.galleryImages.map((image, index) => (
                <button type="button" className="customer-active-service-gallery__preview" key={image.id} onClick={() => openLightbox('treatment', index)} aria-label={`Xem ảnh tổng quan ${image.name}`}>
                  <img src={image.dataUrl} alt={image.name || 'Ảnh tổng quan liệu trình'} />
                </button>
              ))}
            </div>
          </section>
        )}
      </section>

      <section className="customer-active-service-delivery-status" aria-label="Trạng thái gửi báo cáo Zalo">
        <div className="customer-active-service-delivery-status__icon"><MessageCircle size={19} /></div>
        <div className="customer-active-service-delivery-status__content">
          <div className="customer-active-service-delivery-status__heading"><h2>Gửi báo cáo qua Zalo</h2><StatusBadge tone="warning">Chưa cấu hình</StatusBadge></div>
          <p>Chưa có kết nối Zalo hoặc lịch gửi tự động. Hệ thống chưa gửi tài liệu qua Zalo.</p>
          {usage.deliveryHistory.length ? (
            <small>Lần gửi gần nhất: {usage.deliveryHistory[usage.deliveryHistory.length - 1].createdAt || 'Chưa rõ thời gian'} · {usage.deliveryHistory[usage.deliveryHistory.length - 1].status || 'Chưa rõ trạng thái'}</small>
          ) : <small>Lịch gửi: Chưa thiết lập · Lịch sử gửi: Chưa có</small>}
        </div>
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
                  <thead><tr><th scope="col">STT</th><th scope="col">Tên mỹ phẩm</th><th scope="col">Định lượng sử dụng</th></tr></thead>
                  <tbody>{selectedSession.products.map((product, index) => <tr key={`${product.name}-${index}`}><td>{index + 1}</td><td>{product.name}</td><td>{product.amount}</td></tr>)}</tbody>
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

      <Modal open={startErrorOpen} title="" onClose={() => setStartErrorOpen(false)} size="small" layer={2} className="customer-service-session-error" hideHeader hideClose ariaLabel="Không thể bắt đầu buổi">
        <div className="customer-service-session-error__content">
          <span><CircleAlert size={32} /></span>
          <p>Vui lòng hoàn thành buổi trước theo đúng thứ tự !</p>
          <Button onClick={() => setStartErrorOpen(false)}>Đóng</Button>
        </div>
      </Modal>

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
    </div>
  );
}
