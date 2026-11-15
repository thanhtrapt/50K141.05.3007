import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Plus, Trash2 } from 'lucide-react';
import Button from '../../components/ui/Button.jsx';
import ConfirmDialog from '../../components/ui/ConfirmDialog.jsx';
import DataTable from '../../components/ui/DataTable.jsx';
import PageHeader from '../../components/ui/PageHeader.jsx';
import PageListToolbar from '../../components/ui/PageListToolbar.jsx';
import Pagination from '../../components/ui/Pagination.jsx';
import SearchBox from '../../components/ui/SearchBox.jsx';
import SelectField from '../../components/ui/SelectField.jsx';
import TextField from '../../components/ui/TextField.jsx';
import { useFeedback } from '../../components/ui/FeedbackContext.jsx';
import { apiList, apiRequest } from '../../api.js';
import { useAuth } from '../../auth/AuthContext.jsx';
const emptyLine = () => ({ product: '', lot: '', quantity: '' });
const emptyForm = () => ({ date: '', recipient: '', lines: [emptyLine()] });
function formatDate(value) {
  if (!value) return '';
  const [year, month, day] = value.split('-');
  return `${day}/${month}/${year}`;
}

export default function OutboundPage() {
  const [records, setRecords] = useState([]);
  const [products, setProducts] = useState([]);
  const [lotCatalog, setLotCatalog] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [mode, setMode] = useState('list');
  const [selected, setSelected] = useState(null);
  const [page, setPage] = useState(1);
  const [form, setForm] = useState(emptyForm);
  const [code, setCode] = useState('');
  const [formError, setFormError] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const { showDialog } = useFeedback();
  const { user } = useAuth();
  const unitByProduct = Object.fromEntries(products.map((item) => [item.id, item.unit]));

  useEffect(() => {
    let active = true;
    Promise.all([apiList('/api/stock-issues'), apiList('/api/cosmetics'), apiList('/api/lots')])
      .then(([issues, cosmetics, lots]) => {
        if (!active) return;
        setRecords(issues.map((item) => ({ ...item, date: formatDate(String(item.issueDate).slice(0, 10)), customer: item.creator, total: 0 })));
        setProducts(cosmetics.filter((item) => item.category === 'Dùng cho liệu trình'));
        setLotCatalog(lots.map((lot) => ({ id: lot.id, productId: lot.cosmeticId, expiry: String(lot.expiryDate).slice(0, 10), stock: Number(lot.stock) })));
      })
      .catch((error) => { if (active) showDialog({ title: 'Không tải được phiếu xuất kho', message: error.message }); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [showDialog]);
  const visibleRecords = useMemo(() => records.filter((item) => item.id.toLowerCase().includes(query.toLowerCase())), [records, query]);
  const pageCount = Math.max(1, Math.ceil(visibleRecords.length / 9));
  const pageRecords = visibleRecords.slice((page - 1) * 9, page * 9);

  const openCreate = () => {
    setCode('Tự động tạo');
    setForm({ ...emptyForm(), recipient: user?.full_name || user?.name || '' });
    setFormError('');
    setSubmitted(false);
    setMode('create');
  };

  const updateLine = (index, changes) => setForm((current) => ({
    ...current,
    lines: current.lines.map((line, lineIndex) => lineIndex === index ? { ...line, ...changes } : line),
  }));

  const saveIssue = async (event) => {
    event.preventDefault();
    setSubmitted(true);
    if (!form.recipient.trim() || !form.date || form.lines.some((line) => !line.product || !line.lot || Number(line.quantity) < 1)) {
      setFormError('Chưa hoàn tất thông tin, yêu cầu nhập lại');
      return;
    }
    const invalidQuantity = form.lines.some((line) => {
      const lot = lotCatalog.find((candidate) => candidate.id === line.lot);
      return !lot || Number(line.quantity) > lot.stock;
    });
    if (invalidQuantity) { setFormError('Số lượng xuất vượt quá số lượng tồn của lô'); return; }
    setFormError('');
    try {
      const created = await apiRequest('/api/stock-issues', {
        method: 'POST',
        body: { issueDate: form.date, items: form.lines.map((line) => ({ cosmeticId: line.product, batchId: line.lot, quantity: Number(line.quantity) })) },
      });
      const [rowsResult, cosmeticsResult, lotsResult] = await Promise.allSettled([
        apiList('/api/stock-issues'),
        apiList('/api/cosmetics'),
        apiList('/api/lots'),
      ]);
      const refreshed = rowsResult.status === 'fulfilled'
        ? rowsResult.value.map((item) => ({ ...item, date: formatDate(String(item.issueDate).slice(0, 10)), customer: item.creator, total: 0 }))
        : records;
      if (rowsResult.status === 'fulfilled') setRecords(refreshed);
      if (cosmeticsResult.status === 'fulfilled') setProducts(cosmeticsResult.value.filter((item) => item.category === 'Dùng cho liệu trình'));
      if (lotsResult.status === 'fulfilled') setLotCatalog(lotsResult.value.map((lot) => ({ id: lot.id, productId: lot.cosmeticId, expiry: String(lot.expiryDate).slice(0, 10), stock: Number(lot.stock) })));
      setMode('list');
      const createdRecord = refreshed.find((item) => item.id === created.id) ?? { id: created.id, issueDate: form.date, creator: form.recipient };
      if (createdRecord) await openDetail(createdRecord);
      showDialog({ tone: 'success', title: 'Tạo phiếu xuất thành công', message: 'Phiếu xuất và số lượng tồn kho đã được cập nhật trong SQL.' });
    } catch (error) {
      setFormError(error.message || 'Không thể lưu phiếu xuất kho vào SQL.');
    }
  };

  const openDetail = async (record) => {
    try {
      const detail = await apiRequest(`/api/stock-issues/${encodeURIComponent(record.id)}`);
      setSelected({ ...record, ...detail, date: formatDate(String(detail.issueDate).slice(0, 10)), customer: detail.creator, items: (detail.items ?? []).map((item) => ({ product: item.cosmeticName, unit: item.unit, lot: item.lotCode, quantity: item.quantity })) });
      setMode('detail');
    } catch (error) {
      showDialog({ title: 'Không tải được chi tiết phiếu xuất', message: error.message });
    }
  };

  const closeDetail = () => {
    setSelected(null);
    setMode('list');
  };

  if (loading) return <div className="panel data-loading" role="status">Đang tải phiếu xuất kho từ SQL…</div>;

  if (mode === 'detail' && selected) {
    return (
      <div className="page-stack outbound-detail-page">
        <PageHeader
          title="CHI TIẾT PHIẾU XUẤT KHO"
          actions={<Button variant="secondary" onClick={closeDetail}><ArrowLeft size={16} />Quay lại</Button>}
        />
        <section className="panel outbound-detail-panel">
          <h2>Thông tin chung</h2>
          <dl className="outbound-detail-panel__facts">
            <div><dt>Mã phiếu xuất</dt><dd>{selected.id}</dd></div>
            <div><dt>Người tạo phiếu</dt><dd>{selected.customer}</dd></div>
            <div><dt>Ngày xuất</dt><dd>{selected.date}</dd></div>
          </dl>
          <h2 className="outbound-detail-panel__table-title">Danh sách mỹ phẩm được xuất</h2>
          <DataTable
            fitContainer
            ariaLabel="Danh sách mỹ phẩm được xuất"
            columns={[
              { key: 'index', label: 'STT', width: '9%', align: 'center', render: (_, index) => index + 1 },
              { key: 'product', label: 'Tên sản phẩm', width: '31%' },
              { key: 'unit', label: 'Đơn vị tính', width: '18%', align: 'center' },
              { key: 'quantity', label: 'Số lượng', width: '18%', align: 'center' },
              { key: 'lot', label: 'Lô hàng', width: '24%', align: 'center', nowrap: true },
            ]}
            rows={selected.items ?? []}
            rowKey="cosmeticId"
            emptyMessage="Phiếu xuất kho chưa có dòng mỹ phẩm."
          />
        </section>
      </div>
    );
  }

  const columns = [
    { key: 'index', label: 'STT', width: '8%', minWidth: 70, align: 'center', render: (_, index) => index + 1 },
    { key: 'id', label: 'Mã phiếu xuất', width: '30.67%', align: 'center', render: (record) => <button type="button" className="table-link" onClick={() => openDetail(record)}>{record.id}</button> },
    { key: 'date', label: 'Ngày xuất', width: '30.67%', align: 'center' },
    { key: 'total', label: 'Tổng tiền', width: '30.66%', align: 'right', nowrap: true, render: (record) => record.total ? `${new Intl.NumberFormat('vi-VN').format(record.total)} ₫` : '—' },
  ];

  if (mode === 'create') {
    return (
      <div className="page-stack">
        <PageHeader
          title="TẠO PHIẾU XUẤT KHO"
          fallbackPath="/phieu-xuat-kho"
          onBack={() => setCancelOpen(true)}
        />
        <section className="panel inventory-form-panel">
          <form onSubmit={saveIssue} noValidate>
            {formError && <p className="field__error outbound-form-error" role="alert">{formError}</p>}
            <div className="form-grid inventory-meta-grid">
              <TextField label="Mã phiếu xuất" value={code} readOnly />
              <TextField label="Người tạo phiếu *" value={form.recipient} onChange={(event) => setForm({ ...form, recipient: event.target.value })} placeholder="Nhập người tạo phiếu" required />
              <TextField label="Ngày xuất *" type="date" value={form.date} onChange={(event) => setForm({ ...form, date: event.target.value })} required />
            </div>
            <div className="inventory-section-title-row"><h2 className="inventory-section-title">Danh sách sản phẩm xuất</h2><Button type="button" variant="secondary" onClick={() => setForm((current) => ({ ...current, lines: [...current.lines, emptyLine()] }))}><Plus size={16} />Thêm dòng</Button></div>
            <div className="line-items-scroll">
              <table className="line-items-table outbound-line-items">
                <colgroup><col style={{ width: '23%' }} /><col style={{ width: '8%' }} /><col style={{ width: '20%' }} /><col style={{ width: '13%' }} /><col style={{ width: '15%' }} /><col style={{ width: '18%' }} /><col style={{ width: '3%' }} /></colgroup>
                <thead><tr><th>Tên sản phẩm</th><th>Đơn vị</th><th>Lô hàng</th><th>Hạn sử dụng</th><th>Số lượng tồn lô</th><th>Số lượng xuất</th><th></th></tr></thead>
                <tbody>
                  {form.lines.map((line, index) => {
                    const productLots = lotCatalog.filter((lot) => lot.productId === line.product);
                    const selectedLot = productLots.find((lot) => lot.id === line.lot);
                    return <tr key={`outbound-${index}`}>
                      <td><SelectField className="inventory-line-select" aria-label="Tên sản phẩm" value={line.product} onChange={(event) => updateLine(index, { product: event.target.value, lot: '', quantity: '' })} options={[{ value: '', label: 'Chọn sản phẩm' }, ...products.map((item) => ({ value: item.id, label: item.name }))]} required /></td>
                      <td><span className="form-readonly">{line.product ? (unitByProduct[line.product] ?? '—') : ''}</span></td>
                      <td><div className="inventory-line-field"><SelectField className="inventory-line-select" aria-label="Lô hàng" value={line.lot} onChange={(event) => updateLine(index, { lot: event.target.value, quantity: '' })} options={[{ value: '', label: 'Chọn lô hàng' }, ...productLots.map((lot) => ({ value: lot.id, label: lot.id }))]} disabled={!line.product} required />{submitted && line.product && !productLots.length && <p className="field__error">Sản phẩm đã hết hàng!</p>}{submitted && line.product && productLots.length > 0 && !line.lot && <p className="field__error">Vui lòng chọn lô hàng.</p>}</div></td>
                      <td><span className="form-readonly">{selectedLot ? formatDate(selectedLot.expiry) : ''}</span></td>
                      <td><span className="form-readonly">{selectedLot ? selectedLot.stock : ''}</span></td>
                      <td><div className="inventory-line-field"><TextField className="inventory-line-select" aria-label="Số lượng xuất" type="number" min="1" max={selectedLot?.stock} value={line.quantity} onChange={(event) => updateLine(index, { quantity: event.target.value })} placeholder="Nhập số lượng" disabled={!selectedLot} required />{submitted && selectedLot && Number(line.quantity) > selectedLot.stock && <p className="field__error inventory-line-error--wrap">Số lượng xuất vượt quá số lượng tồn của lô</p>}{submitted && line.quantity !== '' && Number(line.quantity) < 1 && <p className="field__error">Số lượng không hợp lệ!</p>}</div></td>
                      <td><button className="icon-button line-item-remove" type="button" aria-label="Xóa dòng sản phẩm" disabled={form.lines.length === 1} onClick={() => setForm((current) => ({ ...current, lines: current.lines.filter((_, lineIndex) => lineIndex !== index) }))}><Trash2 size={16} /></button></td>
                    </tr>;
                  })}
                </tbody>
              </table>
            </div>
            <div className="form-actions"><Button type="button" variant="secondary" onClick={() => setCancelOpen(true)}>Hủy</Button><Button type="submit">Lưu</Button></div>
          </form>
        </section>
        <ConfirmDialog open={cancelOpen} title="Xác nhận hủy" message="Các thay đổi sẽ không được lưu. Bạn có chắc chắn muốn hủy?" onCancel={() => setCancelOpen(false)} onConfirm={() => { setCancelOpen(false); setMode('list'); }} />
      </div>
    );
  }

  return (
    <div className="page-stack">
      <PageHeader title="DANH SÁCH PHIẾU XUẤT KHO" />
      <div className="inventory-list-panel">
        <PageListToolbar className="inventory-toolbar" search={<SearchBox value={query} onChange={(value) => { setQuery(value); setPage(1); }} placeholder="Nhập từ khóa cần tra cứu..." />} actions={<Button onClick={openCreate}><Plus size={18} />Tạo phiếu xuất kho</Button>} />
        <DataTable className="data-table--inventory" columns={columns} rows={pageRecords} rowKey="id" emptyMessage="Không tìm thấy phiếu xuất kho phù hợp!" />
        <div className="panel__footer"><Pagination page={page} pageCount={pageCount} onChange={setPage} /></div>
      </div>
    </div>
  );
}
