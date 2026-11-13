import { useMemo, useState } from 'react';
import { ArrowLeft, Plus, Trash2 } from 'lucide-react';
import Button from '../../components/ui/Button.jsx';
import DataTable from '../../components/ui/DataTable.jsx';
import Modal from '../../components/ui/Modal.jsx';
import PageHeader from '../../components/ui/PageHeader.jsx';
import Pagination from '../../components/ui/Pagination.jsx';
import SearchBox from '../../components/ui/SearchBox.jsx';
import SelectField from '../../components/ui/SelectField.jsx';
import TextField from '../../components/ui/TextField.jsx';
import { formatCurrency, outboundRecords as initialRecords, products } from '../../data/mockData.js';

export default function OutboundPage() {
  const [records, setRecords] = useState(initialRecords);
  const [query, setQuery] = useState('');
  const [mode, setMode] = useState('list');
  const [selected, setSelected] = useState(null);
  const [page, setPage] = useState(1);
  const [form, setForm] = useState({ product: products[0].id, lot: 'L-20261021-01', quantity: 3, date: '2026-11-12', recipient: 'Lê Thị Thu Hương' });
  const [extraRows, setExtraRows] = useState([]);
  const visibleRecords = useMemo(() => records.filter((item) => item.id.toLowerCase().includes(query.toLowerCase())), [records, query]);
  const pageCount = Math.max(1, Math.ceil(visibleRecords.length / 9));
  const pageRecords = visibleRecords.slice((page - 1) * 9, page * 9);
  const selectedProduct = products.find((item) => item.id === form.product) ?? products[0];
  const totalAmount = selectedProduct.price * Number(form.quantity) + extraRows.reduce((total, row) => {
    const product = products.find((item) => item.id === row.product) ?? products[0];
    return total + product.price * Number(row.quantity);
  }, 0);

  const saveIssue = (event) => {
    event.preventDefault();
    const newRecord = {
      id: `PXK-20261112-${String(records.length + 1).padStart(3, '0')}`,
      date: new Date(`${form.date}T00:00:00`).toLocaleDateString('vi-VN'),
      customer: form.recipient,
      total: totalAmount,
      product: selectedProduct.name,
      quantity: Number(form.quantity),
    };
    setRecords((current) => [newRecord, ...current]);
    setSelected(newRecord);
    setMode('list');
  };

  const columns = [
    { key: 'index', label: 'STT', width: '10%', render: (_, index) => index + 1 },
    { key: 'id', label: 'Mã phiếu xuất', width: '34%', render: (record) => <button type="button" className="table-link" onClick={() => setSelected(record)}>{record.id}</button> },
    { key: 'date', label: 'Ngày xuất', width: '25%' },
    { key: 'total', label: 'Tổng tiền', width: '31%', render: (record) => formatCurrency(record.total) },
  ];

  if (mode === 'create') {
    return (
      <div className="page-stack">
        <PageHeader title="TẠO PHIẾU XUẤT KHO" actions={<Button variant="secondary" onClick={() => setMode('list')}><ArrowLeft size={17} />Quay lại</Button>} />
        <section className="panel inventory-form-panel">
          <form onSubmit={saveIssue}>
            <div className="form-grid inventory-meta-grid">
              <TextField label="Mã phiếu xuất" value="PXK-20261112-006" readOnly />
              <TextField label="Người tạo phiếu *" value={form.recipient} onChange={(event) => setForm({ ...form, recipient: event.target.value })} required />
              <TextField label="Ngày xuất *" type="date" value={form.date} onChange={(event) => setForm({ ...form, date: event.target.value })} required />
            </div>
            <div className="inventory-section-title-row"><h2 className="inventory-section-title">Danh sách sản phẩm xuất</h2><Button variant="secondary" onClick={() => setExtraRows((current) => [...current, { product: products[1].id, lot: 'L-20260915-02', quantity: 1 }])}><Plus size={16} />Thêm dòng</Button></div>
            <div className="line-items-scroll">
              <table className="line-items-table outbound-line-items">
                <thead><tr><th>Tên sản phẩm</th><th>Đơn vị</th><th>Lô hàng</th><th>Số lượng xuất</th><th>Thành tiền</th><th></th></tr></thead>
                <tbody>
                  <tr>
                    <td><SelectField aria-label="Tên sản phẩm" value={form.product} onChange={(event) => setForm({ ...form, product: event.target.value })} options={products.map((item) => ({ value: item.id, label: item.name }))} required /></td>
                    <td><span className="form-readonly">Chai</span></td>
                    <td><SelectField aria-label="Lô hàng" value={form.lot} onChange={(event) => setForm({ ...form, lot: event.target.value })} options={['L-20261021-01', 'L-20260915-02', 'L-20260820-03']} /></td>
                    <td><TextField aria-label="Số lượng xuất" type="number" min="1" max={selectedProduct.stock} value={form.quantity} onChange={(event) => setForm({ ...form, quantity: event.target.value })} required /></td>
                    <td>{formatCurrency(selectedProduct.price * Number(form.quantity))}</td>
                    <td><button className="icon-button line-item-remove" type="button" aria-label="Xóa sản phẩm" onClick={() => setForm({ ...form, product: '', quantity: '' })}><Trash2 size={16} /></button></td>
                  </tr>
                  {extraRows.map((row, index) => {
                    const rowProduct = products.find((item) => item.id === row.product) ?? products[0];
                    return <tr key={`extra-${index}`}>
                      <td><SelectField aria-label="Tên sản phẩm" value={row.product} onChange={(event) => setExtraRows((current) => current.map((item, rowIndex) => rowIndex === index ? { ...item, product: event.target.value } : item))} options={products.map((item) => ({ value: item.id, label: item.name }))} required /></td>
                      <td><span className="form-readonly">Chai</span></td>
                      <td><SelectField aria-label="Lô hàng" value={row.lot} onChange={(event) => setExtraRows((current) => current.map((item, rowIndex) => rowIndex === index ? { ...item, lot: event.target.value } : item))} options={['L-20261021-01', 'L-20260915-02', 'L-20260820-03']} /></td>
                      <td><TextField aria-label="Số lượng xuất" type="number" min="1" value={row.quantity} onChange={(event) => setExtraRows((current) => current.map((item, rowIndex) => rowIndex === index ? { ...item, quantity: event.target.value } : item))} required /></td>
                      <td>{formatCurrency(rowProduct.price * Number(row.quantity))}</td>
                      <td><button className="icon-button line-item-remove" type="button" aria-label="Xóa dòng sản phẩm" onClick={() => setExtraRows((current) => current.filter((_, rowIndex) => rowIndex !== index))}><Trash2 size={16} /></button></td>
                    </tr>;
                  })}
                </tbody>
              </table>
            </div>
            <div className="inventory-total"><strong>Tổng tiền xuất</strong><b>{formatCurrency(totalAmount)}</b></div>
            <div className="form-actions"><Button variant="secondary" onClick={() => setMode('list')}>Hủy</Button><Button type="submit">Lưu</Button></div>
          </form>
        </section>
      </div>
    );
  }

  return (
    <div className="page-stack">
      <PageHeader title="PHIẾU XUẤT KHO" />
      <section className="panel inventory-list-panel">
        <header className="panel__header"><h2>Danh sách phiếu xuất kho</h2></header>
        <div className="page-list-toolbar inventory-toolbar">
          <SearchBox value={query} onChange={(value) => { setQuery(value); setPage(1); }} placeholder="Nhập từ khóa cần tra cứu..." />
          <Button onClick={() => setMode('create')}><Plus size={18} />Tạo phiếu xuất kho</Button>
        </div>
        <DataTable columns={columns} rows={pageRecords} rowKey="id" emptyMessage="Không tìm thấy phiếu xuất kho phù hợp!" />
        <div className="panel__footer"><Pagination page={page} pageCount={pageCount} onChange={setPage} /></div>
      </section>
      <Modal open={Boolean(selected)} title="CHI TIẾT PHIẾU XUẤT KHO" onClose={() => setSelected(null)} size="large">
        {selected && <div className="detail-content">
          <dl className="detail-grid">
            <div><dt>Mã phiếu xuất</dt><dd>{selected.id}</dd></div>
            <div><dt>Người tạo phiếu</dt><dd>{selected.customer}</dd></div>
            <div><dt>Ngày xuất</dt><dd>{selected.date}</dd></div>
            <div><dt>Tổng tiền</dt><dd>{formatCurrency(selected.total)}</dd></div>
          </dl>
          <DataTable columns={[{ key: 'product', label: 'Tên sản phẩm' }, { key: 'lot', label: 'Lô hàng' }, { key: 'quantity', label: 'Số lượng xuất' }, { key: 'total', label: 'Thành tiền', render: () => formatCurrency(selected.total) }]} rows={[{ product: selected.product ?? products[0].name, lot: form.lot, quantity: selected.quantity ?? 3, total: selected.total }]} />
          <div className="modal-form-actions"><Button variant="secondary" onClick={() => setSelected(null)}>Đóng</Button></div>
        </div>}
      </Modal>
    </div>
  );
}
