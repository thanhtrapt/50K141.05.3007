import { useEffect, useState } from 'react';
import { Pencil } from 'lucide-react';
import { Link } from 'react-router-dom';
import Button from '../../components/ui/Button.jsx';
import ConfirmDialog from '../../components/ui/ConfirmDialog.jsx';
import { useFeedback } from '../../components/ui/FeedbackContext.jsx';
import DataTable from '../../components/ui/DataTable.jsx';
import PageHeader from '../../components/ui/PageHeader.jsx';
import TextField from '../../components/ui/TextField.jsx';
import { formatCurrency } from '../../data/mockData.js';

const emptyCustomer = { name: '', birthday: '', phone: '' };

function toInputDate(value = '') {
  const parts = value.split('/');
  return parts.length === 3 ? `${parts[2]}-${parts[1]}-${parts[0]}` : '';
}

function toDisplayDate(value = '') {
  const dateValue = value instanceof Date ? value.toISOString().slice(0, 10) : String(value);
  const parts = dateValue.slice(0, 10).split('-');
  return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : value;
}

export default function CustomerFormPage({ record, nextId, onCancel, onSave, onAddPurchases, serviceUsagePath, returnPath, draft, draftPurchases }) {
  const [form, setForm] = useState(emptyCustomer);
  const [purchases, setPurchases] = useState([]);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [formError, setFormError] = useState('');
  const { showDialog } = useFeedback();

  useEffect(() => {
    setForm(record
      ? { name: record.name, birthday: toInputDate(record.birthday), phone: record.phone, cancellationCount: String(record.cancellationCount ?? 0) }
      : { ...emptyCustomer, ...(draft ?? {}) });
    setPurchases(draftPurchases ?? record?.purchases ?? []);
  }, [record?.id, draft?.name, draft?.birthday, draft?.phone, draftPurchases]);

  const readOnlyPurchases = record
    ? (record.purchasedProducts ?? record.purchasedSales?.flatMap((sale) => (sale.items ?? []).map((item) => ({ ...item, purchaseDate: sale.purchaseDate }))) ?? []).map((item, index) => ({
      id: item.id ?? item.lineId ?? `${item.saleId ?? 'sale'}-${index}`,
      date: toDisplayDate(item.purchaseDate),
      product: item.cosmeticName ?? item.product ?? '—',
      quantity: item.quantity ?? '—',
      price: formatCurrency(item.unitPrice ?? item.price ?? 0),
      total: formatCurrency(item.lineTotal ?? item.total ?? 0),
    }))
    : purchases;

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!form.name.trim() || !form.birthday || !form.phone) { setFormError('Vui lòng nhập đầy đủ thông tin khách hàng.'); return; }
    if (!/^\d{10}$/.test(form.phone)) { setFormError('Số điện thoại gồm 10 chữ số.'); return; }
    if (record && (!/^\d+$/.test(String(form.cancellationCount)) || Number(form.cancellationCount) < 0 || !Number.isSafeInteger(Number(form.cancellationCount)))) { setFormError('Số lần hủy lịch phải là số nguyên không âm.'); return; }
    setFormError('');
    try {
      const payload = { ...form, birthday: toDisplayDate(form.birthday) };
      if (record) {
        payload.cancellationCount = Number(form.cancellationCount);
      }
      if (!record) payload.purchases = purchases;
      await onSave(payload);
    } catch (error) {
      console.error('[customers] Không thể lưu hồ sơ khách hàng:', error);
      showDialog({ message: record ? 'Không thể cập nhật hồ sơ khách hàng. Vui lòng thử lại sau!' : 'Không thể tạo hồ sơ khách hàng. Vui lòng thử lại sau!' });
    }
  };

  return (
    <div className="page-stack customer-form-page">
      <PageHeader
        title={record ? 'CHỈNH SỬA HỒ SƠ KHÁCH HÀNG' : 'TẠO HỒ SƠ KHÁCH HÀNG'}
        fallbackPath="/khach-hang"
        onBack={() => setCancelOpen(true)}
      />
      <form className="customer-form" onSubmit={handleSubmit} noValidate>
        {formError && <div className="customer-form__error" role="alert">{formError}</div>}
        {record?.blacklisted && <div className="customer-form__blacklist" role="alert">Khách hàng thuộc danh sách đen!</div>}
        <section className="panel customer-form__personal">
          <h2>Thông tin cá nhân</h2>
          <div className="form-grid customer-form__personal-grid">
            <TextField label="Mã khách hàng" value={record?.id ?? nextId} readOnly />
            <TextField label="Họ và tên *" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Nhập họ và tên" required />
            <TextField label="Ngày sinh *" type="date" value={form.birthday} onChange={(event) => setForm({ ...form, birthday: event.target.value })} required />
            <TextField label="Số điện thoại *" type="tel" inputMode="numeric" pattern="[0-9]{10}" title="Số điện thoại gồm 10 chữ số" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} placeholder="Nhập số điện thoại gồm 10 chữ số" required />
            {record && <TextField label="Số lần hủy lịch" type="number" min="0" step="1" value={form.cancellationCount ?? ''} onChange={(event) => setForm({ ...form, cancellationCount: event.target.value })} />}
          </div>
        </section>

        <section className="panel customer-form__section customer-form__readonly-history">
          <h2>Dịch vụ đang sử dụng</h2>
          {(record?.activeServices ?? []).length ? record.activeServices.map((service) => (
            <p key={service.id}>
              <strong>{service.serviceName}</strong>
              <span>{formatCurrency(service.purchasePrice)} · {service.sessionsCompleted}/{service.totalSessions} buổi · {service.completionStatus}</span>
              {serviceUsagePath && <Link className="btn-action btn-action--edit" to={`${serviceUsagePath}?packageId=${encodeURIComponent(service.id)}`} state={{ returnPath }} aria-label={`Chỉnh sửa dịch vụ ${service.serviceName}`} style={{ width: 'fit-content', height: 30, minHeight: 30, padding: '0 9px', fontSize: 12 }}><Pencil className="btn-action__icon" size={13} /><span>Chỉnh sửa</span></Link>}
            </p>
          )) : <p>Chưa có dịch vụ đang sử dụng</p>}
        </section>

        <section className="panel customer-form__section customer-form__purchases">
          <div className="customer-form__section-heading">
            <h2>Sản phẩm mua thêm</h2>
            {onAddPurchases && <Button type="button" variant="secondary" onClick={() => onAddPurchases(form, purchases)}>+ Ghi nhận mua thêm</Button>}
          </div>
          <DataTable
            columns={[
              { key: 'date', label: 'Ngày mua', width: '16%', align: 'center' },
              { key: 'product', label: 'Tên sản phẩm', width: '36%' },
              { key: 'quantity', label: 'Số lượng', width: '14%', align: 'center' },
              { key: 'price', label: 'Giá', width: '17%', align: 'right', nowrap: true },
              { key: 'total', label: 'Thành tiền', width: '17%', align: 'right', nowrap: true },
            ]}
            rows={readOnlyPurchases}
            rowKey="id"
            emptyMessage="Chưa có sản phẩm mua thêm"
          />
        </section>

        <section className="panel customer-form__section customer-form__history">
          <div className="customer-form__section-heading">
            <h2>Lịch sử dịch vụ</h2>
            <span className="muted-copy">{record?.serviceHistory?.length ? `${record.serviceHistory.length} liệu trình đã hoàn thành` : 'Chưa có lịch sử dịch vụ'}</span>
          </div>
          {record?.serviceHistory?.map((service) => <p key={service.id}>{service.serviceName} · {service.sessionsCompleted}/{service.totalSessions} buổi · {service.completionStatus}</p>)}
        </section>

        <div className="form-actions customer-form__actions">
          <Button variant="secondary" onClick={() => setCancelOpen(true)}>Hủy</Button>
          <Button type="submit">{record ? 'Lưu thay đổi' : 'Lưu hồ sơ'}</Button>
        </div>
      </form>

      <ConfirmDialog open={cancelOpen} title="Xác nhận hủy" message="Các thay đổi sẽ không được lưu. Bạn có chắc chắn muốn hủy?" onCancel={() => setCancelOpen(false)} onConfirm={onCancel} />
    </div>
  );
}
