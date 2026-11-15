import { useState } from 'react';
import ConfirmDialog from '../../components/ui/ConfirmDialog.jsx';
import DataTable from '../../components/ui/DataTable.jsx';
import PageHeader from '../../components/ui/PageHeader.jsx';
import { ActionGroup, DeleteButton, EditButton } from '../../components/ui/ActionButtons.jsx';
import { formatCurrency } from '../../data/mockData.js';

export default function ProductDetailPage({ product, onBack, onEdit, onDelete, fallbackPath = '/my-pham' }) {
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  // Mã lô dự phòng theo đúng định dạng ddMMyy-NNN (10 ký tự) khi sản phẩm chưa có lô.
  const lotSuffix = String(product.id).replace(/\D/g, '').slice(-3).padStart(3, '0');
  const lots = product.lots ?? [{
    lot: `150526-${lotSuffix}`,
    made: '15/05/2026',
    expiry: '15/05/2027',
    stock: product.stock,
  }];

  return (
    <div className="page-stack product-detail-page">
      <PageHeader
        title="CHI TIẾT SẢN PHẨM"
        fallbackPath={fallbackPath}
        onBack={onBack}
      />
      <section className="panel product-detail-page__overview">
        <div className="product-detail-page__image">
          {product.image && <img src={product.image} alt={product.name} />}
        </div>
        <div className="product-detail-page__information">
          <ActionGroup className="product-detail-page__actions">
            <EditButton onClick={onEdit} />
            <DeleteButton onClick={() => setDeleteConfirmOpen(true)} />
          </ActionGroup>
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
            { key: 'lot', label: 'Lô', width: '22%', align: 'center' },
            { key: 'made', label: 'Ngày sản xuất', width: '26%', align: 'center' },
            { key: 'expiry', label: 'Hạn sử dụng', width: '26%', align: 'center' },
            { key: 'stock', label: 'Tồn kho', width: '26%', align: 'center' },
          ]}
          rows={lots}
          rowKey="lot"
        />
      </section>

      <ConfirmDialog open={deleteConfirmOpen} title="Xóa mỹ phẩm" message="Bạn có chắc chắn muốn xóa mỹ phẩm này không?" onCancel={() => setDeleteConfirmOpen(false)} onConfirm={onDelete} confirmLabel="Xóa" cancelLabel="Hủy" danger />
    </div>
  );
}
