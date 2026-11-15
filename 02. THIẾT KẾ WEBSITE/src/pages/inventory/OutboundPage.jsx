import { useMemo, useState } from 'react';
import { ArrowLeft, Plus, Trash2 } from 'lucide-react';
import Button from '../../components/ui/Button.jsx';
import DataTable from '../../components/ui/DataTable.jsx';
import Modal from '../../components/ui/Modal.jsx';
import PageHeader from '../../components/ui/PageHeader.jsx';
import PageListToolbar from '../../components/ui/PageListToolbar.jsx';
import Pagination from '../../components/ui/Pagination.jsx';
import SearchBox from '../../components/ui/SearchBox.jsx';
import SelectField from '../../components/ui/SelectField.jsx';
import TextField from '../../components/ui/TextField.jsx';
import { outboundRecords as initialRecords, products } from '../../data/mockData.js';

const lotCatalog = [
  { id: 'L-20261021-01', productId: 'MP001', expiry: '2028-10-21', stock: 24 },
  { id: 'L-20260915-02', productId: 'MP002', expiry: '2028-09-15', stock: 18 },
  { id: 'L-20260820-03', productId: 'MP003', expiry: '2028-08-20', stock: 12 },
];
const emptyLine = () => ({ product: '', lot: '', quantity: '' });
const emptyForm = () => ({ date: '', recipient: '', lines: [emptyLine()] });
const unitByProduct = { MP001: 'Chai', MP002: 'Chai', MP003: 'Hũ', MP004: 'Gói', MP005: 'Chai', MP006: 'Chai', MP007: 'Hũ', MP008: 'Chai' };

function formatDate(value) {
  if (!value) return '';
  const [year, month, day] = value.split('-');
  return `${day}/${month}/${year}`;
}

