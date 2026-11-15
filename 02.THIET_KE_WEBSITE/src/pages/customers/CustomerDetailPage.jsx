import { useState } from 'react';
import { Link } from 'react-router-dom';
import ConfirmDialog from '../../components/ui/ConfirmDialog.jsx';
import DataTable from '../../components/ui/DataTable.jsx';
import PageHeader from '../../components/ui/PageHeader.jsx';
import { ActionGroup, DeleteButton, EditButton } from '../../components/ui/ActionButtons.jsx';
import { formatCurrency } from '../../data/mockData.js';

export default function CustomerDetailPage({ customer, onBack, onEdit, onDelete, serviceUsagePath, fallbackPath = '/khach-hang' }) {
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const purchases = (customer.purchasedProducts ?? []).map((item) => ({
    id: item.saleId,
    date: item.purchaseDate ? new Date(item.purchaseDate).toLocaleDateString('vi-VN') : '—',
    product: item.cosmeticName,
    quantity: item.quantity,
    price: formatCurrency(item.unitPrice),
    total: formatCurrency(item.lineTotal),
  }));
  const activeServices = customer.activeServices ?? [];
  const serviceHistory = customer.serviceHistory ?? [];
  const visits = serviceHistory.reduce((total, item) => total + Number(item.sessionsCompleted || 0), 0);

  return (
    <div className="page-stack customer-detail-page">
      <PageHeader
        title="CHI TIẾT HỒ SƠ KHÁCH HÀNG"
        fallbackPath={fallbackPath}
        onBack={onBack}
      />
      {customer.isBlacklisted && <div className="customer-detail__alert" role="status">Khách hàng thuộc danh sách đen!</div>}

      <section className="panel customer-profile-panel">
        <div className="customer-profile-panel__heading">
          <span className="customer-detail__avatar" aria-hidden="true">{customer.name.slice(0, 1)}</span>
          <div>
            <small>Mã khách hàng: {customer.id}</small>
            <h2>{customer.name}</h2>
          </div>
          <ActionGroup className="customer-detail__actions">
            <EditButton onClick={onEdit} />
            <DeleteButton onClick={() => setDeleteConfirmOpen(true)} />
          </ActionGroup>
        </div>
        <dl className="customer-profile-facts">
          <div><dt>Ngày sinh</dt><dd>{customer.dateOfBirth?.split('-').reverse().join('/') || customer.birthday || '—'}</dd></div>
          <div><dt>Số điện thoại</dt><dd>{customer.phone}</dd></div>
          <div><dt>Số buổi đã thực hiện</dt><dd>{visits} buổi</dd></div>
        </dl>
      </section>

      <div className="customer-detail__sections">
        <section className="panel customer-detail__section">
          <h2>Dịch vụ đang sử dụng</h2>
          <div className="customer-detail__rows">
            {activeServices.length ? activeServices.map((service) => (
              <p key={service.id}><span>{service.serviceName}</span><Link className="text-link" to={`${serviceUsagePath}?packageId=${encodeURIComponent(service.id)}`}>Chi tiết</Link></p>
            )) : <p className="customer-detail__empty">Chưa có dịch vụ đang sử dụng</p>}
          </div>
        </section>

        <section className="panel customer-detail__section">
          <h2>Dịch vụ phát sinh</h2>
          <p className="customer-detail__empty">{serviceHistory.length ? `${serviceHistory.length} liệu trình đã ghi nhận` : 'Chưa có dịch vụ phát sinh'}</p>
        </section>
      </div>

      <section className="panel customer-detail__section customer-detail__purchases">
        <h2>Sản phẩm mua thêm</h2>
        <DataTable
          columns={[
            { key: 'date', label: 'Ngày mua', width: '16%', align: 'center' },
            { key: 'product', label: 'Tên sản phẩm', width: '36%' },
            { key: 'quantity', label: 'Số lượng', width: '14%', align: 'center' },
            { key: 'price', label: 'Giá', width: '17%', align: 'right', nowrap: true },
            { key: 'total', label: 'Thành tiền', width: '17%', align: 'right', nowrap: true },
          ]}
          rows={purchases}
          emptyMessage="Chưa có sản phẩm mua thêm"
        />
      </section>

      <section className="panel customer-detail__section">
        <div className="customer-detail__section-heading">
          <h2>Lịch sử dịch vụ</h2>
          <span>{serviceHistory.length} liệu trình</span>
        </div>
        {serviceHistory.length ? serviceHistory.map((service) => (
          <p key={service.id}>{service.serviceName} · {service.sessionsCompleted}/{service.totalSessions} buổi · {service.completionStatus}</p>
        )) : <p>Chưa có lịch sử dịch vụ.</p>}
      </section>

      <ConfirmDialog open={deleteConfirmOpen} title="Xóa hồ sơ khách hàng" message="Bạn có chắc chắn muốn xóa hồ sơ khách hàng này?" onCancel={() => setDeleteConfirmOpen(false)} onConfirm={onDelete} confirmLabel="Xóa" cancelLabel="Hủy" danger />
    </div>
  );
}
