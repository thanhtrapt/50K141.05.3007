import { useEffect, useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import Button from '../../components/ui/Button.jsx';
import { useFeedback } from '../../components/ui/FeedbackContext.jsx';
import DataTable from '../../components/ui/DataTable.jsx';
import FeatureNotFound from '../../components/ui/FeatureNotFound.jsx';
import PageHeader from '../../components/ui/PageHeader.jsx';
import PageListToolbar from '../../components/ui/PageListToolbar.jsx';
import Pagination from '../../components/ui/Pagination.jsx';
import SearchBox from '../../components/ui/SearchBox.jsx';
import { formatCurrency } from '../../data/mockData.js';
import { apiList, apiRequest } from '../../api.js';
import { useAuth } from '../../auth/AuthContext.jsx';
import ForbiddenPage from '../ForbiddenPage.jsx';
import ServiceDetailPage from './ServiceDetailPage.jsx';
import ServiceFormPage from './ServiceFormPage.jsx';
import ServiceSessionDetailPage from './ServiceSessionDetailPage.jsx';

const basePath = '/dich-vu';

export default function ServicesPage() {
  const { can } = useAuth();
  // STAFF chỉ được xem dịch vụ; chỉ OWNER được thêm, sửa, xóa.
  const canManageServices = can('services:write');
  const [items, setItems] = useState([]);
  const [selectedDetail, setSelectedDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { showDialog } = useFeedback();

  const normalizeService = (service) => ({
    ...service,
    sessions: Number(service.totalSessions ?? service.sessions ?? 0),
    sessionDetails: (service.sessions ?? service.sessionDetails ?? []).map((session) => ({
      ...session,
      minutes: String(session.durationMinutes ?? session.minutes ?? ''),
      entries: session.entries ?? (session.technique || session.cosmeticsUsage ? [{
        technique: session.technique || '', product: session.cosmeticsUsage || '', amount: '',
      }] : []),
    })),
  });

  useEffect(() => {
    let active = true;
    setLoading(true);
    apiList('/api/services')
      .then((rows) => { if (active) setItems(rows.map(normalizeService)); })
      .catch((error) => { if (active) setLoadError(error.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const routeParts = pathname.slice(basePath.length).split('/').filter(Boolean);
  const isCreate = routeParts[0] === 'tao-moi';
  const editingId = routeParts.length === 2 && routeParts[1] === 'chinh-sua' ? routeParts[0] : null;
  const serviceId = isCreate ? null : routeParts[0] ?? null;
  const sessionNumber = routeParts[1] === 'buoi' ? Number(routeParts[2]) : null;
  const record = items.find((service) => service.id === editingId);
  const selected = items.find((service) => service.id === serviceId);
  const nextId = 'Tự động tạo';

  useEffect(() => {
    let active = true;
    setSelectedDetail(null);
    if (!serviceId) return () => { active = false; };
    apiRequest(`/api/services/${encodeURIComponent(serviceId)}`)
      .then((service) => { if (active) setSelectedDetail(normalizeService(service)); })
      .catch((error) => { if (active) setLoadError(error.message); });
    return () => { active = false; };
  }, [serviceId]);

  const filtered = useMemo(
    () => items.filter((service) => `${service.id} ${service.name}`.toLowerCase().includes(query.toLowerCase())),
    [items, query],
  );
  const pageCount = Math.max(1, Math.ceil(filtered.length / 7));
  const pageItems = filtered.slice((page - 1) * 7, page * 7);

  const saveService = async (form) => {
    const body = {
      name: form.name,
      price: Number(form.price),
      totalSessions: Number(form.sessions),
      sessions: form.sessionDetails.map((session) => ({
        name: session.name,
        durationMinutes: Number(session.minutes),
        technique: session.entries.map((entry) => entry.technique).filter(Boolean).join('; ') || session.technique,
        cosmeticsUsage: session.entries.map((entry) => `${entry.product}${entry.amount ? ` (${entry.amount})` : ''}`).filter(Boolean).join('; '),
      })),
    };
    const saved = editingId
      ? await apiRequest(`/api/services/${encodeURIComponent(editingId)}`, { method: 'PUT', body })
      : await apiRequest('/api/services', { method: 'POST', body });
    setItems((current) => editingId
      ? current.map((service) => service.id === editingId ? normalizeService(saved) : service)
      : [...current, normalizeService(saved)]);
    showDialog({ tone: 'success', title: editingId ? 'Cập nhật thành công' : 'Tạo thành công', message: 'Dữ liệu đã được lưu vào cơ sở dữ liệu SQL.' });
    navigate(editingId ? `${basePath}/${editingId}` : basePath);
    return saved;
  };

  const deleteService = async () => {
    try {
      await apiRequest(`/api/services/${encodeURIComponent(serviceId)}`, { method: 'DELETE' });
      setItems((current) => current.filter((service) => service.id !== serviceId));
      showDialog({ tone: 'success', title: 'Xóa thành công' });
      navigate(basePath, { replace: true });
    } catch (error) {
      showDialog({ title: 'Không thể xóa dịch vụ', message: error.message });
    }
  };

  if (loading) return <div className="panel data-loading" role="status">Đang tải dịch vụ từ SQL…</div>;
  if (loadError && !items.length) return <div className="panel data-error" role="alert">Không tải được dữ liệu dịch vụ: {loadError}</div>;

  if (isCreate || editingId) {
    if (!canManageServices) {
      return <ForbiddenPage message="Chức năng thêm/sửa dịch vụ chỉ dành cho Chủ Spa. Tài khoản Nhân viên chỉ được xem thông tin dịch vụ." />;
    }
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
          service={selectedDetail ?? selected}
          sessionNumber={sessionNumber}
          canWrite={canManageServices}
          onBack={() => navigate(`${basePath}/${serviceId}`)}
          onEdit={() => navigate(`${basePath}/${serviceId}/chinh-sua`)}
          onDelete={deleteService}
        />
      );
    }
    return (
      <ServiceDetailPage
        service={selectedDetail ?? selected}
        canWrite={canManageServices}
        onBack={() => navigate(basePath)}
        onEdit={() => navigate(`${basePath}/${serviceId}/chinh-sua`)}
        onDelete={deleteService}
        onSessionDetail={(number) => navigate(`${basePath}/${serviceId}/buoi/${number}`)}
      />
    );
  }

  const columns = [
    { key: 'index', label: 'STT', width: '6%', align: 'center', render: (_, index) => index + 1 },
    { key: 'id', label: 'Mã dịch vụ', width: '18%', align: 'center' },
    { key: 'name', label: 'Tên dịch vụ', width: '52%', render: (service) => <button type="button" className="table-link" onClick={() => navigate(`${basePath}/${service.id}`)}>{service.name}</button> },
    { key: 'price', label: 'Giá dịch vụ', width: '24%', align: 'right', nowrap: true, render: (service) => formatCurrency(service.price) },
  ];

  return (
    <div className="page-stack service-page">
      <PageHeader title="DANH SÁCH DỊCH VỤ" />
      <PageListToolbar
        className="service-toolbar"
        search={<SearchBox value={query} onChange={(value) => { setQuery(value); setPage(1); }} placeholder="Nhập tên dịch vụ cần tìm kiếm..." />}
        actions={canManageServices ? <Button onClick={() => navigate(`${basePath}/tao-moi`)}><Plus size={18} />Thêm dịch vụ</Button> : null}
      />
      <section className="panel page-list-panel">
        <DataTable columns={columns} rows={pageItems} rowKey="id" emptyMessage="Không tìm thấy dịch vụ phù hợp!" />
        <div className="panel__footer"><Pagination page={page} pageCount={pageCount} onChange={setPage} /></div>
      </section>
    </div>
  );
}
