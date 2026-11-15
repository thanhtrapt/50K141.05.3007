import { useMemo, useState } from 'react';
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
  const { showDialog } = useFeedback();

  const routeParts = pathname.slice(basePath.length).split('/').filter(Boolean);
  const isCreate = routeParts[0] === 'tao-moi';
  const editingId = routeParts.length === 2 && routeParts[1] === 'chinh-sua' ? routeParts[0] : null;
  const productId = isCreate ? null : routeParts[0] ?? null;
  const record = items.find((product) => product.id === editingId);
  const selected = items.find((product) => product.id === productId);
  const nextId = `MP${String(items.length + 1).padStart(8, '0')}`;

  const filtered = useMemo(() => items.filter((item) => {
    const matchesQuery = `${item.id} ${item.name}`.toLowerCase().includes(query.toLowerCase());
    return matchesQuery && (!category || item.category === category);
  }), [items, query, category]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / 9));
  const pageItems = filtered.slice((page - 1) * 9, page * 9);

  const saveProduct = (form) => {
    if (editingId) {
      setItems((current) => current.map((product) => product.id === editingId ? { ...product, ...form, id: editingId } : product));
      showDialog({ tone: 'success', title: 'Cập nhật thành công', message: 'Thông tin mỹ phẩm sau cập nhật đã được lưu.', size: 'medium', wideButton: true });
      navigate(`${basePath}/${editingId}`);
      return;
    }

    setItems((current) => [...current, { ...form, id: nextId }]);
    showDialog({ tone: 'success', title: 'Tạo thông tin thành công', message: 'Thông tin mỹ phẩm đã được lưu.', size: 'medium', wideButton: true });
    navigate(basePath);
  };

  const deleteProduct = () => {
    setItems((current) => current.filter((product) => product.id !== productId));
    showDialog({ tone: 'success', title: 'Xóa mỹ phẩm thành công' });
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
            options={[{ value: '', label: 'Loại sản phẩm' }, ...productCategories.map((value) => ({ value, label: value }))]}
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
