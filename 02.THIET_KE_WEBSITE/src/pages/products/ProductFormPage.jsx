import { useEffect, useRef, useState } from 'react';
import { ImagePlus } from 'lucide-react';
import Button from '../../components/ui/Button.jsx';
import ConfirmDialog from '../../components/ui/ConfirmDialog.jsx';
import PageHeader from '../../components/ui/PageHeader.jsx';
import SelectField from '../../components/ui/SelectField.jsx';
import TextField from '../../components/ui/TextField.jsx';

const units = ['Chai', 'Hộp', 'Lọ', 'Tuýp'];

function TextAreaField({ label, value, onChange, placeholder, className = '' }) {
  return (
    <label className={`field ${className}`.trim()}>
      <span className="field__label">{label}</span>
      <textarea className="field__control product-form-page__textarea" value={value} onChange={onChange} placeholder={placeholder} />
    </label>
  );
}

export default function ProductFormPage({ record, nextId, categories, onCancel, onSave }) {
  const fileInput = useRef(null);
  const [form, setForm] = useState({ name: '', category: '', unit: '', stock: 0, price: '', image: '', description: '' });
  const [cancelOpen, setCancelOpen] = useState(false);
  const [formError, setFormError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});

  useEffect(() => {
    setForm(record
      ? {
          name: record.name,
          category: record.category,
          unit: record.unit ?? 'Chai',
          stock: record.stock ?? 0,
          price: String(record.price),
          image: record.image ?? '',
          description: record.description ?? '',
        }
      : { name: '', category: '', unit: '', stock: 0, price: '', image: '', description: '' });
  }, [record?.id]);

  const handleImageChange = (event) => {
    const [file] = event.target.files ?? [];
    if (!file) return;

    const reader = new FileReader();
    reader.addEventListener('load', () => setForm((current) => ({ ...current, image: String(reader.result ?? '') })), { once: true });
    reader.readAsDataURL(file);
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    if (!form.name.trim()) {
      setFormError('Thông tin chưa hợp lệ, yêu cầu nhập lại');
      setFieldErrors({ name: 'Tên sản phẩm không được bỏ trống' });
      return;
    }
    if (!form.price || Number(form.price) <= 0) {
      setFormError('Thông tin chưa hợp lệ, yêu cầu nhập lại');
      setFieldErrors({ price: 'Giá bán không được là số âm' });
      return;
    }
    setFormError('');
    setFieldErrors({});
    onSave({ ...form, price: Number(form.price), stock: Number(form.stock) });
  };

  return (
    <div className="page-stack product-form-page">
      <PageHeader title={record ? 'SỬA THÔNG TIN MỸ PHẨM' : 'TẠO THÔNG TIN MỸ PHẨM'} />
      <form className="panel product-form-page__panel" onSubmit={handleSubmit} noValidate>
        {formError && <div className="product-form-page__error" role="alert"><span aria-hidden="true">⚠</span>{formError}</div>}
        <div className="product-form-page__grid">
          <div className="product-form-page__id">
            <TextField label="Mã SP" value={record?.id ?? nextId} readOnly />
            <small>Không thể thay đổi mã sản phẩm</small>
          </div>
          <TextField className="product-form-page__name" label="Tên sản phẩm *" value={form.name} onChange={(event) => { setForm({ ...form, name: event.target.value }); setFieldErrors((current) => ({ ...current, name: '' })); }} placeholder="Nhập tên sản phẩm" error={fieldErrors.name} required />

          <div className="field product-form-page__image-field">
            <span className="field__label">Hình ảnh minh họa</span>
            <div className="product-form-page__image-preview">
              {form.image && <img src={form.image} alt={form.name || 'Ảnh sản phẩm'} />}
              <Button type="button" variant="secondary" onClick={() => fileInput.current?.click()}>
                <ImagePlus size={17} />{form.image ? 'Thay đổi ảnh' : 'Thêm ảnh'}
              </Button>
              <input ref={fileInput} className="visually-hidden" type="file" accept="image/*" onChange={handleImageChange} />
            </div>
          </div>

          <TextField className="product-form-page__price" label="Giá bán *" type="number" min="0" value={form.price} onChange={(event) => { setForm({ ...form, price: event.target.value }); setFieldErrors((current) => ({ ...current, price: '' })); }} placeholder="Nhập giá bán (₫)" error={fieldErrors.price} required />
          <SelectField className="product-form-page__unit" label="Đơn vị tính" value={form.unit} onChange={(event) => setForm({ ...form, unit: event.target.value })} options={[{ value: '', label: 'Chọn đơn vị tính' }, ...units]} />
          <SelectField className="product-form-page__category" label="Phân loại" value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })} options={[{ value: '', label: 'Chọn loại sản phẩm' }, ...categories]} />
          <TextAreaField className="product-form-page__description" label="Mô tả" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="Nhập mô tả sản phẩm" />
        </div>

        <div className="form-actions product-form-page__actions">
          <Button variant="secondary" onClick={() => setCancelOpen(true)}>Hủy</Button>
          <Button type="submit">Lưu</Button>
        </div>
      </form>
      <ConfirmDialog open={cancelOpen} title="Xác nhận hủy" message="Các thay đổi sẽ không được lưu. Bạn có chắc chắn muốn hủy?" onCancel={() => setCancelOpen(false)} onConfirm={onCancel} />
    </div>
  );
}
