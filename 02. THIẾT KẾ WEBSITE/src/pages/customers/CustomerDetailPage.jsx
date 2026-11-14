import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Pencil, Trash2 } from 'lucide-react';
import Button from '../../components/ui/Button.jsx';
import DataTable from '../../components/ui/DataTable.jsx';
import Modal from '../../components/ui/Modal.jsx';
import PageHeader from '../../components/ui/PageHeader.jsx';

export default function CustomerDetailPage({ customer, onBack, onEdit, onDelete }) {
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const purchases = customer.purchases ?? [{
    date: '—',
    product: 'Serum phục hồi B5',
    quantity: '2 chai',
    price: '—',
    total: '—',
  }];

  return (
    <div className="page-stack customer-detail-page">
      <PageHeader
        title="CHI TIẾT HỒ SƠ KHÁCH HÀNG"
        actions={<Button variant="secondary" onClick={onBack}><ArrowLeft size={17} />Quay lại danh sách</Button>}
      />
      {customer.blacklisted && <div className="customer-detail__alert" role="status">Khách hàng thuộc danh sách đen!</div>}

      <section className="panel customer-profile-panel">
        <div className="customer-profile-panel__heading">
          <span className="customer-detail__avatar" aria-hidden="true">{customer.name.slice(0, 1)}</span>
          <div>
            <small>Mã khách hàng: {customer.id}</small>
            <h2>{customer.name}</h2>
          </div>
          <div className="customer-detail__actions">
            <Button variant="secondary" onClick={onEdit}><Pencil size={16} />Chỉnh sửa</Button>
            <Button variant="danger" onClick={() => setDeleteConfirmOpen(true)}><Trash2 size={16} />Xóa</Button>
          </div>
        </div>
        <dl className="customer-profile-facts">
          <div><dt>Ngày sinh</dt><dd>{customer.birthday || '—'}</dd></div>
          <div><dt>Số điện thoại</dt><dd>{customer.phone}</dd></div>
          <div><dt>Số lần đến</dt><dd>{customer.visits} lần</dd></div>
        </dl>
      </section>

      <div className="customer-detail__sections">
        <section className="panel customer-detail__section">
          <h2>Dịch vụ đang sử dụng</h2>
          <div className="customer-detail__rows">
            <p><span>Liệu trình chăm sóc da cơ bản</span><Link className="text-link" to="/dich-vu/DV002">Xem chi tiết</Link></p>
          </div>
        </section>

        <section className="panel customer-detail__section">
          <h2>Dịch vụ phát sinh</h2>
          <p className="customer-detail__empty">Chưa có dịch vụ phát sinh</p>
        </section>
      </div>

      <section className="panel customer-detail__section customer-detail__purchases">
        <h2>Sản phẩm mua thêm</h2>
        <DataTable
          columns={[
            { key: 'date', label: 'Ngày mua', width: '18%' },
            { key: 'product', label: 'Tên sản phẩm', width: '30%' },
            { key: 'quantity', label: 'Số lượng', width: '16%' },
            { key: 'price', label: 'Giá', width: '16%' },
            { key: 'total', label: 'Thành tiền', width: '20%' },
          ]}
          rows={purchases}
          emptyMessage="Chưa có sản phẩm mua thêm"
        />
      </section>

      <section className="panel customer-detail__section">
        <div className="customer-detail__section-heading">
          <h2>Lịch sử dịch vụ</h2>
          <Link className="text-link" to="/dich-vu/DV002">Xem chi tiết ›</Link>
        </div>
        <p>Buổi 2 · Đã hoàn thành · 21/10/2026</p>
      </section>

      <Modal open={deleteConfirmOpen} title="XÓA HỒ SƠ KHÁCH HÀNG" onClose={() => setDeleteConfirmOpen(false)} size="small">
        <div className="confirm-content">
          <p>Bạn có chắc chắn muốn xóa hồ sơ khách hàng <strong>{customer.name}</strong> không?</p>
          <div className="modal-form-actions">
            <Button variant="secondary" onClick={() => setDeleteConfirmOpen(false)}>Hủy</Button>
            <Button variant="danger" onClick={onDelete}>Xóa</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
