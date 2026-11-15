import { useEffect, useState } from 'react';
import Button from '../../components/ui/Button.jsx';
import DataTable from '../../components/ui/DataTable.jsx';
import Modal from '../../components/ui/Modal.jsx';
import PageHeader from '../../components/ui/PageHeader.jsx';
import SelectField from '../../components/ui/SelectField.jsx';
import TextField from '../../components/ui/TextField.jsx';
import { formatCurrency, products } from '../../data/mockData.js';

const emptyCustomer = { name: '', birthday: '', phone: '' };

function toInputDate(value = '') {
  const parts = value.split('/');
  return parts.length === 3 ? `${parts[2]}-${parts[1]}-${parts[0]}` : '';
}

function toDisplayDate(value = '') {
  const parts = value.split('-');
  return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : value;
}

export default function CustomerFormPage({ record, nextId, onCancel, onSave }) {
  const [form, setForm] = useState(emptyCustomer);
  const [purchases, setPurchases] = useState([]);
  const [purchaseModalOpen, setPurchaseModalOpen] = useState(false);
  const [purchaseForm, setPurchaseForm] = useState({ product: '', quantity: '', date: '' });

  useEffect(() => {
    setForm(record
      ? { name: record.name, birthday: toInputDate(record.birthday), phone: record.phone }
      : emptyCustomer);
    setPurchases(record?.purchases ?? []);
  }, [record?.id]);

  const handleSubmit = (event) => {
    event.preventDefault();
    onSave({ ...form, birthday: toDisplayDate(form.birthday), purchases });
  };

  const addPurchase = (event) => {
    event.preventDefault();
    const product = products.find((item) => item.id === purchaseForm.product);
    if (!product) return;
    const quantity = Number(purchaseForm.quantity);
    const date = toDisplayDate(purchaseForm.date);
    setPurchases((current) => [...current, {
      id: `${product.id}-${Date.now()}`,
      date,
      product: product.name,
      quantity: `${quantity} ${product.unit ?? 'chai'}`,
      price: formatCurrency(product.price),
      total: formatCurrency(product.price * quantity),
    }]);
    setPurchaseModalOpen(false);
    setPurchaseForm({ product: '', quantity: '', date: '' });
  };

  return (
    <div className="page-stack customer-form-page">
      <PageHeader title={record ? 'CHỈNH SỬA HỒ SƠ KHÁCH HÀNG' : 'TẠO HỒ SƠ KHÁCH HÀNG'} />
      <form className="customer-form" onSubmit={handleSubmit}>
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
            <Button type="button" variant="secondary" onClick={() => { setPurchaseForm({ product: '', quantity: '', date: '' }); setPurchaseModalOpen(true); }}>+ Ghi nhận sản phẩm bán lẻ</Button>
          </div>
          <DataTable
            columns={[
              { key: 'date', label: 'Ngày mua', width: '16%', align: 'center' },
              { key: 'product', label: 'Tên sản phẩm', width: '34%' },
              { key: 'quantity', label: 'Số lượng', width: '14%', align: 'center' },
              { key: 'price', label: 'Giá', width: '18%', align: 'right' },
              { key: 'total', label: 'Thành tiền', width: '18%', align: 'right' },
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
          <Button variant="secondary" onClick={onCancel}>Hủy</Button>
          <Button type="submit">{record ? 'Lưu thay đổi' : 'Lưu hồ sơ'}</Button>
        </div>
      </form>

      <Modal open={purchaseModalOpen} title="GHI NHẬN SẢN PHẨM BÁN LẺ" onClose={() => setPurchaseModalOpen(false)} size="medium">
        <form className="form-grid" onSubmit={addPurchase}>
          <TextField label="Ngày mua *" type="date" value={purchaseForm.date} onChange={(event) => setPurchaseForm({ ...purchaseForm, date: event.target.value })} required />
          <SelectField label="Tên sản phẩm *" value={purchaseForm.product} onChange={(event) => setPurchaseForm({ ...purchaseForm, product: event.target.value })} options={[{ value: '', label: 'Chọn sản phẩm' }, ...products.map((product) => ({ value: product.id, label: product.name }))]} required />
          <TextField label="Số lượng *" type="number" min="1" value={purchaseForm.quantity} onChange={(event) => setPurchaseForm({ ...purchaseForm, quantity: event.target.value })} required />
          {purchaseForm.product && <TextField label="Giá bán" value={formatCurrency(products.find((product) => product.id === purchaseForm.product)?.price ?? 0)} readOnly />}
          {purchaseForm.product && purchaseForm.quantity !== '' && <TextField label="Thành tiền" value={formatCurrency((products.find((product) => product.id === purchaseForm.product)?.price ?? 0) * Number(purchaseForm.quantity))} readOnly />}
          <div className="modal-form-actions form-grid__wide">
            <Button variant="secondary" onClick={() => setPurchaseModalOpen(false)}>Hủy</Button>
            <Button type="submit">Thêm sản phẩm</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
