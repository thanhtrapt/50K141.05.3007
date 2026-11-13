import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import PageHeader from '../../components/ui/PageHeader.jsx';
import SearchBox from '../../components/ui/SearchBox.jsx';
import DataTable from '../../components/ui/DataTable.jsx';
import StatusBadge from '../../components/ui/StatusBadge.jsx';
import Pagination from '../../components/ui/Pagination.jsx';
import { expiryItems, lowStockItems } from '../../data/mockData.js';

export default function AlertsPage() {
  const [tab, setTab] = useState('stock');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const isStock = tab === 'stock';
  const source = isStock ? lowStockItems : expiryItems;
  const rows = useMemo(() => source.filter((item) => `${item.id} ${item.name} ${item.lot}`.toLowerCase().includes(query.toLowerCase())), [source, query]);
  const pageCount = Math.max(1, Math.ceil(rows.length / 8));
  const pageRows = rows.slice((page - 1) * 8, page * 8);
  const columns = isStock
    ? [
        { key: 'id', label: 'Mã sản phẩm', width: '16%' },
        { key: 'name', label: 'Tên sản phẩm', width: '35%' },
        { key: 'category', label: 'Phân loại', width: '19%' },
        { key: 'stock', label: 'Số lượng tồn kho', width: '16%' },
        { key: 'status', label: 'Trạng thái tồn kho', render: (item) => <StatusBadge tone={item.tone}>{item.status}</StatusBadge> },
      ]
    : [
        { key: 'lot', label: 'Mã lô', width: '12%' },
        { key: 'id', label: 'Mã SP', width: '12%' },
        { key: 'name', label: 'Tên sản phẩm', width: '25%' },
        { key: 'category', label: 'Phân loại', width: '17%' },
        { key: 'expiry', label: 'Hạn sử dụng', width: '14%' },
        { key: 'days', label: 'Số ngày còn lại', width: '12%' },
        { key: 'status', label: 'Trạng thái', render: (item) => <StatusBadge tone={item.tone}>{item.status}</StatusBadge> },
      ];

  return (
    <div className="page-stack">
      <PageHeader title={isStock ? 'CẢNH BÁO MỸ PHẨM TỒN KHO' : 'CẢNH BÁO HẠN SỬ DỤNG'} />
      <div className="alert-tabs" role="tablist" aria-label="Nhóm cảnh báo">
        <button className={isStock ? 'is-active' : ''} type="button" role="tab" aria-selected={isStock} onClick={() => { setTab('stock'); setPage(1); }}>
          Mỹ phẩm tồn kho <span>{lowStockItems.length.toString().padStart(2, '0')}</span>
        </button>
        <button className={!isStock ? 'is-active' : ''} type="button" role="tab" aria-selected={!isStock} onClick={() => { setTab('expiry'); setPage(1); }}>
          Hạn sử dụng <span>{expiryItems.length.toString().padStart(2, '0')}</span>
        </button>
      </div>
      <section className="panel alert-panel">
        <header className="panel__header">
          <h2>{isStock ? 'Danh sách mỹ phẩm tồn kho' : 'Danh sách mỹ phẩm sắp hết hạn'}</h2>
          <Link className="text-link" to="/my-pham">Quản lý mỹ phẩm ›</Link>
        </header>
        <div className="panel__toolbar">
          <SearchBox value={query} onChange={setQuery} placeholder="Nhập tên hoặc mã sản phẩm..." />
          <span>Kết quả {rows.length} sản phẩm</span>
        </div>
        {rows.length ? (
          <DataTable columns={columns} rows={pageRows} rowKey="lot" />
        ) : (
          <div className="empty-state"><strong>Không tìm thấy sản phẩm phù hợp!</strong></div>
        )}
        <div className="panel__footer"><Pagination page={page} pageCount={pageCount} onChange={setPage} /></div>
      </section>
    </div>
  );
}
