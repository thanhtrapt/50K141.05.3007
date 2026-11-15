import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Image as ImageIcon, PackagePlus, Plus, Search, Trash2 } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import Button from '../../components/ui/Button.jsx';
import ConfirmDialog from '../../components/ui/ConfirmDialog.jsx';
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
import { useFeedback } from '../../components/ui/FeedbackContext.jsx';
import { apiList, apiRequest } from '../../api.js';
import { formatCurrency } from '../../data/mockData.js';

let nextLineId = 1;
const units = ['Chai', 'Lọ', 'Tuýp', 'Hộp', 'Gói'];
const normalizeProductSearch = (value) => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('vi');

function blankLine() {
  return { id: `inbound-line-${nextLineId++}`, productId: '', productQuery: '', unit: '', price: '', quantity: '', lots: [] };
}

function formatDate(value) {
  if (!value) return '';
  const [year, month, day] = value.split('-');
  return `${day}/${month}/${year}`;
}

function toLotCode(date, suffix) {
  if (!date) return '';
  const [year, month, day] = date.split('-');
  return `${day}${month}${year.slice(-2)}-${String(suffix).padStart(3, '0')}`;
}

function initialForm(records) {
  return {
    date: '',
    supplier: '',
    paymentStatus: '',
    items: [blankLine()],
    code: 'Tự động tạo',
  };
}

