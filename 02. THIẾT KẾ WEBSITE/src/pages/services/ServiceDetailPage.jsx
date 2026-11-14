import { useMemo, useState } from 'react';
import { ArrowLeft, Pencil, Trash2 } from 'lucide-react';
import Button from '../../components/ui/Button.jsx';
import Modal from '../../components/ui/Modal.jsx';
import PageHeader from '../../components/ui/PageHeader.jsx';
import { formatCurrency } from '../../data/mockData.js';

export default function ServiceDetailPage({ service, onBack, onEdit, onDelete, onSessionDetail }) {
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const sessions = useMemo(() => {
    if (service.sessionDetails?.length) return service.sessionDetails;
    return Array.from({ length: Number(service.sessions) || 0 }, () => null);
  }, [service]);

  return (
    <div className="page-stack service-detail-page">
      <PageHeader
        title="CHI TIẾT DỊCH VỤ"
        actions={<Button variant="secondary" onClick={onBack}><ArrowLeft size={17} />Quay lại</Button>}
      />

      <section className="panel service-detail__general">
        <h2>Thông tin chung</h2>
        <dl className="service-detail__facts">
          <div><dt>Mã dịch vụ</dt><dd>{service.id}</dd></div>
          <div><dt>Tên dịch vụ</dt><dd>{service.name}</dd></div>
          <div><dt>Giá dịch vụ</dt><dd>{formatCurrency(service.price)}</dd></div>
          <div><dt>Số buổi thực hiện</dt><dd>{service.sessions}</dd></div>
        </dl>
      </section>

      <section className="panel service-detail__sessions">
        <div className="service-detail__section-heading">
          <h2>Buổi thực hiện</h2>
          <div className="service-detail__actions">
            <Button variant="secondary" onClick={onEdit}><Pencil size={16} />Chỉnh sửa</Button>
            <Button variant="secondary" className="service-detail__delete" onClick={() => setDeleteConfirmOpen(true)}><Trash2 size={16} />Xóa</Button>
          </div>
        </div>
        {sessions.length ? (
          <div className="service-detail__session-grid">
            {sessions.map((session, index) => (
              <article className="service-detail__session-card" key={`session-${index}`}>
                <span className="service-detail__session-number">Buổi {index + 1}</span>
                <strong>{session?.name || `Buổi ${index + 1}`}</strong>
                <div><b>Thời gian</b><span>{session?.minutes ? `${session.minutes} phút` : '—'}</span></div>
                <Button variant="secondary" onClick={() => onSessionDetail(index + 1)}>Xem chi tiết</Button>
              </article>
            ))}
          </div>
        ) : (
          <p className="muted-copy">Chưa có thông tin buổi thực hiện.</p>
        )}
      </section>

      <section className="panel service-detail__result">
        <h2>Kết quả dịch vụ</h2>
        <p>{service.result || 'Chưa có kết quả dịch vụ.'}</p>
      </section>

      <Modal open={deleteConfirmOpen} title="XÓA THÔNG TIN DỊCH VỤ" onClose={() => setDeleteConfirmOpen(false)} size="small">
        <div className="confirm-content">
          <p>Bạn có chắc chắn muốn xóa dịch vụ <strong>{service.name}</strong> không?</p>
          <div className="modal-form-actions">
            <Button variant="secondary" onClick={() => setDeleteConfirmOpen(false)}>Hủy</Button>
            <Button variant="danger" onClick={onDelete}>Xóa</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
