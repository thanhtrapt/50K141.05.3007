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
import { apiList, apiRequest } from '../../api.js';
import CustomerDetailPage from './CustomerDetailPage.jsx';
import CustomerFormPage from './CustomerFormPage.jsx';
import CustomerActiveServicePage from './CustomerActiveServicePage.jsx';
import CustomerRetailSalePage from './CustomerRetailSalePage.jsx';

export default function CustomersPage({ recordsOnly = false }) {
  const [items, setItems] = useState([]);
  const [selectedDetail, setSelectedDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const location = useLocation();
  const { pathname, search, state: routeState } = location;
  const navigate = useNavigate();
  const { showDialog } = useFeedback();

  const basePath = recordsOnly ? '/ho-so-khach-hang' : '/khach-hang';
  const routeParts = pathname.slice(basePath.length).split('/').filter(Boolean);
  const packageId = new URLSearchParams(search).get('packageId');
  const isCreate = routeParts[0] === 'tao-moi';
  const isRetailSale = routeParts[1] === 'ghi-nhan-mua-them';
  const editingId = routeParts.length === 2 && routeParts[1] === 'chinh-sua' ? routeParts[0] : null;
  const customerId = !isCreate && routeParts[0] !== 'undefined' ? routeParts[0] : null;
  const recordRow = items.find((customer) => customer.id === editingId);
  const recordSnapshot = routeState?.customerSnapshot?.id === editingId ? routeState.customerSnapshot : null;
  const recordSource = selectedDetail?.id === editingId ? selectedDetail : recordSnapshot ?? recordRow;
  const record = recordSource ? { ...recordSource, birthday: recordSource.dateOfBirth?.split('-').reverse().join('/') ?? recordSource.birthday ?? '' } : null;
  const selected = customerId ? selectedDetail ?? items.find((customer) => customer.id === customerId) : null;
  const nextId = 'Tự động tạo';

  useEffect(() => {
    let active = true;
    setLoading(true);
    apiList('/api/customers')
      .then((rows) => { if (active) setItems(rows); })
      .catch((error) => { if (active) setLoadError(error.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    setSelectedDetail(null);
    if (!customerId) return () => { active = false; };
    apiRequest(`/api/customers/${encodeURIComponent(customerId)}`)
      .then((customer) => { if (active) setSelectedDetail(customer); })
      .catch((error) => { if (active) setLoadError(error.message); });
    return () => { active = false; };
  }, [customerId, routeParts[1]]);

  const filtered = useMemo(
    () => items.filter((customer) => `${customer.id} ${customer.name} ${customer.phone}`.toLowerCase().includes(query.toLowerCase())),
    [items, query],
  );
  const pageCount = Math.max(1, Math.ceil(filtered.length / 9));
  const pageItems = filtered.slice((page - 1) * 9, page * 9);
  const openCreate = () => navigate(`${basePath}/tao-moi`);
  const openDetail = (customer) => navigate(`${basePath}/${customer.id}`);
  const openEdit = (customer) => navigate(`${basePath}/${customer.id}/chinh-sua`, { state: { customerSnapshot: customer } });
  const openRetailSale = (customerId, customerDraft, draftPurchases = []) => navigate(
    `${basePath}/${customerId}/ghi-nhan-mua-them`,
    { state: { customerDraft, draftPurchases, returnPath: `${basePath}/${customerId}` } },
  );
  const cancelForm = () => navigate(editingId ? `${basePath}/${editingId}` : basePath);
  const refreshCustomerDetail = async (id, options = {}) => {
    const updated = await apiRequest(`/api/customers/${encodeURIComponent(id)}`, options);
    setSelectedDetail(updated);
    return updated;
  };

  const saveCustomer = async (form) => {
    const [day, month, year] = String(form.birthday || '').split('/');
    const body = { name: form.name, phone: form.phone, dateOfBirth: `${year}-${month}-${day}` };
    const saved = editingId
      ? await apiRequest(`/api/customers/${encodeURIComponent(editingId)}`, { method: 'PUT', body })
      : await apiRequest('/api/customers', { method: 'POST', body });
    const saleGroups = new Map();
    const purchasesToCreate = editingId ? [] : (form.purchases ?? []);
    for (const purchase of purchasesToCreate) {
      if (!purchase.productId || !purchase.quantityValue || !purchase.saleDate) continue;
      const group = saleGroups.get(purchase.saleDate) ?? [];
      group.push({ cosmeticId: purchase.productId, quantity: purchase.quantityValue });
      saleGroups.set(purchase.saleDate, group);
    }
    let saleError = '';
    for (const [soldAt, items] of saleGroups) {
      try {
        await apiRequest(`/api/customers/${encodeURIComponent(saved.id)}/retail-sales`, {
          method: 'POST',
          body: { soldAt, items },
        });
      } catch (error) {
        saleError = error.message;
        break;
      }
    }
    const rows = await apiList('/api/customers');
    setItems(rows);
    showDialog(saleError
      ? { title: 'Hồ sơ đã lưu, giao dịch bán lẻ chưa hoàn tất', message: saleError }
      : { tone: 'success', title: editingId ? 'Cập nhật thành công' : 'Tạo hồ sơ khách hàng thành công', message: 'Dữ liệu đã được lưu vào cơ sở dữ liệu SQL.' });
    navigate(editingId ? `${basePath}/${editingId}` : saleGroups.size ? `${basePath}/${saved.id}` : basePath);
    return saved;
  };

  const saveDraftPurchases = (purchases, customerDraft) => navigate(`${basePath}/tao-moi`, {
    state: { customerDraft, draftPurchases: purchases },
  });

  const deleteCustomer = async () => {
    try {
      await apiRequest(`/api/customers/${encodeURIComponent(customerId)}`, { method: 'DELETE' });
      setItems((current) => current.filter((customer) => customer.id !== customerId));
      showDialog({ tone: 'success', title: 'Xóa khách hàng thành công' });
      navigate(basePath, { replace: true });
    } catch (error) {
      showDialog({ title: 'Không thể xóa hồ sơ khách hàng', message: error.message });
    }
  };

  if (loading) return <div className="panel data-loading" role="status">Đang tải dữ liệu khách hàng từ SQL…</div>;
  if (loadError && !items.length) return <div className="panel data-error" role="alert">Không tải được dữ liệu khách hàng: {loadError}</div>;

  if (isRetailSale) {
    if (isCreate) {
      return (
        <CustomerRetailSalePage
          customer={{ id: nextId, name: routeState?.customerDraft?.name || '', phone: routeState?.customerDraft?.phone || '', birthday: routeState?.customerDraft?.birthday || '' }}
          initialItems={routeState?.draftPurchases ?? []}
          draftMode
          onCancel={(draftState) => navigate(`${basePath}/tao-moi`, { state: draftState ?? { customerDraft: routeState?.customerDraft, draftPurchases: routeState?.draftPurchases } })}
          onSaveDraft={(purchases, customerDraft) => saveDraftPurchases(purchases, customerDraft)}
        />
      );
    }
    if (!selected) return <div className="panel data-loading" role="status">Đang tải hồ sơ khách hàng…</div>;
    return (
      <CustomerRetailSalePage
        customer={selected}
        onCancel={() => navigate(`${basePath}/${customerId}`)}
        onSaved={() => navigate(`${basePath}/${customerId}`)}
      />
    );
  }

  if (isCreate || editingId) {
    if (editingId && !record) {
      return <FeatureNotFound heading="DANH SÁCH HỒ SƠ KHÁCH HÀNG" message="Không tìm thấy khách hàng phù hợp!" onBack={() => navigate(basePath)} />;
    }

    return (
      <CustomerFormPage
        record={record}
        nextId={nextId}
        onCancel={cancelForm}
        onSave={saveCustomer}
        onAddPurchases={isCreate ? (form, purchases) => openRetailSale('tao-moi', form, purchases) : undefined}
        draft={routeState?.customerDraft}
        draftPurchases={routeState?.draftPurchases}
      />
    );
  }

  if (customerId) {
    if (!selected) {
      return <FeatureNotFound heading="DANH SÁCH HỒ SƠ KHÁCH HÀNG" message="Không tìm thấy khách hàng phù hợp!" onBack={() => navigate(basePath)} />;
    }

    if (routeParts[1] === 'dich-vu-dang-su-dung') {
      return (
        <CustomerActiveServicePage
          key={customerId}
          customer={selected}
          packageId={packageId}
          fallbackPath={`${basePath}/${customerId}`}
          onBack={() => navigate(`${basePath}/${customerId}`)}
        />
      );
    }

    return (
      <CustomerDetailPage
        customer={selected}
        serviceUsagePath={`${basePath}/${customerId}/dich-vu-dang-su-dung`}
        fallbackPath={basePath}
        onBack={() => navigate(basePath)}
        onEdit={() => openEdit(selected)}
        onDelete={deleteCustomer}
        onRefresh={refreshCustomerDetail}
        onRecordSale={() => openRetailSale(customerId)}
      />
    );
  }

  const columns = [
    { key: 'id', label: 'Mã khách hàng', width: '18%', align: 'center' },
    { key: 'name', label: 'Họ và tên', width: '42%', render: (customer) => <button type="button" className="table-link" onClick={() => openDetail(customer)}>{customer.name}</button> },
    { key: 'dateOfBirth', label: 'Ngày sinh', width: '18%', align: 'center', render: (customer) => customer.dateOfBirth?.split('-').reverse().join('/') || '—' },
    { key: 'phone', label: 'Số điện thoại', width: '22%', align: 'center' },
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