export default function InboundPage() {
  const [records, setRecords] = useState([]);
  const [receiptDetail, setReceiptDetail] = useState(null);
  const [products, setProducts] = useState([]);
  const [lotsByProduct, setLotsByProduct] = useState({});
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [form, setForm] = useState(() => initialForm([]));
  const [formError, setFormError] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [openProductId, setOpenProductId] = useState(null);
  const [productMenuPosition, setProductMenuPosition] = useState(null);
  const [activeProductOption, setActiveProductOption] = useState(0);
  const productInputRefs = useRef(new Map());
  const productMenuRef = useRef(null);
  const [newProductOpen, setNewProductOpen] = useState(false);
  const [newProductRow, setNewProductRow] = useState(null);
  const [newProduct, setNewProduct] = useState({ name: '', unit: '' });
  const [lotDialogRowId, setLotDialogRowId] = useState(null);
  const [lotSearch, setLotSearch] = useState('');
  const [selectedLotIds, setSelectedLotIds] = useState([]);
  const [newLotOpen, setNewLotOpen] = useState(false);
  const [lotDraft, setLotDraft] = useState({ manufactureDate: '', expiryDate: '' });
  const [lotError, setLotError] = useState('');
  const [cancelOpen, setCancelOpen] = useState(false);
  const { showDialog } = useFeedback();
  const location = useLocation();
  const navigate = useNavigate();

  const routePart = location.pathname.replace(/^\/phieu-nhap-kho\/?/, '').split('/').filter(Boolean)[0];
  const isCreate = routePart === 'tao-moi';
  const receiptId = routePart && !isCreate ? routePart : null;
  const selectedReceipt = receiptDetail?.id === receiptId ? receiptDetail : records.find((record) => record.id === receiptId);
  useEffect(() => {
    let active = true;
    Promise.all([apiList('/api/stock-receipts'), apiList('/api/cosmetics'), apiList('/api/lots')])
      .then(([receipts, cosmetics, lots]) => {
        if (!active) return;
        setRecords(receipts.map((record) => ({ ...record, date: formatDate(String(record.receiptDate).slice(0, 10)) })));
        setProducts(cosmetics.map((product) => ({
          id: String(product.id ?? product.maMyPham ?? '').trim(),
          name: product.name ?? product.tenMyPham ?? '',
          image: product.image ?? product.hinhAnh ?? '',
          unit: product.unit ?? product.donViTinh ?? '',
          category: product.category ?? product.phanLoai ?? '',
          stock: Number(product.stock ?? product.soLuongTonKho ?? 0),
          price: Number(product.salePrice ?? product.giaBan ?? 0),
        })).filter((product) => product.id && product.name));
        const groupedLots = {};
        lots.forEach((lot) => {
          const productLots = groupedLots[lot.cosmeticId] ?? [];
          productLots.push({ id: lot.id, status: 'Còn hạn', manufactureDate: String(lot.productionDate).slice(0, 10), expiryDate: String(lot.expiryDate).slice(0, 10), stock: Number(lot.stock) });
          groupedLots[lot.cosmeticId] = productLots;
        });
        setLotsByProduct(groupedLots);
      })
      .catch((error) => showDialog({ title: 'Không tải được dữ liệu phiếu nhập', message: error.message }))
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [showDialog]);

  useEffect(() => {
    let active = true;
    setReceiptDetail(null);
    if (!receiptId) return () => { active = false; };
    apiRequest(`/api/stock-receipts/${encodeURIComponent(receiptId)}`)
      .then((detail) => {
        if (!active) return;
        setReceiptDetail({
          ...detail,
          date: formatDate(String(detail.receiptDate).slice(0, 10)),
          items: (detail.items ?? []).map((item) => ({ product: item.cosmeticName, unit: item.unit, price: Number(item.purchasePrice), quantity: Number(item.quantity), lot: item.lotCode, productionDate: item.productionDate, expiryDate: item.expiryDate })),
        });
      })
      .catch((error) => { if (active) showDialog({ title: 'Không tải được chi tiết phiếu nhập', message: error.message }); });
    return () => { active = false; };
  }, [receiptId, showDialog]);
  const visibleRecords = useMemo(() => records.filter((item) => item.id.toLowerCase().includes(query.toLowerCase())), [records, query]);
  const pageCount = Math.max(1, Math.ceil(visibleRecords.length / 5));
  const pageRecords = visibleRecords.slice((page - 1) * 5, page * 5);
  const hasComputedTotal = form.items.some((item) => item.price !== '' && item.quantity !== '');
  const total = form.items.reduce((sum, item) => sum + (item.price !== '' && item.quantity !== '' ? Number(item.price) * Number(item.quantity) : 0), 0);

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
      price: '',
      quantity: '',
      lots: [],
    });
    setOpenProductId(null);
    setProductMenuPosition(null);
  };

  const positionProductMenu = (lineId) => {
    const input = productInputRefs.current.get(lineId);
    if (!input) return;
    const rect = input.getBoundingClientRect();
    const width = 280;
    const left = Math.max(8, Math.min(rect.left, window.innerWidth - width - 8));
    setProductMenuPosition({ left, width: Math.min(width, window.innerWidth - 16), top: rect.bottom + 4, maxHeight: 230 });
  };

  useEffect(() => {
    if (!openProductId) return undefined;
    const input = productInputRefs.current.get(openProductId);
    if (input) {
      const availableBelow = window.innerHeight - input.getBoundingClientRect().bottom - 4;
      if (availableBelow < 230) {
        const scrollContainer = input.closest('.main-content');
        if (scrollContainer) scrollContainer.scrollTop += 230 - availableBelow + 8;
        else window.scrollBy(0, 230 - availableBelow + 8);
      }
    }
    requestAnimationFrame(() => {
      positionProductMenu(openProductId);
      if (productMenuRef.current) productMenuRef.current.scrollTop = 0;
      const options = productMenuRef.current?.querySelector('.product-picker__options');
      if (options) options.scrollTop = 0;
    });
    const reposition = () => positionProductMenu(openProductId);
    const onPointerDown = (event) => {
      const input = productInputRefs.current.get(openProductId);
      if (!input?.contains(event.target) && !productMenuRef.current?.contains(event.target)) {
        setOpenProductId(null);
        setProductMenuPosition(null);
      }
    };
    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        setOpenProductId(null);
        setProductMenuPosition(null);
      }
    };
    window.addEventListener('resize', reposition);
    window.addEventListener('scroll', reposition, true);
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('resize', reposition);
      window.removeEventListener('scroll', reposition, true);
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [openProductId]);

  const addProduct = (event) => {
    event.preventDefault();
    if (!newProductRow || !newProduct.name.trim() || !newProduct.unit) return;
    const id = `MP${String(products.length + 1).padStart(8, '0')}`;
    const product = { id, name: newProduct.name.trim(), category: '', stock: 0, price: 0, unit: newProduct.unit, temporary: true };
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
      isNew: true,
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

  const saveReceipt = async (event) => {
    event.preventDefault();
    setSubmitted(true);
    if (!form.supplier.trim() || !form.date || !form.paymentStatus) {
      setFormError('Vui lòng nhập đầy đủ thông tin phiếu nhập.');
      return;
    }
    const validItems = form.items.filter((item) => item.productId && Number(item.price) >= 0 && Number(item.quantity) > 0 && item.lots.length > 0);
    if (form.items.some((item) => item.price !== '' && Number(item.price) < 0 || item.quantity !== '' && Number(item.quantity) <= 0)) {
      setFormError('');
      return;
    }
    if (validItems.length !== form.items.length) {
      setFormError('Vui lòng chọn sản phẩm, nhập số lượng lớn hơn 0 và chọn lô nhập hàng cho từng dòng.');
      return;
    }
    if (validItems.some((item) => item.lots.length !== 1)) {
      setFormError('Mỗi dòng cần có đúng một lô để hệ thống ghi nhận chính xác số lượng theo từng lô. Hãy tách các lô thành nhiều dòng sản phẩm.');
      return;
    }
    if (validItems.some((item) => products.find((product) => product.id === item.productId)?.temporary)) {
      setFormError('Sản phẩm mới cần được tạo và lưu ở trang Mỹ phẩm trước khi lập phiếu nhập.');
      return;
    }
    setFormError('');
    try {
      const saved = await apiRequest('/api/stock-receipts', {
        method: 'POST',
        body: {
          receiptDate: form.date,
          paymentStatus: form.paymentStatus,
          items: validItems.map((item) => {
            const lot = item.lots[0];
            return {
              cosmeticId: item.productId,
              purchasePrice: Number(item.price),
              quantity: Number(item.quantity),
              ...(lot.isNew ? { lot: { productionDate: lot.manufactureDate, expiryDate: lot.expiryDate } } : { batchId: lot.id }),
            };
          }),
        },
      });
      const rows = await apiList('/api/stock-receipts');
      setRecords(rows.map((record) => ({ ...record, date: formatDate(String(record.receiptDate).slice(0, 10)) })));
      showDialog({ tone: 'success', title: 'Tạo phiếu nhập thành công', message: 'Phiếu nhập, lô hàng và số lượng tồn đã được lưu vào SQL.', size: 'medium' });
      navigate(`/phieu-nhap-kho/${saved.id}`);
    } catch (error) {
      setFormError(error.message || 'Không thể lưu phiếu nhập kho vào SQL.');
    }
  };

  const columns = [
    { key: 'index', label: 'STT', width: '8%', minWidth: 70, align: 'center', render: (_, index) => index + 1 },
    { key: 'id', label: 'Mã phiếu nhập', width: '30.67%', align: 'center', render: (record) => <button type="button" className="table-link" onClick={() => navigate(`/phieu-nhap-kho/${record.id}`)}>{record.id}</button> },
    { key: 'date', label: 'Ngày nhập', width: '30.67%', align: 'center' },
    { key: 'total', label: 'Tổng tiền', width: '30.66%', align: 'right', nowrap: true, render: (record) => formatCurrency(record.total) },
  ];

  if (loading) return <div className="panel data-loading" role="status">Đang tải phiếu nhập kho từ SQL…</div>;

  if (isCreate) {
    return (
      <div className="page-stack">
        <PageHeader
          title="TẠO PHIẾU NHẬP KHO"
          fallbackPath="/phieu-nhap-kho"
          onBack={() => setCancelOpen(true)}
        />
        <section className="panel inventory-form-panel">
          <form onSubmit={saveReceipt} noValidate>
            <div className="form-grid inventory-meta-grid">
              <TextField label="Mã phiếu nhập" value={form.code} readOnly />
              <TextField label="Người nhập *" value={form.supplier} onChange={(event) => setForm({ ...form, supplier: event.target.value })} required />
              <TextField label="Ngày nhập *" type="date" value={form.date} onChange={(event) => setForm({ ...form, date: event.target.value, code: 'Tự động tạo' })} required />
              <SelectField label="Trạng thái thanh toán *" value={form.paymentStatus} onChange={(event) => setForm({ ...form, paymentStatus: event.target.value })} options={['Chưa thanh toán', 'Đã thanh toán']} required />
            </div>
            <h2 className="inventory-section-title">Danh sách sản phẩm</h2>
            <div className="line-items-scroll inbound-lines-scroll">
              <table className="line-items-table inbound-lines-table">
                <colgroup><col style={{ width: '22%' }} /><col style={{ width: '10%' }} /><col style={{ width: '15%' }} /><col style={{ width: '15%' }} /><col style={{ width: '14%' }} /><col style={{ width: '20%' }} /><col style={{ width: '4%' }} /></colgroup>
                <thead><tr><th>Tên sản phẩm</th><th>Đơn vị tính</th><th>Giá nhập</th><th>Số lượng nhập</th><th>Thành tiền</th><th>Lô nhập hàng</th><th aria-label="Thao tác"></th></tr></thead>
                <tbody>
                  {form.items.map((item) => {
                    const matchedProduct = products.find((product) => product.id === item.productId);
                    const normalizedQuery = normalizeProductSearch(item.productQuery);
                    const productOptions = products.filter((product) => normalizeProductSearch(`${product.id} ${product.name}`).includes(normalizedQuery)).slice(0, 6);
                    return (
                      <tr key={item.id}>
                        <td>
                          <div className="product-picker">
                            <div className="product-picker__input-wrap">
                              <Search aria-hidden="true" size={17} />
                              <input
                                aria-label="Tên sản phẩm"
                                ref={(node) => { if (node) productInputRefs.current.set(item.id, node); else productInputRefs.current.delete(item.id); }}
                                value={item.productQuery}
                                placeholder="Nhập tên sản phẩm"
                                onFocus={() => { setOpenProductId(item.id); setActiveProductOption(0); }}
                                onClick={() => { setOpenProductId(item.id); setActiveProductOption(0); }}
                                onChange={(event) => {
                                  updateLine(item.id, { productQuery: event.target.value, productId: '', unit: '', lots: [] });
                                  setOpenProductId(item.id);
                                  setActiveProductOption(0);
                                }}
                                onKeyDown={(event) => {
                                  if (event.key === 'ArrowDown' && productOptions.length) { event.preventDefault(); setActiveProductOption((index) => (index + 1) % productOptions.length); }
                                  else if (event.key === 'ArrowUp' && productOptions.length) { event.preventDefault(); setActiveProductOption((index) => (index - 1 + productOptions.length) % productOptions.length); }
                                  else if (event.key === 'Enter' && openProductId === item.id && productOptions.length) { event.preventDefault(); chooseProduct(item.id, productOptions[activeProductOption] ?? productOptions[0]); }
                                }}
                              />
                            </div>
                          </div>
                        </td>
                        <td><span className="form-readonly">{item.productId ? (item.unit || matchedProduct?.unit || 'Chai') : ''}</span></td>
                        <td><div className="inventory-line-field"><input className={`field__control inbound-line-number${submitted && item.price !== '' && Number(item.price) < 0 ? ' field__control--error' : ''}`} aria-label="Giá nhập" placeholder="Nhập giá" type="number" min="0" value={item.price} onChange={(event) => updateLine(item.id, { price: event.target.value })} />{submitted && item.price !== '' && Number(item.price) < 0 && <p className="field__error">Giá nhập phải ≥ 0.</p>}</div></td>
                        <td><div className="inventory-line-field"><input className={`field__control inbound-line-number${submitted && item.quantity !== '' && Number(item.quantity) <= 0 ? ' field__control--error' : ''}`} aria-label="Số lượng nhập" placeholder="Nhập SL" type="number" min="1" value={item.quantity} onChange={(event) => updateLine(item.id, { quantity: event.target.value })} />{submitted && item.quantity !== '' && Number(item.quantity) <= 0 && <p className="field__error">Số lượng nhập phải &gt; 0.</p>}</div></td>
                        <td><span className="form-readonly inbound-line-total">{item.price !== '' && item.quantity !== '' ? formatCurrency(Number(item.price) * Number(item.quantity)) : '—'}</span></td>
                        <td><button className="table-link inbound-lot-trigger" type="button" onClick={() => openLots(item)}>{item.lots.length ? item.lots.map((lot) => lot.id).join(', ') : 'Chọn lô nhập hàng'}</button></td>
                        <td><button className="icon-button line-item-remove" type="button" aria-label="Xóa sản phẩm" disabled={form.items.length === 1} onClick={() => setForm((current) => ({ ...current, items: current.items.filter((line) => line.id !== item.id) }))}><Trash2 size={16} /></button></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {openProductId && productMenuPosition && (() => {
              const activeItem = form.items.find((line) => line.id === openProductId);
              const searchValue = normalizeProductSearch(activeItem?.productQuery);
              const options = products.filter((product) => normalizeProductSearch(`${product.id} ${product.name}`).includes(searchValue)).slice(0, 6);
              return createPortal(
                <div ref={productMenuRef} className="product-picker__menu" role="listbox" style={{ left: productMenuPosition.left, top: productMenuPosition.top, width: productMenuPosition.width, maxHeight: productMenuPosition.maxHeight }}>
                  <button type="button" className="product-picker__add" onClick={() => { setNewProductRow(openProductId); setNewProductOpen(true); setOpenProductId(null); setProductMenuPosition(null); }}><Plus size={16} />Thêm mới sản phẩm</button>
                  <div className="product-picker__options">
                    {options.map((product, index) => (
                      <button type="button" role="option" aria-selected={activeProductOption === index} className={`product-picker__option${activeProductOption === index ? ' is-active' : ''}`} key={product.id} onMouseEnter={() => setActiveProductOption(index)} onClick={() => chooseProduct(openProductId, product)}>
                        {product.image ? <img src={product.image} alt="" /> : <span className="product-picker__image-placeholder"><ImageIcon size={18} /></span>}
                        <span><strong>{product.name}</strong><small>Mã: {product.id}</small></span>
                      </button>
                    ))}
                    {!options.length && <p className="product-picker__empty">Không tìm thấy sản phẩm</p>}
                  </div>
                </div>, document.body,
              );
            })()}
            <div className="inbound-add-line"><Button type="button" variant="secondary" onClick={() => setForm((current) => ({ ...current, items: [...current.items, blankLine()] }))}><Plus size={17} />Thêm sản phẩm</Button></div>
            <div className="inventory-total"><strong>Tổng tiền nhập</strong><b>{hasComputedTotal ? formatCurrency(total) : '—'}</b></div>
            {formError && <p className="field__error inbound-form-error" role="alert">{formError}</p>}
            <div className="form-actions"><Button type="button" variant="secondary" onClick={() => setCancelOpen(true)}>Hủy</Button><Button type="submit">Lưu</Button></div>
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
      <ConfirmDialog open={cancelOpen} title="Xác nhận hủy" message="Các thay đổi sẽ không được lưu. Bạn có chắc chắn muốn hủy?" onCancel={() => setCancelOpen(false)} onConfirm={() => { setCancelOpen(false); navigate('/phieu-nhap-kho'); }} />

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
      { key: 'index', label: 'STT', width: '6%', align: 'center', render: (_, index) => index + 1 },
      { key: 'product', label: 'Tên sản phẩm', width: '20%' },
      { key: 'unit', label: 'Đơn vị tính', width: '10%', align: 'center' },
      { key: 'price', label: 'Giá nhập', width: '14%', align: 'right', nowrap: true, render: (item) => formatCurrency(item.price) },
      { key: 'quantity', label: 'Số lượng', width: '15%', minWidth: 110, align: 'center', nowrap: true },
      { key: 'lot', label: 'Lô nhập hàng', width: '19%', minWidth: 150, align: 'center', nowrap: true },
      { key: 'total', label: 'Thành tiền', width: '16%', align: 'right', nowrap: true, render: (item) => formatCurrency(item.price * item.quantity) },
    ];
    return (
      <div className="page-stack inbound-detail-page">
        <PageHeader
          title="CHI TIẾT PHIẾU NHẬP KHO"
          fallbackPath="/phieu-nhap-kho"
          onBack={() => navigate('/phieu-nhap-kho')}
        />
        <section className="panel inbound-detail-panel">
          <dl className="inbound-detail-facts">
            <div><dt>Mã phiếu nhập:</dt><dd>{selectedReceipt.id}</dd></div>
            <div><dt>Người tạo đơn:</dt><dd>{selectedReceipt.creator || '—'}</dd></div>
            <div><dt>Ngày nhập:</dt><dd>{selectedReceipt.date}</dd></div>
            <div><dt>Trạng thái thanh toán:</dt><dd><StatusBadge tone={selectedReceipt.paymentStatus === 'Đã thanh toán' ? 'success' : 'danger'}>{selectedReceipt.paymentStatus || 'Chưa thanh toán'}</StatusBadge></dd></div>
          </dl>
          <h2 className="inbound-detail-title">Danh sách mỹ phẩm nhập</h2>
          <DataTable className="inbound-detail-items-table" columns={detailColumns} rows={detailItems} rowKey="product" emptyMessage="Chưa có thông tin sản phẩm trong phiếu nhập này." />
          {detailItems.length > 0 && <div className="inbound-detail-total"><strong>Tổng tiền</strong><b>{formatCurrency(selectedReceipt.total)}</b></div>}
          <div className="inbound-detail-actions"><Button onClick={() => navigate('/phieu-nhap-kho')}>Đóng</Button></div>
        </section>
      </div>
    );
  }

  return (
    <div className="page-stack">
      <PageHeader title="DANH SÁCH PHIẾU NHẬP KHO" />
      <div className="inventory-list-panel">
        <PageListToolbar
          className="inventory-toolbar"
          search={<SearchBox value={query} onChange={(value) => { setQuery(value); setPage(1); }} placeholder="Nhập từ khóa cần tra cứu..." />}
          actions={<Button onClick={openCreate}><Plus size={18} />Tạo phiếu nhập kho</Button>}
        />
        <DataTable className="data-table--inventory" columns={columns} rows={pageRecords} rowKey="id" emptyMessage="Không tìm thấy phiếu nhập kho phù hợp!" />
        <div className="panel__footer"><Pagination page={page} pageCount={pageCount} onChange={setPage} /></div>
      </div>
    </div>
  );
}
