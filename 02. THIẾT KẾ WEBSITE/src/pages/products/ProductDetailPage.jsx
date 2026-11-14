import { useState } from 'react';
import { ArrowLeft, Pencil, Trash2 } from 'lucide-react';
import Button from '../../components/ui/Button.jsx';
import DataTable from '../../components/ui/DataTable.jsx';
import Modal from '../../components/ui/Modal.jsx';
import PageHeader from '../../components/ui/PageHeader.jsx';
import { formatCurrency } from '../../data/mockData.js';

export default function ProductDetailPage({ product, onBack, onEdit, onDelete }) {
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const lots = product.lots ?? [{
    lot: `${product.id}-01`,
    made: '15/05/2026',
    expiry: '15/05/2027',
    stock: product.stock,
  }];

  return (
    <div className="page-stack product-detail-page">
      <PageHeader
        title="CHI TIẾT SẢN PHẨM"
        actions={<Button variant="secondary" onClick={onBack}><ArrowLeft size={17} />Quay lại danh sách</Button>}
      />
      <section className="panel product-detail-page__overview">
        <div className="product-detail-page__image">
          {product.image && <img src={product.image} alt={product.name} />}
        </div>
        <div className="product-detail-page__information">
          <div className="product-detail-page__actions">
            <Button variant="secondary" onClick={onEdit}><Pencil size={16} />Chỉnh sửa</Button>
            <Button variant="danger" onClick={() => setDeleteConfirmOpen(true)}><Trash2 size={16} />Xóa</Button>
          </div>
          <dl className="product-detail-page__facts">
            <div><dt>Tên sản phẩm</dt><dd>{product.name}</dd></div>
            <div><dt>Mã MP</dt><dd>{product.id}</dd></div>
            <div><dt>Phân loại</dt><dd>{product.category || '—'}</dd></div>
            <div><dt>Tồn kho</dt><dd>{product.stock}</dd></div>
            <div><dt>Đơn vị tính</dt><dd>{product.unit || 'Chai'}</dd></div>
            <div><dt>Giá bán</dt><dd>{formatCurrency(product.price)}</dd></div>
            <div className="product-detail-page__description"><dt>Mô tả</dt><dd>{product.description || '—'}</dd></div>
          </dl>
        </div>
      </section>

      <section className="panel product-detail-page__lots">
        <div className="product-detail-page__lots-heading">
          <h2>Danh sách lô hàng</h2>
          <span>Tổng tồn kho: <strong>{product.stock}</strong></span>
        </div>
        <DataTable
          columns={[
            { key: 'lot', label: 'Lô', width: '22%' },
            { key: 'made', label: 'Ngày sản xuất', width: '27%' },
            { key: 'expiry', label: 'Hạn sử dụng', width: '27%' },
            { key: 'stock', label: 'Tồn kho', width: '24%' },
          ]}
          rows={lots}
          rowKey="lot"
        />
      </section>

      <Modal open={deleteConfirmOpen} title="XÓA THÔNG TIN MỸ PHẨM" onClose={() => setDeleteConfirmOpen(false)} size="small">
        <div className="confirm-content">
          <p>Bạn có chắc chắn muốn xóa mỹ phẩm <strong>{product.name}</strong> không?</p>
          <div className="modal-form-actions">
            <Button variant="secondary" onClick={() => setDeleteConfirmOpen(false)}>Hủy</Button>
            <Button variant="danger" onClick={onDelete}>Xóa</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
