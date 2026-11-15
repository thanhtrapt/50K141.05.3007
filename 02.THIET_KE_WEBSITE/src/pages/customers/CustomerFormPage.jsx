import { useEffect, useState } from 'react';
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
  const parts = value.split('-');
  return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : value;
}

export default function CustomerFormPage({ record, nextId, onCancel, onSave, onAddPurchases, draft, draftPurchases }) {
  const [form, setForm] = useState(emptyCustomer);
  const [purchases, setPurchases] = useState([]);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [formError, setFormError] = useState('');
  const { showDialog } = useFeedback();

  useEffect(() => {
    setForm(record
      ? { name: record.name, birthday: toInputDate(record.birthday), phone: record.phone }
      : { ...emptyCustomer, ...(draft ?? {}) });
    setPurchases(draftPurchases ?? record?.purchases ?? []);
  }, [record?.id, draft?.name, draft?.birthday, draft?.phone, draftPurchases]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!form.name.trim() || !form.birthday || !form.phone) { setFormError('Vui lòng nhập đầy đủ thông tin khách hàng.'); return; }
    if (!/^\d{10}$/.test(form.phone)) { setFormError('Số điện thoại gồm 10 chữ số.'); return; }
    setFormError('');
    try {
      await onSave({ ...form, birthday: toDisplayDate(form.birthday), purchases });
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
            {record && <TextField label="Số lần hủy lịch" value={record.cancellationCount ?? ''} readOnly />}
          </div>
        </section>

        <div className="customer-form__service-grid">
          <section className="panel customer-form__section">
            <h2>Dịch vụ đang sử dụng</h2>
            <p>Chưa có dịch vụ đang sử dụng</p>
          </section>
          <section className="panel customer-form__section">
            <h2>Dịch vụ phát sinh</h2>
            <p>Chưa có dịch vụ phát sinh</p>
          </section>
        </div>

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
            rows={purchases}
            rowKey="id"
            emptyMessage="Chưa có sản phẩm mua thêm"
          />
        </section>

        <section className="panel customer-form__section customer-form__history">
          <div className="customer-form__section-heading">
            <h2>Lịch sử dịch vụ</h2>
            <span className="muted-copy">Chưa có lịch sử dịch vụ</span>
          </div>
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
