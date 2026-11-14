import { useMemo, useState } from 'react';
import { CircleAlert, Package, PackageX } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import DataTable from '../../components/ui/DataTable.jsx';
import PageHeader from '../../components/ui/PageHeader.jsx';
import Pagination from '../../components/ui/Pagination.jsx';
import SearchBox from '../../components/ui/SearchBox.jsx';
import StatusBadge from '../../components/ui/StatusBadge.jsx';
import { expiryItems, lowStockItems } from '../../data/mockData.js';

function AlertSummary({ icon: Icon, label, value, tone }) {
  return (
    <article className={`alert-summary alert-summary--${tone}`}>
      <div>
        <span>{label}</span>
        <strong>{String(value).padStart(2, '0')}</strong>
      </div>
      <span className="alert-summary__icon"><Icon aria-hidden="true" size={21} strokeWidth={1.8} /></span>
    </article>
  );
}

export default function AlertsPage() {
  const { pathname } = useLocation();
  const isStock = pathname.endsWith('/ton-kho');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const source = isStock ? lowStockItems : expiryItems;
  const rows = useMemo(
    () => source.filter((item) => `${item.id} ${item.name} ${item.lot}`.toLowerCase().includes(query.toLowerCase())),
    [source, query],
  );
  const pageCount = Math.max(1, Math.ceil(rows.length / 8));
  const pageRows = rows.slice((page - 1) * 8, page * 8);
  const columns = isStock
    ? [
        { key: 'id', label: 'Mã sản phẩm', width: '14%' },
        { key: 'name', label: 'Tên sản phẩm', width: '31%' },
        { key: 'category', label: 'Phân loại', width: '19%' },
        { key: 'stock', label: 'Số lượng tồn kho hiện tại', width: '19%' },
        { key: 'status', label: 'Trạng thái tồn kho', width: '17%', render: (item) => <StatusBadge tone={item.tone}>{item.status}</StatusBadge> },
      ]
    : [
        { key: 'lot', label: 'Mã lô', width: '10%' },
        { key: 'id', label: 'Mã SP', width: '11%' },
        { key: 'name', label: 'Tên sản phẩm', width: '21%' },
        { key: 'category', label: 'Phân loại', width: '15%' },
        { key: 'expiry', label: 'Hạn sử dụng', width: '14%' },
        { key: 'days', label: 'Số ngày còn lại', width: '14%' },
        { key: 'status', label: 'Trạng thái', width: '15%', render: (item) => <StatusBadge tone={item.tone}>{item.status}</StatusBadge> },
      ];
  const heading = isStock ? 'CẢNH BÁO MỸ PHẨM TỒN KHO' : 'CẢNH BÁO HẠN SỬ DỤNG';
  const panelHeading = isStock ? 'Danh sách mỹ phẩm tồn kho' : 'Danh sách mỹ phẩm sắp hết hạn sử dụng';
  const summary = (
    <div className={`alert-summary-grid${isStock ? '' : ' alert-summary-grid--inside'}`}>
      {isStock ? (
        <>
          <AlertSummary icon={Package} label="Số mỹ phẩm sắp hết hàng" value={lowStockItems.filter((item) => item.tone === 'warning').length} tone="warning" />
          <AlertSummary icon={PackageX} label="Số mỹ phẩm hết hàng" value={lowStockItems.filter((item) => item.tone === 'danger').length} tone="danger" />
        </>
      ) : (
        <>
          <AlertSummary icon={Package} label="Số lô mỹ phẩm sắp hết hạn sử dụng" value={expiryItems.filter((item) => item.days > 0).length} tone="warning" />
          <AlertSummary icon={PackageX} label="Số lô mỹ phẩm đã hết hạn sử dụng" value={expiryItems.filter((item) => item.days <= 0).length} tone="danger" />
        </>
      )}
    </div>
  );

  return (
    <div className={`page-stack alert-page${isStock ? ' alert-page--stock' : ' alert-page--expiry'}`}>
      <PageHeader title={heading} />
      {isStock && summary}
      <section className="panel alert-panel">
        {!isStock && <>
          <header className="panel__header">
            <h2>{panelHeading}</h2>
            <Link className="text-link" to="/my-pham">Xem tất cả ›</Link>
          </header>
          {summary}
        </>}
        <div className="alert-panel__toolbar">
          <SearchBox value={query} onChange={(value) => { setQuery(value); setPage(1); }} placeholder="Nhập từ khóa cần tra cứu..." />
          <span>Kết quả {rows.length} sản phẩm</span>
        </div>
        <DataTable columns={columns} rows={pageRows} rowKey="lot" emptyMessage="Không tìm thấy sản phẩm phù hợp!" />
        <div className="panel__footer"><Pagination page={page} pageCount={pageCount} onChange={setPage} /></div>
      </section>
      <Link className="alert-page__switch" to={isStock ? '/canh-bao/han-su-dung' : '/canh-bao/ton-kho'}>
        <CircleAlert aria-hidden="true" size={16} />
        {isStock ? 'Xem cảnh báo hạn sử dụng' : 'Xem cảnh báo tồn kho'}
      </Link>
    </div>
  );
}
