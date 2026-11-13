import { useMemo, useState } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import Button from '../../components/ui/Button.jsx';
import DataTable from '../../components/ui/DataTable.jsx';
import Modal from '../../components/ui/Modal.jsx';
import PageHeader from '../../components/ui/PageHeader.jsx';
import Pagination from '../../components/ui/Pagination.jsx';
import SearchBox from '../../components/ui/SearchBox.jsx';
import TextField from '../../components/ui/TextField.jsx';
import { formatCurrency, services as initialServices } from '../../data/mockData.js';

const emptyService = { id: '', name: '', price: '', sessions: 1 };

export default function ServicesPage() {
  const [items, setItems] = useState(initialServices);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyService);
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => items.filter((service) => `${service.id} ${service.name}`.toLowerCase().includes(query.toLowerCase())), [items, query]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / 7));
  const pageItems = filtered.slice((page - 1) * 7, page * 7);
  const closeForm = () => { setFormOpen(false); setEditing(null); setForm(emptyService); };
  const openCreate = () => { setForm(emptyService); setEditing(null); setFormOpen(true); };
  const openEdit = (service) => { setSelected(null); setEditing(service.id); setForm({ ...service }); setFormOpen(true); };

  const saveService = (event) => {
    event.preventDefault();
    const nextService = { ...form, price: Number(form.price), sessions: Number(form.sessions) };
    if (editing) {
      setItems((current) => current.map((service) => service.id === editing ? nextService : service));
    } else {
      const nextId = `DV${String(items.length + 1).padStart(3, '0')}`;
      setItems((current) => [...current, { ...nextService, id: nextId }]);
    }
    closeForm();
  };

  const columns = [
    { key: 'index', label: 'STT', width: '7%', render: (_, index) => index + 1 },
    { key: 'id', label: 'Mã dịch vụ', width: '14%' },
    { key: 'name', label: 'Tên dịch vụ', width: '43%', render: (service) => <button type="button" className="table-link" onClick={() => setSelected(service)}>{service.name}</button> },
    { key: 'price', label: 'Giá dịch vụ', width: '40%', render: (service) => formatCurrency(service.price) },
  ];

  return (
    <div className="page-stack service-page">
      <PageHeader title="Quản lý dịch vụ" />
      <div className="page-list-toolbar service-toolbar">
        <SearchBox value={query} onChange={(value) => { setQuery(value); setPage(1); }} placeholder="Nhập tên dịch vụ cần tìm kiếm..." />
        <Button onClick={openCreate}><Plus size={18} />Thêm dịch vụ</Button>
      </div>
      <section className="panel page-list-panel">
        <div className="panel__subheading"><h2>Danh sách dịch vụ</h2></div>
        <DataTable columns={columns} rows={pageItems} rowKey="id" emptyMessage="Không tìm thấy dịch vụ phù hợp!" />
        <div className="panel__footer"><Pagination page={page} pageCount={pageCount} onChange={setPage} /></div>
      </section>

      <Modal open={formOpen} title={editing ? 'Chỉnh sửa thông tin dịch vụ' : 'Tạo thông tin dịch vụ'} onClose={closeForm} size="large">
        <form className="form-grid" onSubmit={saveService}>
          <TextField label="Mã dịch vụ" value={editing ? form.id : 'Tự động tạo'} readOnly />
          <TextField label="Tên dịch vụ *" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required />
          <TextField label="Giá dịch vụ *" type="number" min="0" value={form.price} onChange={(event) => setForm({ ...form, price: event.target.value })} required />
          <TextField label="Số buổi thực hiện *" type="number" min="1" value={form.sessions} onChange={(event) => setForm({ ...form, sessions: event.target.value })} required />
          <div className="form-grid__wide"><TextField label="Kết quả dịch vụ" placeholder="Nhập kết quả dịch vụ..." /></div>
          <div className="modal-form-actions form-grid__wide">
            <Button variant="secondary" onClick={closeForm}>Hủy</Button>
            <Button type="submit">Lưu</Button>
          </div>
        </form>
      </Modal>

      <Modal open={Boolean(selected)} title={selected?.deleteConfirm ? 'Xác nhận xóa dịch vụ' : 'Chi tiết dịch vụ'} onClose={() => setSelected(null)}>
        {selected?.deleteConfirm ? (
          <div className="confirm-content">
            <p>Bạn có chắc chắn muốn xóa dịch vụ <strong>{selected.name}</strong> không?</p>
            <div className="modal-form-actions">
              <Button variant="secondary" onClick={() => setSelected(null)}>Hủy</Button>
              <Button variant="danger" onClick={() => { setItems((current) => current.filter((service) => service.id !== selected.id)); setSelected(null); }}>Xóa</Button>
            </div>
          </div>
        ) : selected && (
          <div className="detail-content">
            <dl className="detail-grid">
              <div><dt>Mã dịch vụ</dt><dd>{selected.id}</dd></div>
              <div><dt>Tên dịch vụ</dt><dd>{selected.name}</dd></div>
              <div><dt>Giá dịch vụ</dt><dd>{formatCurrency(selected.price)}</dd></div>
              <div><dt>Số buổi thực hiện</dt><dd>{selected.sessions} buổi</dd></div>
            </dl>
            <h3>Buổi thực hiện</h3>
            <p className="muted-copy">Quy trình kỹ thuật, mỹ phẩm sử dụng và định lượng sản phẩm sẽ được thể hiện theo chi tiết dịch vụ trong thiết kế.</p>
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
