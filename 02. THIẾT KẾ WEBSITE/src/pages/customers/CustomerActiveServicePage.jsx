import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Download,
  FileText,
  ImagePlus,
  Images,
  Info,
  Trash2,
  Upload,
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

function escapeHtml(value = '') {
  return String(value).replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character]);
}

function fileSafeName(value = '') {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase() || 'hinh-anh';
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

function convertImageFormat(dataUrl, mimeType) {
  if (dataUrl.startsWith(`data:${mimeType}`)) return Promise.resolve(dataUrl);
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onerror = () => reject(new Error('Không thể chuẩn bị hình ảnh để tải xuống.'));
    image.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      const context = canvas.getContext('2d');
      if (!context) {
        reject(new Error('Trình duyệt không thể chuyển đổi hình ảnh.'));
        return;
      }
      context.drawImage(image, 0, 0);
      resolve(canvas.toDataURL(mimeType, 0.92));
    };
    image.src = dataUrl;
  });
}

function downloadDataUrl(dataUrl, filename) {
  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
}

export default function CustomerActiveServicePage({ customer, onBack }) {
  const [usage, setUsage] = useState(() => loadUsage(customer));
  const [selectedImages, setSelectedImages] = useState(() => new Set());
  const [imageFormat, setImageFormat] = useState('image/png');
  const [selectedSessionNumber, setSelectedSessionNumber] = useState(null);
  const [lightbox, setLightbox] = useState(null);
  const [startErrorOpen, setStartErrorOpen] = useState(false);
  const [resultDraft, setResultDraft] = useState('');
  const [editingResult, setEditingResult] = useState(false);
  const [notice, setNotice] = useState('');
  const [storageError, setStorageError] = useState(false);
  const galleryInputRef = useRef(null);
  const sessionInputRefs = useRef({});

  const storageKey = `${STORAGE_PREFIX}${customer.id}`;
  const selectedSession = usage.sessions.find((session) => session.number === selectedSessionNumber) ?? null;
  const completedCount = completedSessionCount(usage.sessions);
  const remainingCount = Math.max(0, usage.totalSessions - completedCount);
  const serviceStatus = completedCount >= usage.totalSessions ? 'Hoàn thành' : usage.status;
  const selectedGalleryImages = usage.galleryImages.filter((image) => selectedImages.has(image.id));
  const lightboxImages = useMemo(() => {
    if (!lightbox) return [];
    if (lightbox.scope === 'treatment') return usage.galleryImages;
    const session = usage.sessions.find((item) => item.number === lightbox.sessionNumber);
    return session?.[lightbox.side] ?? [];
  }, [lightbox, usage.galleryImages, usage.sessions]);
  const activeLightboxImage = lightboxImages[lightbox?.index ?? -1] ?? null;

  useEffect(() => {
    setUsage(loadUsage(customer));
    setSelectedImages(new Set());
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

  useEffect(() => {
    setUsage((current) => {
      const completed = completedSessionCount(current.sessions);
      const missingMilestones = current.deliveryMilestones.filter((milestone) => (
        milestone <= completed && !current.deliveryHistory.some((entry) => entry.milestone === milestone)
      ));
      if (!missingMilestones.length) return current;

      const createdAt = dateTimeLabel();
      return {
        ...current,
        deliveryHistory: [
          ...current.deliveryHistory,
          ...missingMilestones.map((milestone) => ({
            id: makeId(),
            milestone,
            stage: milestone === current.totalSessions ? 'Hoàn thành liệu trình' : `Sau buổi ${milestone}`,
            document: 'Báo cáo liệu trình PDF',
            createdAt,
            status: 'Chờ gửi',
          })),
        ],
      };
    });
  }, [usage.deliveryMilestones, usage.sessions]);

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

  const addTreatmentImages = async (files, replaceId = null) => {
    if (!files?.length) return;
    try {
      const images = await buildImages(files);
      setUsage((current) => ({
        ...current,
        galleryImages: replaceId
          ? current.galleryImages.map((image) => image.id === replaceId ? { ...image, ...images[0] } : image)
          : [...current.galleryImages, ...images],
      }));
      setNotice(replaceId ? 'Đã cập nhật ảnh trong thư viện của liệu trình.' : `${images.length} ảnh đã được lưu vào thư viện của liệu trình.`);
    } catch (error) {
      setNotice(error.message || 'Không thể lưu hình ảnh.');
    }
  };

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

  const removeTreatmentImage = (imageId) => {
    setUsage((current) => ({
      ...current,
      galleryImages: current.galleryImages.filter((image) => image.id !== imageId),
    }));
    setSelectedImages((current) => new Set([...current].filter((id) => id !== imageId)));
  };

  const removeSessionImage = (sessionNumber, side, imageId) => {
    setUsage((current) => ({
      ...current,
      sessions: current.sessions.map((session) => session.number === sessionNumber
        ? { ...session, [side]: session[side].filter((image) => image.id !== imageId) }
        : session),
    }));
  };

  const toggleSelectedImage = (imageId) => setSelectedImages((current) => {
    const next = new Set(current);
    if (next.has(imageId)) next.delete(imageId);
    else next.add(imageId);
    return next;
  });

  const toggleSelectAll = () => {
    if (selectedImages.size === usage.galleryImages.length && usage.galleryImages.length) {
      setSelectedImages(new Set());
    } else {
      setSelectedImages(new Set(usage.galleryImages.map((image) => image.id)));
    }
  };

  const exportImages = async () => {
    if (!selectedGalleryImages.length) {
      setNotice('Chọn ít nhất một ảnh trong thư viện liệu trình để tải xuống.');
      return;
    }
    const extension = imageFormat === 'image/png' ? 'png' : 'jpg';
    try {
      for (const [index, image] of selectedGalleryImages.entries()) {
        const converted = await convertImageFormat(image.dataUrl, imageFormat);
        downloadDataUrl(converted, `${fileSafeName(usage.name)}-${fileSafeName(image.name || `anh-${index + 1}`)}.${extension}`);
        await new Promise((resolve) => window.setTimeout(resolve, 180));
      }
      setNotice(`Đã chuẩn bị ${selectedGalleryImages.length} ảnh ${extension.toUpperCase()} để tải xuống.`);
    } catch (error) {
      setNotice(error.message || 'Không thể xuất ảnh.');
    }
  };

  const exportPdf = (images = usage.galleryImages, stage = null) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      setNotice('Trình duyệt đang chặn cửa sổ xuất PDF. Hãy cho phép cửa sổ bật lên rồi thử lại.');
      return;
    }

    const reportTitle = stage ? `BÁO CÁO LIỆU TRÌNH · ${stage}` : 'BÁO CÁO LIỆU TRÌNH';
    const photoMarkup = images.length
      ? `<div class="photos">${images.map((image) => `<figure><img src="${escapeHtml(image.dataUrl)}" alt="${escapeHtml(image.name)}"><figcaption>${escapeHtml(image.name)}</figcaption></figure>`).join('')}</div>`
      : '<p class="empty-photos">Chưa có hình ảnh tổng quan trong hồ sơ liệu trình.</p>';

    printWindow.document.open();
    printWindow.document.write(`<!doctype html>
      <html lang="vi"><head><meta charset="utf-8"><title>${escapeHtml(fileSafeName(reportTitle))}</title>
      <style>
        @page { size: A4; margin: 17mm; }
        * { box-sizing: border-box; }
        body { margin: 0; color: #4f3828; font: 12px Arial, sans-serif; }
        header { display:flex; justify-content:space-between; align-items:center; padding-bottom:16px; border-bottom:2px solid #b87937; }
        header img { width:135px; height:auto; object-fit:contain; }
        header p { color:#8c7867; text-align:right; line-height:1.6; }
        h1 { margin:22px 0 4px; color:#684a35; font-size:22px; }
        .subtitle { margin:0 0 20px; color:#947e6e; }
        h2 { margin:22px 0 10px; color:#684a35; font-size:15px; }
        .facts { display:grid; grid-template-columns:1fr 1fr; gap:8px 22px; padding:16px; background:#fbf5ef; border:1px solid #ead8bc; border-radius:8px; }
        .facts div { display:grid; grid-template-columns:132px 1fr; gap:8px; }
        .facts dt { color:#8c7867; }
        .facts dd { margin:0; font-weight:600; overflow-wrap:anywhere; }
        .progress { margin:14px 0; padding:12px 16px; background:#fff8e9; border-radius:8px; }
        .progress strong { color:#a7682b; }
        .photos { display:grid; grid-template-columns:repeat(2,1fr); gap:12px; }
        figure { margin:0; padding:8px; border:1px solid #ead8bc; border-radius:8px; break-inside:avoid; }
        figure img { display:block; width:100%; max-height:230px; object-fit:contain; }
        figcaption { margin-top:6px; color:#8c7867; overflow-wrap:anywhere; }
        .empty-photos { padding:18px; color:#8c7867; background:#fbf5ef; border-radius:8px; }
        footer { margin-top:26px; padding-top:10px; color:#8c7867; font-size:10px; border-top:1px solid #ead8bc; }
      </style></head><body>
        <header><img src="/assets/brand-lockup.png" alt="Hương Spa"><p>Hồ sơ liệu trình<br>Ngày xuất: ${escapeHtml(dateLabel())}</p></header>
        <h1>${escapeHtml(reportTitle)}</h1>
        <p class="subtitle">Tài liệu theo dõi dịch vụ đang sử dụng tại Hương Spa.</p>
        <h2>Thông tin khách hàng</h2>
        <dl class="facts">
          <div><dt>Họ và tên</dt><dd>${escapeHtml(customer.name)}</dd></div>
          <div><dt>Mã khách hàng</dt><dd>${escapeHtml(customer.id)}</dd></div>
          <div><dt>Số điện thoại</dt><dd>${escapeHtml(customer.phone)}</dd></div>
          <div><dt>Tên dịch vụ</dt><dd>${escapeHtml(usage.name)}</dd></div>
          <div><dt>Ngày bắt đầu</dt><dd>${escapeHtml(usage.startDate || 'Chưa cập nhật')}</dd></div>
          <div><dt>Kết thúc dự kiến</dt><dd>${escapeHtml(usage.expectedEndDate || 'Chưa cập nhật')}</dd></div>
          <div><dt>Ngày mua</dt><dd>${escapeHtml(usage.purchaseDate)}</dd></div>
          <div><dt>Giá dịch vụ</dt><dd>${escapeHtml(formatCurrency(usage.price))}</dd></div>
        </dl>
        <div class="progress">Tiến độ: <strong>${completedCount}/${usage.totalSessions} buổi</strong> đã thực hiện · Còn lại <strong>${remainingCount} buổi</strong> · Trạng thái: <strong>${escapeHtml(serviceStatus)}</strong></div>
        <h2>Hình ảnh theo dõi toàn liệu trình</h2>
        ${photoMarkup}
        <footer>Ảnh riêng của từng buổi được quản lý trong chi tiết buổi thực hiện và không nằm trong thư viện ảnh tổng quan này.</footer>
        <script>window.addEventListener('load', async () => { await Promise.all([...document.images].map((image) => image.decode?.().catch(() => undefined))); setTimeout(() => { window.focus(); window.print(); }, 180); });</script>
      </body></html>`);
    printWindow.document.close();
    setNotice('Trong hộp thoại in, chọn “Lưu dưới dạng PDF” để tải tài liệu về máy.');
  };

  const toggleMilestone = (milestone) => setUsage((current) => ({
    ...current,
    deliveryMilestones: current.deliveryMilestones.includes(milestone)
      ? current.deliveryMilestones.filter((value) => value !== milestone)
      : [...current.deliveryMilestones, milestone].sort((first, second) => first - second),
  }));

  const saveSessionResult = () => {
    if (!selectedSession) return;
    updateSession(selectedSession.number, { result: resultDraft.trim() });
    setEditingResult(false);
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

  const selectAllChecked = usage.galleryImages.length > 0 && selectedImages.size === usage.galleryImages.length;

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
            <p>Ảnh tổng quan theo dõi toàn bộ liệu trình. Ảnh trước/sau từng buổi được lưu riêng trong chi tiết buổi.</p>
          </div>
          <Button onClick={() => {
            if (galleryInputRef.current) {
              delete galleryInputRef.current.dataset.replaceId;
              galleryInputRef.current.click();
            }
          }}><Upload size={16} />Thêm ảnh liệu trình</Button>
          <input
            ref={galleryInputRef}
            className="visually-hidden"
            type="file"
            accept="image/png,image/jpeg"
            multiple
            onChange={(event) => {
              const replaceId = event.currentTarget.dataset.replaceId || null;
              const files = replaceId ? [event.currentTarget.files[0]].filter(Boolean) : event.currentTarget.files;
              delete event.currentTarget.dataset.replaceId;
              addTreatmentImages(files, replaceId);
              event.currentTarget.value = '';
            }}
          />
        </header>

        <div className="customer-active-service-gallery__toolbar">
          <label className="customer-active-service-gallery__select-all">
            <input type="checkbox" checked={selectAllChecked} onChange={toggleSelectAll} disabled={!usage.galleryImages.length} />
            Chọn tất cả ảnh
          </label>
          <label className="customer-active-service-gallery__format">
            Định dạng ảnh
            <select value={imageFormat} onChange={(event) => setImageFormat(event.target.value)}>
              <option value="image/png">PNG</option>
              <option value="image/jpeg">JPG</option>
            </select>
          </label>
          <Button variant="secondary" onClick={exportImages} disabled={!selectedGalleryImages.length}><Download size={16} />Tải ảnh đã chọn</Button>
          <Button variant="secondary" onClick={() => exportPdf(selectedGalleryImages.length ? selectedGalleryImages : usage.galleryImages)}><FileText size={16} />Xuất PDF</Button>
        </div>
        <p className="customer-active-service-gallery__export-note">PDF dùng ảnh đã chọn; nếu chưa chọn ảnh, tài liệu sẽ gồm toàn bộ ảnh liệu trình. Khi tải ảnh, trình duyệt có thể yêu cầu cho phép tải nhiều tệp.</p>

        {usage.galleryImages.length ? (
          <div className="customer-active-service-gallery__grid">
            {usage.galleryImages.map((image, index) => (
              <article className="customer-active-service-gallery__item" key={image.id}>
                <label className="customer-active-service-gallery__checkbox" aria-label={`Chọn ${image.name}`}>
                  <input type="checkbox" checked={selectedImages.has(image.id)} onChange={() => toggleSelectedImage(image.id)} />
                </label>
                <button type="button" className="customer-active-service-gallery__preview" onClick={() => openLightbox('treatment', index)} aria-label={`Xem ảnh ${image.name}`}>
                  <img src={image.dataUrl} alt={image.name} />
                </button>
                <div className="customer-active-service-gallery__caption">
                  <span title={image.name}>{image.name}</span>
                  <small>{image.uploadedAt}</small>
                </div>
                <div className="customer-active-service-gallery__actions">
                  <button type="button" onClick={() => {
                    if (galleryInputRef.current) {
                      galleryInputRef.current.dataset.replaceId = image.id;
                      galleryInputRef.current.click();
                    }
                  }}>Cập nhật</button>
                  <button type="button" aria-label={`Xóa ${image.name}`} onClick={() => removeTreatmentImage(image.id)}><Trash2 size={15} /></button>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="customer-active-service-gallery__empty">
            <Images size={34} aria-hidden="true" />
            <strong>Chưa có hình ảnh liệu trình</strong>
            <span>Thêm ảnh thực tế để theo dõi quá trình và kết quả.</span>
          </div>
        )}
      </section>

      <section className="panel customer-active-service-delivery">
        <div className="customer-active-service-delivery__heading">
          <div>
            <h2>Tạo báo cáo theo giai đoạn</h2>
            <p>Chọn các mốc để hệ thống tạo tài liệu và đưa vào hàng chờ gửi.</p>
          </div>
          <span className="customer-active-service-delivery__notice"><Info size={16} />Chưa cấu hình kênh gửi tự động; tài liệu sẽ ở trạng thái chờ gửi.</span>
        </div>
        <div className="customer-active-service-delivery__milestones" aria-label="Mốc tạo báo cáo">
          {Array.from({ length: usage.totalSessions }, (_, index) => index + 1).map((milestone) => (
            <label key={milestone}>
              <input type="checkbox" checked={usage.deliveryMilestones.includes(milestone)} onChange={() => toggleMilestone(milestone)} />
              Sau buổi {milestone}{milestone === usage.totalSessions ? ' · Hoàn thành liệu trình' : ''}
            </label>
          ))}
        </div>
        <div className="customer-active-service-delivery__history">
          <h3>Lịch sử tài liệu</h3>
          {usage.deliveryHistory.length ? (
            <div className="table-scroll" role="region" aria-label="Lịch sử tạo và gửi tài liệu" tabIndex={0}>
              <table className="data-table customer-active-service-delivery__table">
                <thead><tr><th scope="col">Giai đoạn</th><th scope="col">Tài liệu</th><th scope="col">Thời gian</th><th scope="col">Trạng thái</th><th scope="col">Tác vụ</th></tr></thead>
                <tbody>{usage.deliveryHistory.map((entry) => (
                  <tr key={entry.id}>
                    <td>{entry.stage}</td><td>{entry.document}</td><td>{entry.createdAt}</td>
                    <td><StatusBadge tone="warning">{entry.status}</StatusBadge></td>
                    <td><button className="table-link" type="button" onClick={() => exportPdf(usage.galleryImages, entry.stage)}>Tải PDF</button></td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          ) : <p className="customer-active-service-delivery__empty">Chưa có mốc nào được hoàn thành để tạo tài liệu.</p>}
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

            <section className="customer-service-session-card customer-service-session-card--notes">
              <h3>Ghi chú</h3>
              <textarea
                value={selectedSession.notes || ''}
                aria-label="Ghi chú của buổi thực hiện"
                onChange={(event) => updateSession(selectedSession.number, { notes: event.target.value })}
                placeholder="Nhập ghi chú cho buổi thực hiện..."
              />
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
