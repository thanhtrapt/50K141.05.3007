import { useMemo, useState } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import Button from '../../components/ui/Button.jsx';
import DataTable from '../../components/ui/DataTable.jsx';
import Modal from '../../components/ui/Modal.jsx';
import PageHeader from '../../components/ui/PageHeader.jsx';
import Pagination from '../../components/ui/Pagination.jsx';
import SearchBox from '../../components/ui/SearchBox.jsx';
import TextField from '../../components/ui/TextField.jsx';
import { customers as initialCustomers } from '../../data/mockData.js';

const emptyCustomer = { name: '', birthday: '', phone: '' };

export default function CustomersPage({ recordsOnly = false }) {
  const [items, setItems] = useState(initialCustomers);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyCustomer);
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => items.filter((customer) => `${customer.id} ${customer.name} ${customer.phone}`.toLowerCase().includes(query.toLowerCase())), [items, query]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / 9));
  const pageItems = filtered.slice((page - 1) * 9, page * 9);
  const closeForm = () => { setFormOpen(false); setForm(emptyCustomer); setEditingId(null); };
  const openEdit = (customer) => {
    setForm({ name: customer.name, birthday: customer.birthday, phone: customer.phone });
    setEditingId(customer.id);
    setSelected(null);
    setFormOpen(true);
  };

  const saveCustomer = (event) => {
    event.preventDefault();
    if (editingId) {
      setItems((current) => current.map((customer) => customer.id === editingId ? { ...customer, ...form } : customer));
    } else {
      const nextId = `KH${String(items.length + 1).padStart(3, '0')}`;
      setItems((current) => [...current, { ...form, id: nextId, visits: 0 }]);
    }
    closeForm();
  };

  const columns = [
    { key: 'id', label: 'Mã khách hàng', width: '22%' },
    { key: 'name', label: 'Họ và tên', width: '30%', render: (customer) => <button type="button" className="table-link" onClick={() => setSelected(customer)}>{customer.name}</button> },
    { key: 'birthday', label: 'Ngày sinh', width: '22%' },
    { key: 'phone', label: 'Số điện thoại', width: '26%' },
  ];

  return (
    <div className={`page-stack customer-page${recordsOnly ? ' customer-page--records' : ''}`}>
      <PageHeader title={recordsOnly ? 'DANH SÁCH HỒ SƠ KHÁCH HÀNG' : 'DANH SÁCH KHÁCH HÀNG'} />
      <div className="page-list-toolbar customer-toolbar">
          <SearchBox value={query} onChange={(value) => { setQuery(value); setPage(1); }} placeholder="Nhập từ khóa cần tra cứu..." />
          <Button onClick={() => { setForm(emptyCustomer); setFormOpen(true); }}><Plus size={18} />Tạo hồ sơ</Button>
      </div>
      <section className="panel page-list-panel">
        <DataTable columns={columns} rows={pageItems} rowKey="id" emptyMessage="Không tìm thấy khách hàng phù hợp!" />
        <div className="panel__footer"><Pagination page={page} pageCount={pageCount} onChange={setPage} /></div>
      </section>

      <Modal open={formOpen} title={editingId ? 'SỬA THÔNG TIN KHÁCH HÀNG' : 'TẠO HỒ SƠ KHÁCH HÀNG'} onClose={closeForm} size="large">
        <form className="form-grid" onSubmit={saveCustomer}>
          <TextField label="Mã khách hàng" value="Tự động tạo" readOnly />
          <TextField label="Họ và tên *" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required />
          <TextField label="Ngày sinh" type="date" value={form.birthday} onChange={(event) => setForm({ ...form, birthday: event.target.value })} />
          <TextField label="Số điện thoại *" type="tel" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} required />
          <div className="modal-form-actions form-grid__wide">
            <Button variant="secondary" onClick={closeForm}>Hủy</Button>
            <Button type="submit">Lưu</Button>
          </div>
        </form>
      </Modal>

      <Modal open={Boolean(selected)} title="CHI TIẾT HỒ SƠ KHÁCH HÀNG" onClose={() => setSelected(null)} size="large">
        {selected && (
          <div className="customer-detail">
            <div className="customer-detail__summary">
              <span className="customer-detail__avatar">{selected.name.slice(0, 1)}</span>
              <div><small>Mã khách hàng: {selected.id}</small><h3>{selected.name}</h3></div>
              <div className="customer-detail__actions">
                <Button variant="secondary" onClick={() => openEdit(selected)}><Pencil size={16} />Chỉnh sửa</Button>
                <Button variant="danger" onClick={() => setSelected({ ...selected, deleteConfirm: true })}><Trash2 size={16} />Xóa</Button>
              </div>
            </div>
            {selected.deleteConfirm ? (
              <div className="confirm-content">
                <p>Bạn có chắc chắn muốn xóa hồ sơ khách hàng <strong>{selected.name}</strong> không?</p>
                <div className="modal-form-actions">
                  <Button variant="secondary" onClick={() => setSelected({ ...selected, deleteConfirm: false })}>Hủy</Button>
                  <Button variant="danger" onClick={() => { setItems((current) => current.filter((item) => item.id !== selected.id)); setSelected(null); }}>Xóa</Button>
                </div>
              </div>
            ) : (
              <>
                <dl className="detail-grid">
                  <div><dt>Ngày sinh</dt><dd>{selected.birthday}</dd></div>
                  <div><dt>Số điện thoại</dt><dd>{selected.phone}</dd></div>
                  <div><dt>Số lần đến</dt><dd>{selected.visits} lần</dd></div>
                </dl>
                <section className="customer-detail__section">
                  <h3>Dịch vụ đang sử dụng</h3>
                  <p>Liệu trình chăm sóc da cơ bản <Link className="text-link" to="/dich-vu">Xem chi tiết</Link></p>
                </section>
                <section className="customer-detail__section">
                  <h3>Sản phẩm mua thêm</h3>
                  <p>Serum phục hồi B5 <span>2 chai</span></p>
                </section>
                <section className="customer-detail__section">
                  <h3>Lịch sử dịch vụ</h3>
                  <p>Buổi 2 · Đã hoàn thành · 21/10/2026</p>
                </section>
              </>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
