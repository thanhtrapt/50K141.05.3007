import { useMemo, useState } from 'react';
import { ImagePlus, Plus } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import Button from '../../components/ui/Button.jsx';
import DataTable from '../../components/ui/DataTable.jsx';
import FeatureNotFound from '../../components/ui/FeatureNotFound.jsx';
import PageHeader from '../../components/ui/PageHeader.jsx';
import PageListToolbar from '../../components/ui/PageListToolbar.jsx';
import Pagination from '../../components/ui/Pagination.jsx';
import SearchBox from '../../components/ui/SearchBox.jsx';
import SelectField from '../../components/ui/SelectField.jsx';
import { formatCurrency, products as initialProducts } from '../../data/mockData.js';
import ProductDetailPage from './ProductDetailPage.jsx';
import ProductFormPage from './ProductFormPage.jsx';

const basePath = '/my-pham';
const productCategories = ['Serum', 'Làm sạch', 'Kem dưỡng', 'Mặt nạ', 'Toner'];

export default function ProductsPage() {
  const [items, setItems] = useState(initialProducts);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('');
  const [page, setPage] = useState(1);
  const { pathname } = useLocation();
  const navigate = useNavigate();

  const routeParts = pathname.slice(basePath.length).split('/').filter(Boolean);
  const isCreate = routeParts[0] === 'tao-moi';
  const editingId = routeParts.length === 2 && routeParts[1] === 'chinh-sua' ? routeParts[0] : null;
  const productId = isCreate ? null : routeParts[0] ?? null;
  const record = items.find((product) => product.id === editingId);
  const selected = items.find((product) => product.id === productId);
  const nextId = `MP${String(items.length + 1).padStart(3, '0')}`;

  const filtered = useMemo(() => items.filter((item) => {
    const matchesQuery = `${item.id} ${item.name}`.toLowerCase().includes(query.toLowerCase());
    return matchesQuery && (!category || item.category === category);
  }), [items, query, category]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / 9));
  const pageItems = filtered.slice((page - 1) * 9, page * 9);

  const saveProduct = (form) => {
    if (editingId) {
      setItems((current) => current.map((product) => product.id === editingId ? { ...product, ...form, id: editingId } : product));
      navigate(`${basePath}/${editingId}`);
      return;
    }

    setItems((current) => [...current, { ...form, id: nextId }]);
    navigate(basePath);
  };

  const deleteProduct = () => {
    setItems((current) => current.filter((product) => product.id !== productId));
    navigate(basePath, { replace: true });
  };

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
        product={selected}
        onBack={() => navigate(basePath)}
        onEdit={() => navigate(`${basePath}/${productId}/chinh-sua`)}
        onDelete={deleteProduct}
      />
    );
  }

  const columns = [
    { key: 'id', label: 'Mã MP', width: '12%' },
    { key: 'name', label: 'Tên mỹ phẩm', width: '30%', render: (product) => <button type="button" className="table-link" onClick={() => navigate(`${basePath}/${product.id}`)}>{product.name}</button> },
    { key: 'image', label: 'Hình ảnh minh họa', width: '22%', render: (product) => product.image ? <img className="product-thumbnail" src={product.image} alt={product.name} /> : <span className="product-thumbnail product-thumbnail--empty" aria-label="Chưa có hình ảnh"><ImagePlus size={18} /></span> },
    { key: 'stock', label: 'Tồn kho', width: '14%' },
    { key: 'price', label: 'Giá bán', width: '22%', render: (product) => formatCurrency(product.price) },
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
            options={[{ value: '', label: 'Loại sản phẩm' }, ...productCategories.map((value) => ({ value, label: value }))]}
          />
        )}
        actions={<Button onClick={() => navigate(`${basePath}/tao-moi`)}><Plus size={18} />Thêm mỹ phẩm</Button>}
      />
      <section className="panel page-list-panel">
        <DataTable columns={columns} rows={pageItems} rowKey="id" emptyMessage="Không tìm thấy mỹ phẩm phù hợp!" />
        <div className="panel__footer"><Pagination page={page} pageCount={pageCount} onChange={setPage} /></div>
      </section>
    </div>
  );
}
