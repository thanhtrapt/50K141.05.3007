import { useEffect, useMemo, useState } from 'react';
import { Search, Trash2 } from 'lucide-react';
import Button from '../../components/ui/Button.jsx';
import PageHeader from '../../components/ui/PageHeader.jsx';
import { useFeedback } from '../../components/ui/FeedbackContext.jsx';
import { apiList, apiRequest } from '../../api.js';
import { formatCurrency } from '../../data/mockData.js';

const today = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};

const fold = (value) => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('vi');

function draftRows(purchases = []) {
  const byProduct = new Map();
  for (const item of purchases) {
    const id = item.productId;
    if (!id) continue;
    byProduct.set(id, (byProduct.get(id) ?? 0) + Number(item.quantityValue || 0));
  }
  return [...byProduct].map(([productId, quantity]) => ({ productId, quantity: String(quantity || 1) }));
}

export default function CustomerRetailSalePage({
  customer,
  initialItems = [],
  draftMode = false,
  onCancel,
  onSaveDraft,
  onSaved,
}) {
  const [products, setProducts] = useState([]);
  const [items, setItems] = useState(() => draftRows(initialItems));
  const [purchaseDate, setPurchaseDate] = useState(() => initialItems[0]?.saleDate || today());
  const [query, setQuery] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [saving, setSaving] = useState(false);
  const { showDialog, notify } = useFeedback();

  useEffect(() => {
    let active = true;
    apiList('/api/retail-products')
      .then((rows) => { if (active) setProducts(rows.filter((item) => Number(item.stock) > 0)); })
      .catch((error) => {
        console.error('[customers] Không tải được mỹ phẩm bán lẻ:', error);
        if (active) notify('Không tải được danh sách mỹ phẩm. Vui lòng thử lại.', 'error');
      })
      .finally(() => { if (active) setLoadingProducts(false); });
    return () => { active = false; };
  }, [notify]);

  const lines = useMemo(() => items.map((line) => {
    const product = products.find((item) => item.id === line.productId);
    const quantity = line.quantity === '' ? 0 : Number(line.quantity);
    return { ...line, product, quantity, subtotal: product && quantity > 0 ? product.price * quantity : 0 };
  }), [items, products]);
  const total = lines.reduce((sum, line) => sum + line.subtotal, 0);
  const suggestions = products.filter((product) => fold(`${product.id} ${product.name}`).includes(fold(query)));

  const addProduct = (product) => {
    const existing = items.find((item) => item.productId === product.id);
    if (existing) {
      const nextQuantity = Number(existing.quantity || 0) + 1;
      if (nextQuantity > Number(product.stock)) {
        notify(`Số lượng ${product.name} không được vượt quá tồn kho (${product.stock}).`, 'error');
        return;
      }
      setItems((current) => current.map((item) => item.productId === product.id ? { ...item, quantity: String(nextQuantity) } : item));
    } else {
      setItems((current) => [...current, { productId: product.id, quantity: '1' }]);
    }
    setQuery('');
    setShowSuggestions(false);
  };

  const changeQuantity = (productId, value) => setItems((current) => current.map((item) => item.productId === productId ? { ...item, quantity: value } : item));
  const removeProduct = (productId) => setItems((current) => current.filter((item) => item.productId !== productId));

  const selectedItems = lines.filter((line) => line.product);
  const invalidLine = selectedItems.find((line) => !Number.isInteger(line.quantity) || line.quantity < 1 || line.quantity > Number(line.product.stock));

  const stagedPurchases = () => lines.map((line) => {
    if (!line.product) return initialItems.find((item) => item.productId === line.productId);
    return {
      id: `${line.product.id}-${Date.now()}-${line.productId}`,
      productId: line.product.id,
      quantityValue: line.quantity,
      saleDate: purchaseDate,
      date: purchaseDate.split('-').reverse().join('/'),
      product: line.product.name,
      quantity: `${line.quantity} ${line.product.unit ?? ''}`.trim(),
      price: formatCurrency(line.product.price),
      total: formatCurrency(line.subtotal),
    };
  }).filter(Boolean);

  const handleCancel = () => {
    if (draftMode) onCancel?.({ customerDraft: customer, draftPurchases: stagedPurchases() });
    else onCancel?.();
  };

  const handleSave = async (event) => {
    event.preventDefault();
    if (!purchaseDate) { notify('Vui lòng chọn ngày mua.', 'error'); return; }
    if (!selectedItems.length) { notify('Vui lòng chọn ít nhất một sản phẩm.', 'error'); return; }
    if (selectedItems.length !== items.length) { notify('Một sản phẩm đã hết hàng hoặc không còn khả dụng. Vui lòng xóa dòng đó rồi chọn lại.', 'error'); return; }
    if (invalidLine) {
      notify(`Số lượng ${invalidLine.product.name} phải là số nguyên từ 1 đến ${invalidLine.product.stock}.`, 'error');
      return;
    }
    if (draftMode) {
      onSaveDraft?.(stagedPurchases(), customer);
      return;
    }

    setSaving(true);
    try {
      const result = await apiRequest(`/api/customers/${encodeURIComponent(customer.id)}/retail-sales`, {
        method: 'POST',
        body: { soldAt: purchaseDate, items: selectedItems.map((line) => ({ mamypham: line.product.id, soluong: line.quantity })) },
      });
      showDialog({ tone: 'success', title: 'Ghi nhận thành công', message: `Mã đơn: ${result.id}`, closeLabel: 'Đóng' });
      try {
        await onSaved?.(result);
      } catch (refreshError) {
        console.error('[customers] Đã ghi nhận giao dịch nhưng không thể tải lại hồ sơ:', refreshError);
        notify('Đã ghi nhận sản phẩm thành công nhưng chưa tải lại được hồ sơ khách hàng.', 'error');
      }
    } catch (error) {
      console.error('[customers] Không thể ghi nhận sản phẩm mua thêm:', error);
      notify(error.message || 'Không thể ghi nhận bán lẻ. Vui lòng thử lại.', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="page-stack customer-retail-sale-page">
      <PageHeader
        title="GHI NHẬN SẢN PHẨM MUA THÊM"
        subtitle="Chọn mỹ phẩm bán lẻ và nhập số lượng cần ghi nhận."
        onBack={handleCancel}
        backLabel="Quay lại"
      />

      <form className="customer-retail-sale-form" onSubmit={handleSave} noValidate>
        <section className="panel customer-retail-sale__general">
          <h2>Thông tin chung</h2>
          <div className="customer-retail-sale__general-grid">
            <label className="field">
              <span className="field__label">Ngày mua *</span>
              <input className="field__control" type="date" value={purchaseDate} onChange={(event) => setPurchaseDate(event.target.value)} required />
            </label>
            <div className="field">
              <span className="field__label">Khách hàng</span>
              <div className="customer-retail-sale__customer-value" aria-readonly="true">
                <strong>{customer.id}</strong><span>{customer.name || 'Chưa nhập họ tên'}</span>
              </div>
            </div>
          </div>
        </section>

        <section className="panel customer-retail-sale__products">
          <div className="customer-retail-sale__heading">
            <div><h2>Chi tiết sản phẩm</h2><p>Tồn kho được kiểm tra lại tại thời điểm lưu.</p></div>
            <span>{items.length} sản phẩm</span>
          </div>

          <div className="customer-retail-sale__search-area">
            <label className="search-box customer-retail-sale__search">
              <Search aria-hidden="true" size={19} />
              <input
                type="search"
                value={query}
                onFocus={() => setShowSuggestions(true)}
                onChange={(event) => { setQuery(event.target.value); setShowSuggestions(true); }}
                placeholder="Tìm hoặc chọn sản phẩm bán lẻ..."
                aria-label="Tìm sản phẩm bán lẻ"
              />
            </label>
            {showSuggestions && (
              <div className="customer-retail-sale__suggestions" role="listbox" aria-label="Sản phẩm bán lẻ">
                {loadingProducts ? <p>Đang tải sản phẩm…</p> : suggestions.length ? suggestions.map((product) => (
                  <button type="button" role="option" aria-selected="false" key={product.id} onClick={() => addProduct(product)}>
                    <span><strong>{product.name}</strong><small>Mã: {product.id} · {product.unit}</small></span>
                    <span><strong>{formatCurrency(product.price)}</strong><small>Còn {product.stock}</small></span>
                  </button>
                )) : <p>Không tìm thấy sản phẩm còn hàng.</p>}
              </div>
            )}
          </div>

          <div className="customer-retail-sale__table-scroll">
            <table className="customer-retail-sale__table">
              <thead><tr><th>STT</th><th>Mã sản phẩm</th><th>Sản phẩm</th><th>Đơn vị tính</th><th>Số lượng</th><th>Giá bán</th><th>Thành tiền</th><th>Thao tác</th></tr></thead>
              <tbody>
                {lines.length ? lines.map((line, index) => (
                  <tr key={line.productId}>
                    <td>{index + 1}</td>
                    <td className="customer-retail-sale__nowrap">{line.product?.id ?? line.productId}</td>
                    <td>{line.product?.name ?? 'Sản phẩm không còn khả dụng'}</td>
                    <td>{line.product?.unit ?? '—'}</td>
                    <td>
                      <input className="customer-retail-sale__quantity" aria-label={`Số lượng ${line.product?.name ?? line.productId}`} type="number" min="1" max={line.product?.stock} step="1" value={line.quantity} onChange={(event) => changeQuantity(line.productId, event.target.value)} />
                      <small className="customer-retail-sale__stock">Tồn: {line.product?.stock ?? 0}</small>
                    </td>
                    <td className="customer-retail-sale__money">{line.product ? formatCurrency(line.product.price) : '—'}</td>
                    <td className="customer-retail-sale__money">{formatCurrency(line.subtotal)}</td>
                    <td><button className="customer-retail-sale__remove" type="button" aria-label={`Xóa ${line.product?.name ?? line.productId}`} onClick={() => removeProduct(line.productId)}><Trash2 size={17} /></button></td>
                  </tr>
                )) : (
                  <tr><td className="customer-retail-sale__empty" colSpan="8">Chưa có sản phẩm. Tìm và chọn mỹ phẩm ở phía trên.</td></tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="customer-retail-sale__total"><span>Tổng tiền cần thanh toán</span><strong>{formatCurrency(total)}</strong></div>
        </section>

        <div className="customer-retail-sale__actions">
          <Button type="button" variant="secondary" onClick={handleCancel}>Hủy</Button>
          <Button type="submit" disabled={saving || loadingProducts || !products.length}>{saving ? 'Đang lưu…' : 'Lưu'}</Button>
        </div>
      </form>
    </div>
  );
}
