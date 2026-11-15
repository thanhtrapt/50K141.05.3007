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
import SelectField from '../../components/ui/SelectField.jsx';
import TableThumb from '../../components/ui/TableThumb.jsx';
import { formatCurrency } from '../../data/mockData.js';
import { apiList, apiRequest } from '../../api.js';
import ProductDetailPage from './ProductDetailPage.jsx';
import ProductFormPage from './ProductFormPage.jsx';

const basePath = '/my-pham';
const productCategories = ['Bán lẻ', 'Dùng cho liệu trình'];

export default function ProductsPage() {
  const [items, setItems] = useState([]);
  const [selectedDetail, setSelectedDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('');
  const [page, setPage] = useState(1);
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { showDialog } = useFeedback();

  useEffect(() => {
    let active = true;
    setLoading(true);
    apiList('/api/cosmetics')
      .then((rows) => { if (active) setItems(rows.map((item) => ({ ...item, price: Number(item.salePrice), stock: Number(item.stock) }))); })
      .catch((error) => { if (active) setLoadError(error.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const routeParts = pathname.slice(basePath.length).split('/').filter(Boolean);
  const isCreate = routeParts[0] === 'tao-moi';
  const editingId = routeParts.length === 2 && routeParts[1] === 'chinh-sua' ? routeParts[0] : null;
  const productId = isCreate ? null : routeParts[0] ?? null;
  const record = items.find((product) => product.id === editingId);
  const selected = items.find((product) => product.id === productId);
  const nextId = 'Tự động tạo';

  useEffect(() => {
    let active = true;
    setSelectedDetail(null);
    if (!productId) return () => { active = false; };
    apiRequest(`/api/cosmetics/${encodeURIComponent(productId)}`)
      .then((product) => { if (active) setSelectedDetail({ ...product, price: Number(product.salePrice), stock: Number(product.stock) }); })
      .catch((error) => { if (active) setLoadError(error.message); });
    return () => { active = false; };
  }, [productId]);

  const filtered = useMemo(() => items.filter((item) => {
    const matchesQuery = `${item.id} ${item.name}`.toLowerCase().includes(query.toLowerCase());
    return matchesQuery && (!category || item.category === category);
  }), [items, query, category]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / 9));
  const pageItems = filtered.slice((page - 1) * 9, page * 9);

  const saveProduct = async (form) => {
    let image = form.image || null;
    if (image?.startsWith('data:')) {
      const match = /^data:(image\/(?:png|jpeg|webp));base64,(.+)$/.exec(image);
      if (!match) throw new Error('Ảnh cần ở định dạng PNG, JPG hoặc WEBP.');
      const uploaded = await apiRequest('/api/files/images', {
        method: 'POST',
        body: { mimeType: match[1], base64: match[2], originalName: `${form.name}-san-pham` },
      });
      image = uploaded.path;
    }
    const body = { name: form.name, category: form.category, unit: form.unit, salePrice: Number(form.price), description: form.description, image };
    const saved = editingId
      ? await apiRequest(`/api/cosmetics/${encodeURIComponent(editingId)}`, { method: 'PUT', body })
      : await apiRequest('/api/cosmetics', { method: 'POST', body });
    const rows = await apiList('/api/cosmetics');
    setItems(rows.map((item) => ({ ...item, price: Number(item.salePrice), stock: Number(item.stock) })));
    showDialog({ tone: 'success', title: editingId ? 'Cập nhật thành công' : 'Tạo thông tin thành công', message: 'Dữ liệu đã được lưu vào cơ sở dữ liệu SQL.', size: 'medium', wideButton: true });
    navigate(editingId ? `${basePath}/${editingId}` : basePath);
    return saved;
  };

  const deleteProduct = async () => {
    try {
      await apiRequest(`/api/cosmetics/${encodeURIComponent(productId)}`, { method: 'DELETE' });
      setItems((current) => current.filter((product) => product.id !== productId));
      showDialog({ tone: 'success', title: 'Xóa mỹ phẩm thành công' });
      navigate(basePath, { replace: true });
    } catch (error) {
      showDialog({ title: 'Không thể xóa mỹ phẩm', message: error.message });
    }
  };

  if (loading) return <div className="panel data-loading" role="status">Đang tải mỹ phẩm từ SQL…</div>;
  if (loadError && !items.length) return <div className="panel data-error" role="alert">Không tải được dữ liệu mỹ phẩm: {loadError}</div>;

  if (isCreate || editingId) {
    if (editingId && !record) {
      return <FeatureNotFound heading="MỸ PHẨM" message="Không tìm thấy mỹ phẩm phù hợp!" onBack={() => navigate(basePath)} />;
    }
    return (
      <ProductFormPage
        record={record}
        nextId={nextId}
        categories={productCategories}
        onCancel={() => navigate(editingId ? `${basePath}/${editingId}` : basePath)}
        onSave={saveProduct}
      />
    );
  }

  if (productId) {
    if (!selected) {
      return <FeatureNotFound heading="MỸ PHẨM" message="Không tìm thấy mỹ phẩm phù hợp!" onBack={() => navigate(basePath)} />;
    }
    return (
      <ProductDetailPage
        product={selectedDetail ?? selected}
        fallbackPath={basePath}
        onBack={() => navigate(basePath)}
        onEdit={() => navigate(`${basePath}/${productId}/chinh-sua`)}
        onDelete={deleteProduct}
      />
    );
  }

  const columns = [
    { key: 'id', label: 'Mã MP', width: '16%', align: 'center', nowrap: true },
    { key: 'name', label: 'Tên mỹ phẩm', width: '28%', render: (product) => <button type="button" className="table-link" onClick={() => navigate(`${basePath}/${product.id}`)}>{product.name}</button> },
    { key: 'image', label: 'Hình ảnh minh họa', width: '23%', align: 'center', nowrap: true, render: (product) => <TableThumb src={product.image} alt={product.name} /> },
    { key: 'stock', label: 'Tồn kho', width: '15%', align: 'center', nowrap: true },
    { key: 'price', label: 'Giá bán', width: '18%', align: 'right', nowrap: true, render: (product) => formatCurrency(product.price) },
  ];

  return (
    <div className="page-stack product-page">
      <PageHeader title="DANH SÁCH MỸ PHẨM" />
      <PageListToolbar
        className="product-toolbar"
        search={<SearchBox value={query} onChange={(value) => { setQuery(value); setPage(1); }} placeholder="Nhập từ khóa cần tra cứu..." />}
        filters={(
          <SelectField
            aria-label="Loại sản phẩm"
            value={category}
            onChange={(event) => { setCategory(event.target.value); setPage(1); }}
            options={[{ value: '', label: 'Tất cả' }, ...productCategories.map((value) => ({ value, label: value }))]}
          />
        )}
        actions={<Button onClick={() => navigate(`${basePath}/tao-moi`)}><Plus size={18} />Thêm mỹ phẩm</Button>}
      />
      <section className="panel page-list-panel">
        <DataTable fitContainer columns={columns} rows={pageItems} rowKey="id" emptyMessage="Không tìm thấy mỹ phẩm phù hợp!" />
        <div className="panel__footer"><Pagination page={page} pageCount={pageCount} onChange={setPage} /></div>
      </section>
    </div>
  );
}
