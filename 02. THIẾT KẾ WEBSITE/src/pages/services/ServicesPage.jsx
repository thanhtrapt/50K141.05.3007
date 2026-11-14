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
import { formatCurrency, services as initialServices } from '../../data/mockData.js';
import ServiceDetailPage from './ServiceDetailPage.jsx';
import ServiceFormPage from './ServiceFormPage.jsx';
import ServiceSessionDetailPage from './ServiceSessionDetailPage.jsx';

const basePath = '/dich-vu';

export default function ServicesPage() {
  const [items, setItems] = useState(initialServices);
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const { pathname } = useLocation();
  const navigate = useNavigate();

  const routeParts = pathname.slice(basePath.length).split('/').filter(Boolean);
  const isCreate = routeParts[0] === 'tao-moi';
  const editingId = routeParts.length === 2 && routeParts[1] === 'chinh-sua' ? routeParts[0] : null;
  const serviceId = isCreate ? null : routeParts[0] ?? null;
  const sessionNumber = routeParts[1] === 'buoi' ? Number(routeParts[2]) : null;
  const record = items.find((service) => service.id === editingId);
  const selected = items.find((service) => service.id === serviceId);
  const nextId = `DV${String(items.length + 1).padStart(3, '0')}`;

  const filtered = useMemo(
    () => items.filter((service) => `${service.id} ${service.name}`.toLowerCase().includes(query.toLowerCase())),
    [items, query],
  );
  const pageCount = Math.max(1, Math.ceil(filtered.length / 7));
  const pageItems = filtered.slice((page - 1) * 7, page * 7);

  const saveService = (form) => {
    if (editingId) {
      setItems((current) => current.map((service) => service.id === editingId ? { ...service, ...form, id: editingId } : service));
      navigate(`${basePath}/${editingId}`);
      return;
    }

    const createdService = { ...form, id: nextId };
    setItems((current) => [...current, createdService]);
    navigate(basePath);
  };

  const deleteService = () => {
    setItems((current) => current.filter((service) => service.id !== serviceId));
    navigate(basePath, { replace: true });
  };

  if (isCreate || editingId) {
    if (editingId && !record) {
      return <FeatureNotFound heading="DANH SÁCH DỊCH VỤ" message="Không tìm thấy dịch vụ phù hợp!" onBack={() => navigate(basePath)} />;
    }
    return (
      <ServiceFormPage
        record={record}
        nextId={nextId}
        onCancel={() => navigate(editingId ? `${basePath}/${editingId}` : basePath)}
        onSave={saveService}
      />
    );
  }

  if (serviceId) {
    if (!selected) {
      return <FeatureNotFound heading="DANH SÁCH DỊCH VỤ" message="Không tìm thấy dịch vụ phù hợp!" onBack={() => navigate(basePath)} />;
    }
    if (sessionNumber) {
      return (
        <ServiceSessionDetailPage
          service={selected}
          sessionNumber={sessionNumber}
          onBack={() => navigate(`${basePath}/${serviceId}`)}
          onEdit={() => navigate(`${basePath}/${serviceId}/chinh-sua`)}
          onDelete={deleteService}
        />
      );
    }
    return (
      <ServiceDetailPage
        service={selected}
        onBack={() => navigate(basePath)}
        onEdit={() => navigate(`${basePath}/${serviceId}/chinh-sua`)}
        onDelete={deleteService}
        onSessionDetail={(number) => navigate(`${basePath}/${serviceId}/buoi/${number}`)}
      />
    );
  }

  const columns = [
    { key: 'index', label: 'STT', width: '7%', render: (_, index) => index + 1 },
    { key: 'id', label: 'Mã dịch vụ', width: '14%' },
    { key: 'name', label: 'Tên dịch vụ', width: '43%', render: (service) => <button type="button" className="table-link" onClick={() => navigate(`${basePath}/${service.id}`)}>{service.name}</button> },
    { key: 'price', label: 'Giá dịch vụ', width: '36%', render: (service) => formatCurrency(service.price) },
  ];

  return (
    <div className="page-stack service-page">
      <PageHeader title="DANH SÁCH DỊCH VỤ" />
      <PageListToolbar
        className="service-toolbar"
        search={<SearchBox value={query} onChange={(value) => { setQuery(value); setPage(1); }} placeholder="Nhập tên dịch vụ cần tìm kiếm..." />}
        actions={<Button onClick={() => navigate(`${basePath}/tao-moi`)}><Plus size={18} />Thêm dịch vụ</Button>}
      />
      <section className="panel page-list-panel">
        <DataTable columns={columns} rows={pageItems} rowKey="id" emptyMessage="Không tìm thấy dịch vụ phù hợp!" />
        <div className="panel__footer"><Pagination page={page} pageCount={pageCount} onChange={setPage} /></div>
      </section>
    </div>
  );
}
