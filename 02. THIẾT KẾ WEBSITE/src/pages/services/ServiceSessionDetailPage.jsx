import { useState } from 'react';
import { ArrowLeft, Pencil, Trash2 } from 'lucide-react';
import Button from '../../components/ui/Button.jsx';
import Modal from '../../components/ui/Modal.jsx';
import PageHeader from '../../components/ui/PageHeader.jsx';
import { formatCurrency } from '../../data/mockData.js';

export default function ServiceSessionDetailPage({ service, sessionNumber, onBack, onEdit, onDelete }) {
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const session = service.sessionDetails?.[sessionNumber - 1];
  const entries = session?.entries ?? [];

  return (
    <div className="page-stack service-session-detail-page">
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
      <section className="panel service-session-detail__panel">
        <div className="service-detail__section-heading">
          <h2>Chi tiết buổi thực hiện</h2>
          <div className="service-detail__actions">
            <Button variant="secondary" onClick={onEdit}><Pencil size={16} />Chỉnh sửa</Button>
            <Button variant="secondary" className="service-detail__delete" onClick={() => setDeleteConfirmOpen(true)}><Trash2 size={16} />Xóa</Button>
          </div>
        </div>
        <div className="service-session-detail__title">
          <span className="service-detail__session-number">Buổi {sessionNumber}</span>
          <strong>{session?.name || `Buổi ${sessionNumber}`}</strong>
          <span>{session?.minutes ? `${session.minutes} phút` : '—'}</span>
        </div>
        <div className="service-session-detail__columns">
          <section>
            <h3>Kỹ thuật thực hiện</h3>
            {entries.length ? <ul>{entries.map((entry, index) => <li key={`${entry.technique}-${index}`}>{entry.technique}</li>)}</ul> : <p>Chưa có kỹ thuật thực hiện.</p>}
          </section>
          <section>
            <h3>Mỹ phẩm sử dụng</h3>
            {entries.length ? <ol>{entries.map((entry, index) => <li key={`${entry.product}-${index}`}>{entry.product}</li>)}</ol> : <p>Chưa có mỹ phẩm được ghi nhận.</p>}
          </section>
          <section>
            <h3>Định lượng sản phẩm</h3>
            {entries.length ? <ol>{entries.map((entry, index) => <li key={`${entry.amount}-${index}`}>{entry.amount}</li>)}</ol> : <p>Chưa có định lượng.</p>}
          </section>
        </div>
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
