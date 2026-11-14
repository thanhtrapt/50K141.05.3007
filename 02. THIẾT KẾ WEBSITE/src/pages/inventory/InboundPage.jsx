import { useMemo, useState } from 'react';
import { PackagePlus, Plus, Search, Trash2 } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import Button from '../../components/ui/Button.jsx';
import DataTable from '../../components/ui/DataTable.jsx';
import FeatureNotFound from '../../components/ui/FeatureNotFound.jsx';
import Modal from '../../components/ui/Modal.jsx';
import PageHeader from '../../components/ui/PageHeader.jsx';
import PageListToolbar from '../../components/ui/PageListToolbar.jsx';
import Pagination from '../../components/ui/Pagination.jsx';
import SearchBox from '../../components/ui/SearchBox.jsx';
import SelectField from '../../components/ui/SelectField.jsx';
import StatusBadge from '../../components/ui/StatusBadge.jsx';
import TextField from '../../components/ui/TextField.jsx';
import { formatCurrency, inboundRecords as initialRecords, products as initialProducts } from '../../data/mockData.js';

let nextLineId = 1;
const units = ['Chai', 'Lọ', 'Tuýp', 'Hộp', 'Gói'];

function blankLine() {
  return { id: `inbound-line-${nextLineId++}`, productId: '', productQuery: '', unit: '', price: '0', quantity: '0', lots: [] };
}

function initialLotCatalog() {
  return {
    MP002: [
      { id: '090926-2', status: 'Còn hạn', manufactureDate: '2026-09-01', expiryDate: '2028-09-01', stock: 0 },
      { id: '050726-3', status: 'Còn hạn', manufactureDate: '2026-06-01', expiryDate: '2028-06-01', stock: 0 },
    ],
  };
}

function formatDate(value) {
  if (!value) return '';
  const [year, month, day] = value.split('-');
  return `${day}/${month}/${year}`;
}

function toLotCode(date, suffix) {
  if (!date) return `041026-${suffix}`;
  const [year, month, day] = date.split('-');
  return `${day}${month}${year.slice(-2)}-${suffix}`;
}

function initialForm(records) {
  return {
    date: '2026-10-30',
    supplier: 'Lê Thị Thu Hương',
    paymentStatus: 'Chưa thanh toán',
    items: [blankLine()],
    code: `PNK-20261030-${String(records.length + 1).padStart(3, '0')}`,
  };
}

