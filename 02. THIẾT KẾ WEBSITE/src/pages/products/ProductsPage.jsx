import { useMemo, useState } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import Button from '../../components/ui/Button.jsx';
import DataTable from '../../components/ui/DataTable.jsx';
import Modal from '../../components/ui/Modal.jsx';
import PageHeader from '../../components/ui/PageHeader.jsx';
import Pagination from '../../components/ui/Pagination.jsx';
import SearchBox from '../../components/ui/SearchBox.jsx';
import SelectField from '../../components/ui/SelectField.jsx';
import TextField from '../../components/ui/TextField.jsx';
import { formatCurrency, products as initialProducts } from '../../data/mockData.js';

const emptyProduct = { id: '', name: '', category: '', stock: 0, price: '', image: '/assets/products/mp001.png' };
const productCategories = ['Serum', 'Làm sạch', 'Kem dưỡng', 'Mặt nạ', 'Toner'];

export default function ProductsPage() {
  const [items, setItems] = useState(initialProducts);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('');
  const [selected, setSelected] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(emptyProduct);
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => items.filter((item) => {
    const matchesQuery = `${item.id} ${item.name}`.toLowerCase().includes(query.toLowerCase());
    return matchesQuery && (!category || item.category === category);
  }), [items, query, category]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / 9));
  const pageItems = filtered.slice((page - 1) * 9, page * 9);

  const closeForm = () => { setFormOpen(false); setEditing(false); setForm(emptyProduct); };
  const openCreate = () => { setForm(emptyProduct); setEditing(false); setFormOpen(true); };
  const openEdit = (product) => { setSelected(null); setForm({ ...product, price: String(product.price) }); setEditing(true); setFormOpen(true); };
  const saveProduct = (event) => {
    event.preventDefault();
    const nextProduct = { ...form, price: Number(form.price), stock: Number(form.stock) };
    if (editing) {
      setItems((current) => current.map((item) => item.id === form.id ? nextProduct : item));
    } else {
      const nextId = `MP${String(items.length + 1).padStart(3, '0')}`;
      setItems((current) => [...current, { ...nextProduct, id: nextId }]);
    }
    closeForm();
  };

  const columns = [
    { key: 'id', label: 'Mã MP', width: '12%' },
    { key: 'name', label: 'Tên mỹ phẩm', width: '27%', render: (product) => <button type="button" className="table-link" onClick={() => setSelected(product)}>{product.name}</button> },
    { key: 'image', label: 'Hình ảnh minh họa', width: '20%', render: (product) => <img className="product-thumbnail" src={product.image} alt={product.name} /> },
    { key: 'stock', label: 'Tồn kho', width: '15%' },
    { key: 'price', label: 'Giá bán', width: '16%', render: (product) => formatCurrency(product.price) },
  ];

  return (
    <div className="page-stack product-page">
      <PageHeader title="DANH SÁCH MỸ PHẨM" />
      <div className="page-list-toolbar product-toolbar">
          <SearchBox value={query} onChange={(value) => { setQuery(value); setPage(1); }} placeholder="Nhập từ khóa cần tra cứu..." />
          <SelectField
            aria-label="Loại sản phẩm"
            value={category}
            onChange={(event) => { setCategory(event.target.value); setPage(1); }}
            options={[{ value: '', label: 'Loại sản phẩm' }, ...productCategories.map((value) => ({ value, label: value }))]}
          />
          <Button onClick={openCreate}><Plus size={18} />Thêm mỹ phẩm</Button>
      </div>
      <section className="panel page-list-panel">
        <DataTable columns={columns} rows={pageItems} rowKey="id" emptyMessage="Không tìm thấy mỹ phẩm phù hợp!" />
        <div className="panel__footer"><Pagination page={page} pageCount={pageCount} onChange={setPage} /></div>
      </section>

      <Modal open={formOpen} title={editing ? 'Sửa thông tin mỹ phẩm' : 'Tạo thông tin mỹ phẩm'} onClose={closeForm} size="large">
        <form className="form-grid product-form" onSubmit={saveProduct}>
          <TextField label="Mã SP" value={editing ? form.id : 'Tự động tạo'} readOnly />
          <TextField label="Tên sản phẩm *" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required />
          <label className="field product-form__image">
            <span className="field__label">Hình ảnh minh họa</span>
            <img src={form.image} alt="Ảnh sản phẩm đang chọn" />
            <select className="field__control field__select" aria-label="Chọn ảnh sản phẩm" value={form.image} onChange={(event) => setForm({ ...form, image: event.target.value })}>
              {productsPreviewOptions.map((image, index) => <option key={image} value={image}>Ảnh sản phẩm {index + 1}</option>)}
            </select>
          </label>
          <TextField label="Giá bán *" type="number" min="0" value={form.price} onChange={(event) => setForm({ ...form, price: event.target.value })} required />
          <SelectField label="Đơn vị tính *" value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })} options={[{ value: '', label: 'Chọn loại sản phẩm' }, ...productCategories.map((value) => ({ value, label: value }))]} required />
          <TextField label="Tồn kho" type="number" min="0" value={form.stock} onChange={(event) => setForm({ ...form, stock: event.target.value })} />
          <div className="form-grid__wide"><TextField label="Mô tả" placeholder="Nhập mô tả sản phẩm..." /></div>
          <div className="modal-form-actions form-grid__wide">
            <Button variant="secondary" onClick={closeForm}>Hủy</Button>
            <Button type="submit">Lưu</Button>
          </div>
        </form>
      </Modal>

      <Modal open={Boolean(selected)} title={selected?.deleteConfirm ? 'Xác nhận xóa mỹ phẩm' : 'Chi tiết sản phẩm'} onClose={() => setSelected(null)} size="large">
        {selected?.deleteConfirm ? (
          <div className="confirm-content">
            <p>Bạn có chắc chắn muốn xóa mỹ phẩm <strong>{selected.name}</strong> không?</p>
            <div className="modal-form-actions">
              <Button variant="secondary" onClick={() => setSelected(null)}>Hủy</Button>
              <Button variant="danger" onClick={() => { setItems((current) => current.filter((item) => item.id !== selected.id)); setSelected(null); }}>Xóa</Button>
            </div>
          </div>
        ) : selected && (
          <div className="product-detail">
            <img src={selected.image} alt={selected.name} />
            <dl className="detail-grid">
              <div><dt>Mã SP</dt><dd>{selected.id}</dd></div>
              <div><dt>Tên SP</dt><dd>{selected.name}</dd></div>
              <div><dt>Loại sản phẩm</dt><dd>{selected.category}</dd></div>
              <div><dt>Giá bán</dt><dd>{formatCurrency(selected.price)}</dd></div>
            </dl>
            <h3>Danh sách hàng</h3>
            <DataTable columns={[{ key: 'lot', label: 'Mã lô' }, { key: 'made', label: 'Ngày sản xuất' }, { key: 'expiry', label: 'Hạn sử dụng' }, { key: 'stock', label: 'Tồn kho' }]} rows={[{ lot: `${selected.id}-01`, made: '15/05/2026', expiry: '15/05/2027', stock: selected.stock }]} />
            <div className="modal-form-actions">
              <Button variant="secondary" onClick={() => setSelected(null)}>Đóng</Button>
              <Button variant="danger" onClick={() => setSelected({ ...selected, deleteConfirm: true })}><Trash2 size={16} />Xóa</Button>
              <Button onClick={() => openEdit(selected)}><Pencil size={16} />Chỉnh sửa</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

const productsPreviewOptions = Array.from({ length: 8 }, (_, index) => `/assets/products/mp${String(index + 1).padStart(3, '0')}.png`);