export default function OutboundPage() {
  const [records, setRecords] = useState(initialRecords);
  const [query, setQuery] = useState('');
  const [mode, setMode] = useState('list');
  const [selected, setSelected] = useState(null);
  const [page, setPage] = useState(1);
  const [form, setForm] = useState(emptyForm);
  const [code, setCode] = useState('');
  const visibleRecords = useMemo(() => records.filter((item) => item.id.toLowerCase().includes(query.toLowerCase())), [records, query]);
  const pageCount = Math.max(1, Math.ceil(visibleRecords.length / 9));
  const pageRecords = visibleRecords.slice((page - 1) * 9, page * 9);

  const openCreate = () => {
    const today = new Date().toISOString().slice(0, 10).replaceAll('-', '');
    setCode(`PXK-${today}-${String(records.length + 1).padStart(3, '0')}`);
    setForm(emptyForm());
    setMode('create');
  };

  const updateLine = (index, changes) => setForm((current) => ({
    ...current,
    lines: current.lines.map((line, lineIndex) => lineIndex === index ? { ...line, ...changes } : line),
  }));

  const saveIssue = (event) => {
    event.preventDefault();
    const firstLine = form.lines.find((line) => line.product);
    const newRecord = {
      id: code,
      date: new Date(`${form.date}T00:00:00`).toLocaleDateString('vi-VN'),
      customer: form.recipient,
      total: 0,
      product: products.find((item) => item.id === firstLine?.product)?.name ?? '',
      quantity: Number(firstLine?.quantity) || 0,
      items: form.lines.filter((line) => line.product).map((line) => ({
        product: products.find((item) => item.id === line.product)?.name ?? '',
        lot: line.lot,
        quantity: Number(line.quantity),
      })),
    };
    setRecords((current) => [newRecord, ...current]);
    setSelected(newRecord);
    setMode('list');
  };

  const columns = [
    { key: 'index', label: 'STT', width: '10%', align: 'center', render: (_, index) => index + 1 },
    { key: 'id', label: 'Mã phiếu xuất', width: '34%', align: 'center', render: (record) => <button type="button" className="table-link" onClick={() => setSelected(record)}>{record.id}</button> },
    { key: 'date', label: 'Ngày xuất', width: '25%', align: 'center' },
    { key: 'total', label: 'Tổng tiền', width: '31%', align: 'right', render: (record) => record.total ? `${new Intl.NumberFormat('vi-VN').format(record.total)} ₫` : '—' },
  ];

  if (mode === 'create') {
    return (
      <div className="page-stack">
        <PageHeader title="TẠO PHIẾU XUẤT KHO" actions={<Button variant="secondary" onClick={() => setMode('list')}><ArrowLeft size={17} />Quay lại</Button>} />
        <section className="panel inventory-form-panel">
          <form onSubmit={saveIssue}>
            <div className="form-grid inventory-meta-grid">
              <TextField label="Mã phiếu xuất" value={code} readOnly />
              <TextField label="Người tạo phiếu *" value={form.recipient} onChange={(event) => setForm({ ...form, recipient: event.target.value })} placeholder="Nhập người tạo phiếu" required />
              <TextField label="Ngày xuất *" type="date" value={form.date} onChange={(event) => setForm({ ...form, date: event.target.value })} required />
            </div>
            <div className="inventory-section-title-row"><h2 className="inventory-section-title">Danh sách sản phẩm xuất</h2><Button type="button" variant="secondary" onClick={() => setForm((current) => ({ ...current, lines: [...current.lines, emptyLine()] }))}><Plus size={16} />Thêm dòng</Button></div>
            <div className="line-items-scroll">
              <table className="line-items-table outbound-line-items">
                <thead><tr><th>Tên sản phẩm</th><th>Đơn vị</th><th>Lô hàng</th><th>Hạn sử dụng</th><th>Số lượng tồn lô</th><th>Số lượng xuất</th><th></th></tr></thead>
                <tbody>
                  {form.lines.map((line, index) => {
                    const productLots = lotCatalog.filter((lot) => lot.productId === line.product);
                    const selectedLot = productLots.find((lot) => lot.id === line.lot);
                    return <tr key={`outbound-${index}`}>
                      <td><SelectField aria-label="Tên sản phẩm" value={line.product} onChange={(event) => updateLine(index, { product: event.target.value, lot: '', quantity: '' })} options={[{ value: '', label: 'Chọn sản phẩm' }, ...products.map((item) => ({ value: item.id, label: item.name }))]} required /></td>
                      <td><span className="form-readonly">{line.product ? (unitByProduct[line.product] ?? '—') : ''}</span></td>
                      <td><SelectField aria-label="Lô hàng" value={line.lot} onChange={(event) => updateLine(index, { lot: event.target.value, quantity: '' })} options={[{ value: '', label: line.product ? 'Chọn lô hàng' : 'Chọn sản phẩm trước' }, ...productLots.map((lot) => ({ value: lot.id, label: lot.id }))]} disabled={!line.product} required /></td>
                      <td><span className="form-readonly">{selectedLot ? formatDate(selectedLot.expiry) : ''}</span></td>
                      <td><span className="form-readonly">{selectedLot ? selectedLot.stock : ''}</span></td>
                      <td><TextField aria-label="Số lượng xuất" type="number" min="1" max={selectedLot?.stock} value={line.quantity} onChange={(event) => updateLine(index, { quantity: event.target.value })} placeholder="Nhập số lượng" disabled={!selectedLot} required /></td>
                      <td><button className="icon-button line-item-remove" type="button" aria-label="Xóa dòng sản phẩm" disabled={form.lines.length === 1} onClick={() => setForm((current) => ({ ...current, lines: current.lines.filter((_, lineIndex) => lineIndex !== index) }))}><Trash2 size={16} /></button></td>
                    </tr>;
                  })}
                </tbody>
              </table>
            </div>
            <div className="form-actions"><Button type="button" variant="secondary" onClick={() => setMode('list')}>Hủy</Button><Button type="submit">Lưu</Button></div>
          </form>
        </section>
      </div>
    );
  }

  return (
    <div className="page-stack">
      <PageHeader title="DANH SÁCH PHIẾU XUẤT KHO" />
      <section className="panel inventory-list-panel">
        <PageListToolbar className="inventory-toolbar" search={<SearchBox value={query} onChange={(value) => { setQuery(value); setPage(1); }} placeholder="Nhập từ khóa cần tra cứu..." />} actions={<Button onClick={openCreate}><Plus size={18} />Tạo phiếu xuất kho</Button>} />
        <DataTable columns={columns} rows={pageRecords} rowKey="id" emptyMessage="Không tìm thấy phiếu xuất kho phù hợp!" />
        <div className="panel__footer"><Pagination page={page} pageCount={pageCount} onChange={setPage} /></div>
      </section>
      <Modal open={Boolean(selected)} title="CHI TIẾT PHIẾU XUẤT KHO" onClose={() => setSelected(null)} size="large">
        {selected && <div className="detail-content">
          <dl className="detail-grid"><div><dt>Mã phiếu xuất</dt><dd>{selected.id}</dd></div><div><dt>Người tạo phiếu</dt><dd>{selected.customer}</dd></div><div><dt>Ngày xuất</dt><dd>{selected.date}</dd></div><div><dt>Tổng tiền</dt><dd>{selected.total ? `${new Intl.NumberFormat('vi-VN').format(selected.total)} ₫` : '—'}</dd></div></dl>
          <DataTable columns={[{ key: 'product', label: 'Tên sản phẩm' }, { key: 'lot', label: 'Lô hàng', align: 'center' }, { key: 'quantity', label: 'Số lượng xuất', align: 'center' }]} rows={selected.items ?? [{ product: selected.product ?? '', lot: '', quantity: selected.quantity ?? '' }]} />
          <div className="modal-form-actions"><Button variant="secondary" onClick={() => setSelected(null)}>Đóng</Button></div>
        </div>}
      </Modal>
    </div>
  );
}