export default function InboundPage() {
  const [records, setRecords] = useState(initialRecords);
  const [products, setProducts] = useState(initialProducts);
  const [lotsByProduct, setLotsByProduct] = useState(initialLotCatalog);
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [form, setForm] = useState(() => initialForm(initialRecords));
  const [formError, setFormError] = useState('');
  const [openProductId, setOpenProductId] = useState(null);
  const [newProductOpen, setNewProductOpen] = useState(false);
  const [newProductRow, setNewProductRow] = useState(null);
  const [newProduct, setNewProduct] = useState({ name: '', unit: '' });
  const [lotDialogRowId, setLotDialogRowId] = useState(null);
  const [lotSearch, setLotSearch] = useState('');
  const [selectedLotIds, setSelectedLotIds] = useState([]);
  const [newLotOpen, setNewLotOpen] = useState(false);
  const [lotDraft, setLotDraft] = useState({ manufactureDate: '', expiryDate: '' });
  const [lotError, setLotError] = useState('');
  const location = useLocation();
  const navigate = useNavigate();

  const routePart = location.pathname.replace(/^\/phieu-nhap-kho\/?/, '').split('/').filter(Boolean)[0];
  const isCreate = routePart === 'tao-moi';
  const receiptId = routePart && !isCreate ? routePart : null;
  const selectedReceipt = records.find((record) => record.id === receiptId);
  const visibleRecords = useMemo(() => records.filter((item) => item.id.toLowerCase().includes(query.toLowerCase())), [records, query]);
  const pageCount = Math.max(1, Math.ceil(visibleRecords.length / 5));
  const pageRecords = visibleRecords.slice((page - 1) * 5, page * 5);
  const total = form.items.reduce((sum, item) => sum + (Number(item.price) || 0) * (Number(item.quantity) || 0), 0);

  const updateLine = (lineId, updates) => setForm((current) => ({
    ...current,
    items: current.items.map((item) => item.id === lineId ? { ...item, ...updates } : item),
  }));

  const openCreate = () => {
    setForm(initialForm(records));
    setFormError('');
    navigate('/phieu-nhap-kho/tao-moi');
  };

  const chooseProduct = (lineId, product) => {
    updateLine(lineId, {
      productId: product.id,
      productQuery: product.name,
      unit: product.unit || 'Chai',
      price: String(product.price || 0),
      quantity: '0',
      lots: [],
    });
    setOpenProductId(null);
  };

  const addProduct = (event) => {
    event.preventDefault();
    if (!newProductRow || !newProduct.name.trim() || !newProduct.unit) return;
    const id = `MP${String(products.length + 1).padStart(3, '0')}`;
    const product = { id, name: newProduct.name.trim(), category: '', stock: 0, price: 0, unit: newProduct.unit };
    setProducts((current) => [...current, product]);
    chooseProduct(newProductRow, product);
    setNewProduct({ name: '', unit: '' });
    setNewProductOpen(false);
    setNewProductRow(null);
  };

  const openLots = (item) => {
    if (!item.productId) {
      setFormError('Vui lòng chọn sản phẩm trước khi chọn lô nhập hàng.');
      return;
    }
    setLotDialogRowId(item.id);
    setSelectedLotIds(item.lots.map((lot) => lot.id));
    setLotSearch('');
  };

  const activeLine = form.items.find((item) => item.id === lotDialogRowId);
  const availableLots = activeLine ? (lotsByProduct[activeLine.productId] ?? []) : [];
  const visibleLots = availableLots.filter((lot) => lot.id.toLowerCase().includes(lotSearch.toLowerCase()));

  const addLot = (event) => {
    event.preventDefault();
    if (!activeLine || !lotDraft.manufactureDate || !lotDraft.expiryDate) {
      setLotError('Vui lòng nhập đầy đủ ngày sản xuất và hạn sử dụng.');
      return;
    }
    if (lotDraft.expiryDate <= lotDraft.manufactureDate) {
      setLotError('Hạn sử dụng phải sau ngày sản xuất.');
      return;
    }
    const currentLots = lotsByProduct[activeLine.productId] ?? [];
    const newLot = {
      id: toLotCode(lotDraft.manufactureDate, currentLots.length + 1),
      status: 'Còn hạn',
      manufactureDate: lotDraft.manufactureDate,
      expiryDate: lotDraft.expiryDate,
      stock: 0,
    };
    setLotsByProduct((current) => ({ ...current, [activeLine.productId]: [...(current[activeLine.productId] ?? []), newLot] }));
    setSelectedLotIds((current) => [...new Set([...current, newLot.id])]);
    setLotDraft({ manufactureDate: '', expiryDate: '' });
    setLotError('');
    setNewLotOpen(false);
  };

  const confirmLots = () => {
    updateLine(lotDialogRowId, { lots: availableLots.filter((lot) => selectedLotIds.includes(lot.id)) });
    setLotDialogRowId(null);
  };

  const saveReceipt = (event) => {
    event.preventDefault();
    const validItems = form.items.filter((item) => item.productId && Number(item.price) >= 0 && Number(item.quantity) > 0 && item.lots.length > 0);
    if (validItems.length !== form.items.length) {
      setFormError('Vui lòng chọn sản phẩm, nhập số lượng lớn hơn 0 và chọn lô nhập hàng cho từng dòng.');
      return;
    }
    const nextNumber = String(records.length + 1).padStart(3, '0');
    const receiptDate = new Date(`${form.date}T00:00:00`);
    const items = validItems.map((item) => {
      const product = products.find((candidate) => candidate.id === item.productId);
      return {
        product: product?.name ?? item.productQuery,
        unit: item.unit,
        price: Number(item.price),
        quantity: Number(item.quantity),
        lots: item.lots.map((lot) => lot.id),
        lot: item.lots.map((lot) => lot.id).join(', '),
      };
    });
    const receipt = {
      id: `PNK-${form.date.replaceAll('-', '')}-${nextNumber}`,
      date: receiptDate.toLocaleDateString('vi-VN'),
      total: items.reduce((sum, item) => sum + item.price * item.quantity, 0),
      creator: form.supplier,
      paymentStatus: form.paymentStatus,
      items,
    };
    setRecords((current) => [receipt, ...current]);
    setFormError('');
    navigate(`/phieu-nhap-kho/${receipt.id}`);
  };

  const columns = [
    { key: 'index', label: 'STT', width: '10%', render: (_, index) => index + 1 },
    { key: 'id', label: 'Mã phiếu nhập', width: '34%', render: (record) => <button type="button" className="table-link" onClick={() => navigate(`/phieu-nhap-kho/${record.id}`)}>{record.id}</button> },
    { key: 'date', label: 'Ngày nhập', width: '25%' },
    { key: 'total', label: 'Tổng tiền', width: '31%', render: (record) => formatCurrency(record.total) },
  ];

  if (isCreate) {
    return (
      <div className="page-stack">
        <PageHeader title="TẠO PHIẾU NHẬP KHO" />
        <section className="panel inventory-form-panel">
          <form onSubmit={saveReceipt}>
            <div className="form-grid inventory-meta-grid">
              <TextField label="Mã phiếu nhập" value={form.code} readOnly />
              <TextField label="Người nhập *" value={form.supplier} onChange={(event) => setForm({ ...form, supplier: event.target.value })} required />
              <TextField label="Ngày nhập *" type="date" value={form.date} onChange={(event) => setForm({ ...form, date: event.target.value, code: `PNK-${event.target.value.replaceAll('-', '')}-${String(records.length + 1).padStart(3, '0')}` })} required />
              <SelectField label="Trạng thái thanh toán *" value={form.paymentStatus} onChange={(event) => setForm({ ...form, paymentStatus: event.target.value })} options={['Chưa thanh toán', 'Đã thanh toán']} required />
            </div>
            <h2 className="inventory-section-title">Danh sách sản phẩm</h2>
            <div className="line-items-scroll inbound-lines-scroll">
              <table className="line-items-table inbound-lines-table">
                <thead><tr><th>Tên sản phẩm</th><th>Đơn vị tính</th><th>Giá nhập</th><th>Số lượng nhập</th><th>Thành tiền</th><th>Lô nhập hàng</th><th>Xóa</th></tr></thead>
                <tbody>
                  {form.items.map((item) => {
                    const matchedProduct = products.find((product) => product.id === item.productId);
                    const productOptions = products.filter((product) => `${product.id} ${product.name}`.toLowerCase().includes(item.productQuery.toLowerCase()));
                    return (
                      <tr key={item.id}>
                        <td>
                          <div className="product-picker">
                            <div className="product-picker__input-wrap">
                              <Search aria-hidden="true" size={17} />
                              <input
                                aria-label="Tên sản phẩm"
                                value={item.productQuery}
                                placeholder="Nhập theo tên sản phẩm"
                                onFocus={() => setOpenProductId(item.id)}
                                onChange={(event) => {
                                  updateLine(item.id, { productQuery: event.target.value, productId: '', unit: '', lots: [] });
                                  setOpenProductId(item.id);
                                }}
                              />
                            </div>
                            {openProductId === item.id && (
                              <div className="product-picker__menu">
                                <button type="button" className="product-picker__add" onClick={() => { setNewProductRow(item.id); setNewProductOpen(true); setOpenProductId(null); }}>
                                  <Plus size={16} />Thêm mới sản phẩm
                                </button>
                                {productOptions.slice(0, 6).map((product) => (
                                  <button type="button" className="product-picker__option" key={product.id} onClick={() => chooseProduct(item.id, product)}>
                                    {product.image && <img src={product.image} alt="" />}
                                    <span><strong>{product.name}</strong><small>Mã: {product.id}</small></span>
                                  </button>
                                ))}
                                {!productOptions.length && <p className="product-picker__empty">Không tìm thấy sản phẩm phù hợp.</p>}
                              </div>
                            )}
                          </div>
                        </td>
                        <td><span className="form-readonly">{item.unit || matchedProduct?.unit || ''}</span></td>
                        <td><input className="field__control inbound-line-number" aria-label="Giá nhập" type="number" min="0" value={item.price} onChange={(event) => updateLine(item.id, { price: event.target.value })} /></td>
                        <td><input className="field__control inbound-line-number" aria-label="Số lượng nhập" type="number" min="0" value={item.quantity} onChange={(event) => updateLine(item.id, { quantity: event.target.value })} /></td>
                        <td><span className="form-readonly inbound-line-total">{formatCurrency((Number(item.price) || 0) * (Number(item.quantity) || 0))}</span></td>
                        <td><button className="table-link inbound-lot-trigger" type="button" onClick={() => openLots(item)}>{item.lots.length ? item.lots.map((lot) => lot.id).join(', ') : 'Chọn lô nhập hàng'}</button></td>
                        <td><button className="icon-button line-item-remove" type="button" aria-label="Xóa sản phẩm" disabled={form.items.length === 1} onClick={() => setForm((current) => ({ ...current, items: current.items.filter((line) => line.id !== item.id) }))}><Trash2 size={16} /></button></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="inbound-add-line"><Button type="button" variant="secondary" onClick={() => setForm((current) => ({ ...current, items: [...current.items, blankLine()] }))}><Plus size={17} />Thêm sản phẩm</Button></div>
            <div className="inventory-total"><strong>Tổng tiền nhập</strong><b>{formatCurrency(total)}</b></div>
            {formError && <p className="field__error inbound-form-error" role="alert">{formError}</p>}
            <div className="form-actions"><Button type="button" variant="secondary" onClick={() => navigate('/phieu-nhap-kho')}>Hủy</Button><Button type="submit">Lưu</Button></div>
          </form>
        </section>

        <Modal open={Boolean(lotDialogRowId)} title="Chọn lô nhập hàng" onClose={() => setLotDialogRowId(null)} size="large">
          <div className="lot-picker-content">
            <SearchBox value={lotSearch} onChange={setLotSearch} placeholder="Tìm theo mã lô..." />
            <div className="lot-picker-scroll">
              <table className="lot-picker-table">
                <thead><tr><th></th><th>Mã lô</th><th>Trạng thái</th><th>Ngày sản xuất</th><th>Hạn sử dụng</th><th>Số lượng tồn lô</th></tr></thead>
                <tbody>
                  {visibleLots.length ? visibleLots.map((lot) => (
                    <tr key={lot.id}>
                      <td><input type="checkbox" aria-label={`Chọn lô ${lot.id}`} checked={selectedLotIds.includes(lot.id)} onChange={(event) => setSelectedLotIds((current) => event.target.checked ? [...current, lot.id] : current.filter((id) => id !== lot.id))} /></td>
                      <td><strong>{lot.id}</strong></td>
                      <td><StatusBadge tone="success">{lot.status}</StatusBadge></td>
                      <td>{formatDate(lot.manufactureDate)}</td>
                      <td>{formatDate(lot.expiryDate)}</td>
                      <td>{lot.stock}</td>
                    </tr>
                  )) : (
                    <tr><td className="lot-picker-empty" colSpan="6">Không có lô hàng phù hợp.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            <Button type="button" onClick={() => { setLotDraft({ manufactureDate: '', expiryDate: '' }); setLotError(''); setNewLotOpen(true); }}><PackagePlus size={17} />Thêm lô sản phẩm</Button>
          </div>
          <div className="modal-form-actions lot-picker-actions">
            <Button type="button" variant="secondary" onClick={() => setLotDialogRowId(null)}>Hủy</Button>
            <Button type="button" onClick={confirmLots}>Xác nhận</Button>
          </div>
        </Modal>

        <Modal open={newLotOpen} title="Thêm lô sản phẩm" onClose={() => setNewLotOpen(false)} size="large" layer={2}>
          <form className="lot-create-form" onSubmit={addLot}>
            <TextField label="Mã lô" value={toLotCode(lotDraft.manufactureDate, availableLots.length + 1)} readOnly />
            <TextField label="Ngày sản xuất *" type="date" value={lotDraft.manufactureDate} onChange={(event) => setLotDraft((current) => ({ ...current, manufactureDate: event.target.value }))} required />
            <TextField label="Hạn sử dụng *" type="date" value={lotDraft.expiryDate} onChange={(event) => setLotDraft((current) => ({ ...current, expiryDate: event.target.value }))} required />
            {lotError && <p className="field__error lot-create-error" role="alert">{lotError}</p>}
            <div className="modal-form-actions lot-create-actions"><Button type="button" variant="secondary" onClick={() => setNewLotOpen(false)}>Hủy</Button><Button type="submit">Thêm lô</Button></div>
          </form>
        </Modal>

        <Modal open={newProductOpen} title="Thêm mới sản phẩm" onClose={() => { setNewProductOpen(false); setNewProductRow(null); }}>
          <form className="new-inbound-product-form" onSubmit={addProduct}>
            <TextField label="Tên sản phẩm *" value={newProduct.name} placeholder="Nhập tên sản phẩm..." onChange={(event) => setNewProduct((current) => ({ ...current, name: event.target.value }))} required />
            <SelectField label="Đơn vị tính *" value={newProduct.unit} onChange={(event) => setNewProduct((current) => ({ ...current, unit: event.target.value }))} options={[{ value: '', label: 'Chọn đơn vị tính' }, ...units]} required />
            <div className="modal-form-actions"><Button type="button" variant="secondary" onClick={() => setNewProductOpen(false)}>Hủy</Button><Button type="submit">Thêm sản phẩm</Button></div>
          </form>
        </Modal>
      </div>
    );
  }

  if (receiptId) {
    if (!selectedReceipt) {
      return <FeatureNotFound heading="PHIẾU NHẬP KHO" message="Không tìm thấy phiếu nhập kho phù hợp!" onBack={() => navigate('/phieu-nhap-kho')} />;
    }
    const detailItems = selectedReceipt.items ?? [];
    const detailColumns = [
      { key: 'index', label: 'STT', width: '7%', render: (_, index) => index + 1 },
      { key: 'product', label: 'Tên sản phẩm', width: '24%' },
      { key: 'unit', label: 'Đơn vị tính', width: '12%' },
      { key: 'price', label: 'Giá nhập', width: '14%', render: (item) => formatCurrency(item.price) },
      { key: 'quantity', label: 'Số lượng', width: '12%' },
      { key: 'lot', label: 'Lô nhập hàng', width: '16%' },
      { key: 'total', label: 'Thành tiền', width: '15%', render: (item) => formatCurrency(item.price * item.quantity) },
    ];
    return (
      <div className="page-stack inbound-detail-page">
        <PageHeader title="CHI TIẾT PHIẾU NHẬP KHO" />
        <section className="panel inbound-detail-panel">
          <dl className="inbound-detail-facts">
            <div><dt>Mã phiếu nhập:</dt><dd>{selectedReceipt.id}</dd></div>
            <div><dt>Người tạo đơn:</dt><dd>{selectedReceipt.creator || '—'}</dd></div>
            <div><dt>Ngày nhập:</dt><dd>{selectedReceipt.date}</dd></div>
            <div><dt>Trạng thái thanh toán:</dt><dd><StatusBadge tone={selectedReceipt.paymentStatus === 'Đã thanh toán' ? 'success' : 'danger'}>{selectedReceipt.paymentStatus || 'Chưa thanh toán'}</StatusBadge></dd></div>
          </dl>
          <h2 className="inbound-detail-title">Danh sách mỹ phẩm nhập</h2>
          <DataTable columns={detailColumns} rows={detailItems} rowKey="product" emptyMessage="Chưa có thông tin sản phẩm trong phiếu nhập này." />
          {detailItems.length > 0 && <div className="inbound-detail-total"><strong>Tổng tiền</strong><b>{formatCurrency(selectedReceipt.total)}</b></div>}
          <div className="inbound-detail-actions"><Button onClick={() => navigate('/phieu-nhap-kho')}>Đóng</Button></div>
        </section>
      </div>
    );
  }

  return (
    <div className="page-stack">
      <PageHeader title="DANH SÁCH PHIẾU NHẬP KHO" />
      <section className="panel inventory-list-panel">
        <PageListToolbar
          className="inventory-toolbar"
          search={<SearchBox value={query} onChange={(value) => { setQuery(value); setPage(1); }} placeholder="Nhập từ khóa cần tra cứu..." />}
          actions={<Button onClick={openCreate}><Plus size={18} />Tạo phiếu nhập kho</Button>}
        />
        <DataTable columns={columns} rows={pageRecords} rowKey="id" emptyMessage="Không tìm thấy phiếu nhập kho phù hợp!" />
        <div className="panel__footer"><Pagination page={page} pageCount={pageCount} onChange={setPage} /></div>
      </section>
    </div>
  );
}
