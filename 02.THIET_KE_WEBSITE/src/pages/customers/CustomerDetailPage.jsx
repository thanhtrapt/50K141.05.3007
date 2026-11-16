import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus } from 'lucide-react';
import ConfirmDialog from '../../components/ui/ConfirmDialog.jsx';
import DataTable from '../../components/ui/DataTable.jsx';
import PageHeader from '../../components/ui/PageHeader.jsx';
import Modal from '../../components/ui/Modal.jsx';
import Button from '../../components/ui/Button.jsx';
import SelectField from '../../components/ui/SelectField.jsx';
import TextField from '../../components/ui/TextField.jsx';
import { ActionGroup, DeleteButton, EditButton } from '../../components/ui/ActionButtons.jsx';
import { formatCurrency } from '../../data/mockData.js';
import { apiList, apiRequest } from '../../api.js';
import { useFeedback } from '../../components/ui/FeedbackContext.jsx';

const localDate = (value) => value ? new Date(value).toLocaleDateString('vi-VN') : '—';

export default function CustomerDetailPage({ customer, onBack, onEdit, onDelete, onRefresh, onRecordSale, serviceUsagePath, fallbackPath = '/khach-hang' }) {
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [serviceModalOpen, setServiceModalOpen] = useState(false);
  const [saleDetail, setSaleDetail] = useState(null);
  const [services, setServices] = useState([]);
  const [selectedServiceDetail, setSelectedServiceDetail] = useState(null);
  const [serviceDetailLoading, setServiceDetailLoading] = useState(false);
  const [serviceId, setServiceId] = useState('');
  const [paid, setPaid] = useState(false);
  const [serviceNote, setServiceNote] = useState('');
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const { showDialog, notify } = useFeedback();

  const activeServices = customer.activeServices ?? [];
  const serviceHistory = customer.serviceHistory ?? [];
  const sales = customer.purchasedSales ?? [];
  const visits = [...activeServices, ...serviceHistory].reduce((total, item) => total + Number(item.sessionsCompleted || 0), 0);
  const selectedService = services.find((service) => service.id === serviceId);

  useEffect(() => {
    if (!serviceModalOpen) return undefined;
    let active = true;
    apiList('/api/services').then((rows) => { if (active) setServices(rows); })
      .catch((error) => { if (active) notify(error.message || 'Không tải được danh sách dịch vụ.', 'error'); });
    return () => { active = false; };
  }, [serviceModalOpen, notify]);

  useEffect(() => {
    if (!serviceModalOpen || !serviceId) {
      setSelectedServiceDetail(null);
      return undefined;
    }
    let active = true;
    setServiceDetailLoading(true);
    apiRequest(`/api/services/${encodeURIComponent(serviceId)}`)
      .then((record) => { if (active) setSelectedServiceDetail(record); })
      .catch((error) => { if (active) notify(error.message || 'Không tải được chi tiết dịch vụ.', 'error'); })
      .finally(() => { if (active) setServiceDetailLoading(false); });
    return () => { active = false; };
  }, [serviceId, serviceModalOpen, notify]);

  const reloadCustomer = async () => { await onRefresh?.(customer.id, { detailedServerErrors: true }); };
  const saveService = async (event) => {
    event.preventDefault();
    if (savingRef.current) return;
    if (!serviceId) { notify('Vui lòng chọn dịch vụ.', 'error'); return; }
    savingRef.current = true;
    setSaving(true);
    try {
      const result = await apiRequest(`/api/customers/${encodeURIComponent(customer.id)}/service-packages`, {
        method: 'POST', body: { serviceId, paid, note: serviceNote.trim() || null }, detailedServerErrors: true,
      });
      if (!result?.id) {
        throw new Error('API không trả về mã đơn mua sau khi lưu dịch vụ.');
      }
      setServiceModalOpen(false);
      setServiceId(''); setPaid(false); setServiceNote('');
      showDialog({ tone: 'success', title: 'Thêm dịch vụ thành công', message: `Đã tạo đơn mua ${result.id}.`, closeLabel: 'Đóng' });
      try {
        await reloadCustomer();
      } catch (refreshError) {
        console.error('[customers] Dịch vụ đã lưu nhưng không tải lại được hồ sơ:', refreshError);
        notify(`Dịch vụ đã lưu thành công, nhưng chưa tải lại được hồ sơ: ${refreshError.message}`, 'error');
      }
    } catch (error) {
      console.error('[customers] Không thể thêm dịch vụ đang sử dụng:', {
        message: error?.message,
        details: error?.details ?? error?.detail,
        hint: error?.hint,
        code: error?.code,
        expectedRows: { donmuadv: 1, ct_donmua: Number(selectedServiceDetail?.totalSessions ?? selectedService?.totalSessions) || null },
        receivedRows: error?.receivedRows ?? null,
      }, error);
      notify(error.message || 'Không thể thêm dịch vụ. Vui lòng thử lại.', 'error');
    } finally { savingRef.current = false; setSaving(false); }
  };

  const purchases = sales.map((sale) => ({
    ...sale,
    date: localDate(sale.purchaseDate),
    totalText: formatCurrency(sale.total),
    detail: <button type="button" className="text-link" onClick={() => setSaleDetail(sale)}>Chi tiết</button>,
  }));

  return (
    <div className="page-stack customer-detail-page">
      <PageHeader title="CHI TIẾT HỒ SƠ KHÁCH HÀNG" fallbackPath={fallbackPath} onBack={onBack} />
      {customer.isBlacklisted && <div className="customer-detail__alert" role="status">Khách hàng thuộc danh sách đen!</div>}

      <section className="panel customer-profile-panel">
        <div className="customer-profile-panel__heading">
          <span className="customer-detail__avatar" aria-hidden="true">{customer.name.slice(0, 1)}</span>
          <div><small>Mã khách hàng: {customer.id}</small><h2>{customer.name}</h2></div>
          <ActionGroup className="customer-detail__actions"><EditButton onClick={onEdit} /><DeleteButton onClick={() => setDeleteConfirmOpen(true)} /></ActionGroup>
        </div>
        <dl className="customer-profile-facts">
          <div><dt>Ngày sinh</dt><dd>{customer.dateOfBirth?.split('-').reverse().join('/') || customer.birthday || '—'}</dd></div>
          <div><dt>Số điện thoại</dt><dd>{customer.phone}</dd></div>
          <div><dt>Số buổi đã thực hiện</dt><dd>{visits} buổi</dd></div>
        </dl>
      </section>

      <div className="customer-detail__sections">
        <section className="panel customer-detail__section">
          <div className="customer-detail__section-heading"><h2>Dịch vụ đang sử dụng</h2><Button onClick={() => setServiceModalOpen(true)}><Plus size={16} />Thêm dịch vụ</Button></div>
          <div className="customer-detail__rows">
            {activeServices.length ? activeServices.map((service) => (
              <p key={service.id}><span>{service.serviceName}</span><span>{formatCurrency(service.purchasePrice)}</span><span>{service.sessionsCompleted}/{service.totalSessions} buổi</span><Link className="text-link" to={`${serviceUsagePath}?packageId=${encodeURIComponent(service.id)}`}>Xem chi tiết</Link></p>
            )) : <p className="customer-detail__empty">Chưa có dịch vụ đang sử dụng</p>}
          </div>
        </section>

      </div>

      <section className="panel customer-detail__section customer-detail__purchases">
        <div className="customer-detail__section-heading"><h2>Sản phẩm mua thêm</h2><Button onClick={onRecordSale}><Plus size={16} />Ghi nhận mua thêm</Button></div>
        <DataTable columns={[
          { key: 'saleId', label: 'Mã đơn', width: '24%', align: 'center' },
          { key: 'date', label: 'Ngày mua', width: '25%', align: 'center' },
          { key: 'totalText', label: 'Tổng tiền', width: '26%', align: 'right', nowrap: true },
          { key: 'detail', label: 'Chi tiết', width: '25%', align: 'center' },
        ]} rows={purchases} rowKey="saleId" emptyMessage="Chưa có sản phẩm mua thêm" />
      </section>

      <section className="panel customer-detail__section">
        <div className="customer-detail__section-heading"><h2>Lịch sử dịch vụ</h2><span>{serviceHistory.length} liệu trình</span></div>
        <div className="customer-detail__rows">
          {serviceHistory.length ? serviceHistory.map((service) => (
            <p key={service.id}>
              <span>{service.serviceName} · {service.sessionsCompleted}/{service.totalSessions} buổi · {service.completionStatus}</span>
              <Link className="text-link" to={`${serviceUsagePath}?packageId=${encodeURIComponent(service.id)}`}>Xem chi tiết</Link>
            </p>
          )) : <p className="customer-detail__empty">Chưa có lịch sử dịch vụ.</p>}
        </div>
      </section>

      <Modal open={serviceModalOpen} title="THÊM DỊCH VỤ" onClose={() => setServiceModalOpen(false)}>
        <form className="form-grid" onSubmit={saveService} noValidate>
          <SelectField label="Dịch vụ *" value={serviceId} onChange={(event) => setServiceId(event.target.value)} options={[{ value: '', label: 'Chọn dịch vụ' }, ...services.map((service) => ({ value: service.id, label: `${service.name} · ${formatCurrency(service.price)}` }))]} required />
          {selectedService && <TextField label="Giá dịch vụ" value={formatCurrency(selectedService.price)} readOnly />}
          {selectedService && <div className="form-grid__wide customer-detail__rows" aria-live="polite">
            <p><strong>{selectedService.name}</strong><span>{formatCurrency(selectedService.price)} · {selectedService.totalSessions ?? selectedServiceDetail?.totalSessions ?? 0} buổi</span></p>
            {serviceDetailLoading && <p>Đang tải chi tiết liệu trình…</p>}
            {(selectedServiceDetail?.sessions ?? []).map((session, index) => <p key={session.id || index}>
              <span><strong>{session.name || `Buổi ${index + 1}`}</strong> · {session.durationMinutes || 0} phút</span>
              <span>{session.technique || 'Chưa có kỹ thuật'} · {session.cosmeticsUsage || 'Chưa có mỹ phẩm sử dụng'}</span>
            </p>)}
          </div>}
          <label className="field"><span className="field__label">Thanh toán</span><span className="customer-detail__paid-check"><input type="checkbox" checked={paid} onChange={(event) => setPaid(event.target.checked)} />Đã thanh toán</span></label>
          <label className="field form-grid__wide"><span className="field__label">Ghi chú</span><textarea className="field__control" maxLength={255} value={serviceNote} onChange={(event) => setServiceNote(event.target.value)} /></label>
          <div className="modal-form-actions form-grid__wide"><Button variant="secondary" onClick={() => setServiceModalOpen(false)}>Hủy</Button><Button type="submit" disabled={saving}>{saving ? 'Đang lưu…' : 'Lưu'}</Button></div>
        </form>
      </Modal>

      <Modal open={Boolean(saleDetail)} title={saleDetail ? `CHI TIẾT ĐƠN ${saleDetail.saleId}` : ''} onClose={() => setSaleDetail(null)} size="large">
        {saleDetail && <>
          <p className="customer-detail-sale-detail__meta">Ngày mua: {localDate(saleDetail.purchaseDate)} <strong>Tổng tiền: {formatCurrency(saleDetail.total)}</strong></p>
          <DataTable columns={[
            { key: 'cosmeticName', label: 'Tên sản phẩm', width: '40%' },
            { key: 'quantity', label: 'Số lượng', width: '18%', align: 'center' },
            { key: 'unitPrice', label: 'Đơn giá', width: '21%', align: 'right', nowrap: true, render: (item) => formatCurrency(item.unitPrice) },
            { key: 'lineTotal', label: 'Thành tiền', width: '21%', align: 'right', nowrap: true, render: (item) => formatCurrency(item.lineTotal) },
          ]} rows={saleDetail.items ?? []} rowKey="id" emptyMessage="Đơn hàng không có chi tiết sản phẩm." />
        </>}
      </Modal>

      <ConfirmDialog open={deleteConfirmOpen} title="Xóa hồ sơ khách hàng" message="Bạn có chắc chắn muốn xóa hồ sơ khách hàng này?" onCancel={() => setDeleteConfirmOpen(false)} onConfirm={onDelete} confirmLabel="Xóa" cancelLabel="Hủy" danger />
    </div>
  );
}
