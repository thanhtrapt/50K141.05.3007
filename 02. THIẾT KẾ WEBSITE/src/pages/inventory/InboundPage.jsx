import { useMemo, useState } from 'react';
import { ArrowLeft, Plus } from 'lucide-react';
import Button from '../../components/ui/Button.jsx';
import DataTable from '../../components/ui/DataTable.jsx';
import Modal from '../../components/ui/Modal.jsx';
import PageHeader from '../../components/ui/PageHeader.jsx';
import Pagination from '../../components/ui/Pagination.jsx';
import SearchBox from '../../components/ui/SearchBox.jsx';
import SelectField from '../../components/ui/SelectField.jsx';
import TextField from '../../components/ui/TextField.jsx';
import { formatCurrency, inboundRecords as initialRecords, products } from '../../data/mockData.js';

export default function InboundPage() {
  const [records, setRecords] = useState(initialRecords);
  const [query, setQuery] = useState('');
  const [mode, setMode] = useState('list');
  const [selected, setSelected] = useState(null);
  const [lotSelected, setLotSelected] = useState(false);
  const [page, setPage] = useState(1);
  const [form, setForm] = useState({ product: products[0].id, quantity: 10, price: 180000, date: '2026-10-30', supplier: 'Lê Thị Thu Hương' });
  const visibleRecords = useMemo(() => records.filter((item) => item.id.toLowerCase().includes(query.toLowerCase())), [records, query]);
  const pageCount = Math.max(1, Math.ceil(visibleRecords.length / 5));
  const pageRecords = visibleRecords.slice((page - 1) * 5, page * 5);

  const saveReceipt = (event) => {
    event.preventDefault();
    const nextNumber = String(records.length + 1).padStart(3, '0');
    const newRecord = {
      id: `PNK-20261112-${nextNumber}`,
      date: new Date(`${form.date}T00:00:00`).toLocaleDateString('vi-VN'),
      total: Number(form.quantity) * Number(form.price),
    };
    setRecords((current) => [newRecord, ...current]);
    setSelected({ ...newRecord, product: products.find((item) => item.id === form.product)?.name, quantity: Number(form.quantity) });
    setMode('list');
  };

  const columns = [
    { key: 'index', label: 'STT', width: '10%', render: (_, index) => index + 1 },
    { key: 'id', label: 'Mã phiếu nhập', width: '34%', render: (record) => <button type="button" className="table-link" onClick={() => setSelected(record)}>{record.id}</button> },
    { key: 'date', label: 'Ngày nhập', width: '25%' },
    { key: 'total', label: 'Tổng tiền', width: '31%', render: (record) => formatCurrency(record.total) },
  ];

  if (mode === 'create') {
    return (
      <div className="page-stack">
        <PageHeader title="TẠO PHIẾU NHẬP KHO" actions={<Button variant="secondary" onClick={() => setMode('list')}><ArrowLeft size={17} />Quay lại</Button>} />
        <section className="panel inventory-form-panel">
          <form onSubmit={saveReceipt}>
            <div className="form-grid inventory-meta-grid">
              <TextField label="Mã phiếu nhập" value="PNK-20261112-006" readOnly />
              <TextField label="Người nhập kho *" value={form.supplier} onChange={(event) => setForm({ ...form, supplier: event.target.value })} required />
              <TextField label="Ngày nhập *" type="date" value={form.date} onChange={(event) => setForm({ ...form, date: event.target.value })} required />
              <SelectField label="Trạng thái thanh toán *" value="Chưa thanh toán" options={['Chưa thanh toán', 'Đã thanh toán']} />
            </div>
            <h2 className="inventory-section-title">Danh sách sản phẩm</h2>
            <div className="line-items-scroll">
              <table className="line-items-table">
                <thead><tr><th>Tên sản phẩm</th><th>Đơn vị</th><th>Giá nhập</th><th>Số lượng nhập</th><th>Thành tiền</th><th>Lô nhập hàng</th></tr></thead>
                <tbody><tr>
                  <td><SelectField aria-label="Tên sản phẩm" value={form.product} onChange={(event) => setForm({ ...form, product: event.target.value })} options={products.map((item) => ({ value: item.id, label: item.name }))} /></td>
                  <td><span className="form-readonly">Chai</span></td>
                  <td><TextField aria-label="Giá nhập" type="number" min="0" value={form.price} onChange={(event) => setForm({ ...form, price: event.target.value })} required /></td>
                  <td><TextField aria-label="Số lượng nhập" type="number" min="1" value={form.quantity} onChange={(event) => setForm({ ...form, quantity: event.target.value })} required /></td>
                  <td>{formatCurrency(Number(form.price) * Number(form.quantity))}</td>
                  <td><button className="table-link" type="button" onClick={() => setSelected({ lotForm: true })}>{lotSelected ? 'L-20261030-04' : 'Chọn lô nhập'}</button></td>
                </tr></tbody>
              </table>
            </div>
            <div className="inventory-total"><strong>Tổng tiền nhập</strong><b>{formatCurrency(Number(form.price) * Number(form.quantity))}</b></div>
            <div className="form-actions"><Button variant="secondary" onClick={() => setMode('list')}>Hủy</Button><Button type="submit">Lưu</Button></div>
          </form>
        </section>
        <Modal open={Boolean(selected?.lotForm)} title="Thêm lô sản phẩm" onClose={() => setSelected(null)}>
          <div className="form-grid"><TextField label="Mã lô" value="L-20261030-04" readOnly /><TextField label="Ngày sản xuất *" type="date" defaultValue="2026-05-01" /><TextField label="Hạn sử dụng *" type="date" defaultValue="2027-05-01" /><div className="modal-form-actions form-grid__wide"><Button variant="secondary" onClick={() => setSelected(null)}>Hủy</Button><Button onClick={() => { setLotSelected(true); setSelected(null); }}>Thêm lô</Button></div></div>
        </Modal>
      </div>
    );
  }

  return (
    <div className="page-stack">
      <PageHeader title="PHIẾU NHẬP KHO" />
      <section className="panel inventory-list-panel">
        <header className="panel__header"><h2>Danh sách phiếu nhập kho</h2></header>
        <div className="page-list-toolbar inventory-toolbar">
          <SearchBox value={query} onChange={(value) => { setQuery(value); setPage(1); }} placeholder="Nhập từ khóa cần tra cứu..." />
          <Button onClick={() => setMode('create')}><Plus size={18} />Tạo phiếu nhập kho</Button>
        </div>
        <DataTable columns={columns} rows={pageRecords} rowKey="id" emptyMessage="Không tìm thấy phiếu nhập kho phù hợp!" />
        <div className="panel__footer"><Pagination page={page} pageCount={pageCount} onChange={setPage} /></div>
      </section>
      <Modal open={Boolean(selected && !selected.lotForm)} title="CHI TIẾT PHIẾU NHẬP KHO" onClose={() => setSelected(null)} size="large">
        {selected && <div className="detail-content">
          <dl className="detail-grid">
            <div><dt>Mã phiếu nhập</dt><dd>{selected.id}</dd></div>
            <div><dt>Người nhập đơn</dt><dd>Lê Thị Thu Hương</dd></div>
            <div><dt>Ngày nhập</dt><dd>{selected.date}</dd></div>
            <div><dt>Trạng thái thanh toán</dt><dd>Chưa thanh toán</dd></div>
          </dl>
          <DataTable columns={[{ key: 'product', label: 'Tên sản phẩm' }, { key: 'quantity', label: 'Số lượng' }, { key: 'price', label: 'Giá nhập' }, { key: 'total', label: 'Thành tiền', render: () => formatCurrency(selected.total) }]} rows={[{ product: selected.product ?? products[0].name, quantity: selected.quantity ?? 10, price: formatCurrency(products[0].price), total: selected.total }]} />
          <div className="inventory-total"><strong>Tổng tiền</strong><b>{formatCurrency(selected.total)}</b></div>
          <div className="modal-form-actions"><Button variant="secondary" onClick={() => setSelected(null)}>Đóng</Button></div>
        </div>}
      </Modal>
    </div>
  );
}
