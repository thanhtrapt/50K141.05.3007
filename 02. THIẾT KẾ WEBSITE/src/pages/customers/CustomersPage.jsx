import { useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import Button from '../../components/ui/Button.jsx';
import DataTable from '../../components/ui/DataTable.jsx';
import FeatureNotFound from '../../components/ui/FeatureNotFound.jsx';
import PageHeader from '../../components/ui/PageHeader.jsx';
import PageListToolbar from '../../components/ui/PageListToolbar.jsx';
import Pagination from '../../components/ui/Pagination.jsx';
import SearchBox from '../../components/ui/SearchBox.jsx';
import { customers as initialCustomers } from '../../data/mockData.js';
import CustomerDetailPage from './CustomerDetailPage.jsx';
import CustomerFormPage from './CustomerFormPage.jsx';

export default function CustomersPage({ recordsOnly = false }) {
  const [items, setItems] = useState(initialCustomers);
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const { pathname } = useLocation();
  const navigate = useNavigate();

  const basePath = recordsOnly ? '/ho-so-khach-hang' : '/khach-hang';
  const routeParts = pathname.slice(basePath.length).split('/').filter(Boolean);
  const isCreate = routeParts[0] === 'tao-moi';
  const editingId = routeParts.length === 2 && routeParts[1] === 'chinh-sua' ? routeParts[0] : null;
  const customerId = !isCreate && routeParts[0] !== 'undefined' ? routeParts[0] : null;
  const record = items.find((customer) => customer.id === editingId);
  const selected = items.find((customer) => customer.id === customerId);
  const nextId = `KH${String(items.length + 1).padStart(3, '0')}`;

  const filtered = useMemo(
    () => items.filter((customer) => `${customer.id} ${customer.name} ${customer.phone}`.toLowerCase().includes(query.toLowerCase())),
    [items, query],
  );
  const pageCount = Math.max(1, Math.ceil(filtered.length / 9));
  const pageItems = filtered.slice((page - 1) * 9, page * 9);
  const openCreate = () => navigate(`${basePath}/tao-moi`);
  const openDetail = (customer) => navigate(`${basePath}/${customer.id}`);
  const openEdit = (customer) => navigate(`${basePath}/${customer.id}/chinh-sua`);
  const cancelForm = () => navigate(editingId ? `${basePath}/${editingId}` : basePath);

  const saveCustomer = (form) => {
    if (editingId) {
      setItems((current) => current.map((customer) => customer.id === editingId ? { ...customer, ...form } : customer));
      navigate(`${basePath}/${editingId}`);
      return;
    }

    const createdCustomer = { ...form, id: nextId, visits: 0 };
    setItems((current) => [...current, createdCustomer]);
    navigate(basePath);
  };

  const deleteCustomer = () => {
    setItems((current) => current.filter((customer) => customer.id !== customerId));
    navigate(basePath, { replace: true });
  };

  if (isCreate || editingId) {
    if (editingId && !record) {
      return <FeatureNotFound heading="DANH SÁCH HỒ SƠ KHÁCH HÀNG" message="Không tìm thấy khách hàng phù hợp!" onBack={() => navigate(basePath)} />;
    }

    return <CustomerFormPage record={record} nextId={nextId} onCancel={cancelForm} onSave={saveCustomer} />;
  }

  if (customerId) {
    if (!selected) {
      return <FeatureNotFound heading="DANH SÁCH HỒ SƠ KHÁCH HÀNG" message="Không tìm thấy khách hàng phù hợp!" onBack={() => navigate(basePath)} />;
    }

    return (
      <CustomerDetailPage
        customer={selected}
        onBack={() => navigate(basePath)}
        onEdit={() => openEdit(selected)}
        onDelete={deleteCustomer}
      />
    );
  }

  const columns = [
    { key: 'id', label: 'Mã khách hàng', width: '22%' },
    { key: 'name', label: 'Họ và tên', width: '30%', render: (customer) => <button type="button" className="table-link" onClick={() => openDetail(customer)}>{customer.name}</button> },
    { key: 'birthday', label: 'Ngày sinh', width: '22%' },
    { key: 'phone', label: 'Số điện thoại', width: '26%' },
  ];

  return (
    <div className={`page-stack customer-page${recordsOnly ? ' customer-page--records' : ''}`}>
      <PageHeader title={recordsOnly ? 'DANH SÁCH HỒ SƠ KHÁCH HÀNG' : 'DANH SÁCH KHÁCH HÀNG'} />
      <PageListToolbar
        className="customer-toolbar"
        search={<SearchBox value={query} onChange={(value) => { setQuery(value); setPage(1); }} placeholder="Nhập từ khóa cần tra cứu..." />}
        actions={<Button onClick={openCreate}><Plus size={18} />Tạo hồ sơ</Button>}
      />
      <section className="panel page-list-panel">
        <DataTable columns={columns} rows={pageItems} rowKey="id" emptyMessage="Không tìm thấy khách hàng phù hợp!" />
        <div className="panel__footer"><Pagination page={page} pageCount={pageCount} onChange={setPage} /></div>
      </section>
    </div>
  );
}
