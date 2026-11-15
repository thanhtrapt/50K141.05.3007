import { useEffect, useMemo, useState } from 'react';
import { CircleAlert, Package, PackageX } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import DataTable from '../../components/ui/DataTable.jsx';
import FeedbackDialog from '../../components/ui/FeedbackDialog.jsx';
import Button from '../../components/ui/Button.jsx';
import PageHeader from '../../components/ui/PageHeader.jsx';
import Pagination from '../../components/ui/Pagination.jsx';
import SearchBox from '../../components/ui/SearchBox.jsx';
import StatusBadge from '../../components/ui/StatusBadge.jsx';
import { apiRequest } from '../../api.js';

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
  const [source, setSource] = useState([]);
  const [summaryData, setSummaryData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [stockWarningOpen, setStockWarningOpen] = useState(isStock && sessionStorage.getItem('huong-spa-stock-warning-seen') !== 'true');

  useEffect(() => {
    let active = true;
    setLoading(true);
    const endpoint = isStock ? '/api/alerts/stock' : '/api/alerts/expiry';
    apiRequest(endpoint)
      .then((result) => {
        if (!active) return;
        setSummaryData(result.summary ?? null);
        setSource((result.data ?? []).map((item) => {
          const expiryDate = item.expiryDate ? new Date(item.expiryDate) : null;
          const days = expiryDate ? Math.ceil((expiryDate.setHours(0, 0, 0, 0) - new Date().setHours(0, 0, 0, 0)) / 86400000) : null;
          return {
            ...item,
            id: item.cosmeticId ?? '',
            lot: item.batchId ?? '',
            name: item.cosmeticName ?? '',
            expiry: item.expiryDate ? new Date(item.expiryDate).toLocaleDateString('vi-VN') : '—',
            days,
            tone: String(item.status).startsWith('Hết') ? 'danger' : 'warning',
          };
        }));
      })
      .catch((error) => { if (active) setLoadError(error.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [isStock]);

  const rows = useMemo(
    () => source.filter((item) => `${item.id} ${item.name} ${item.lot}`.toLowerCase().includes(query.toLowerCase())),
    [source, query],
  );
  const pageCount = Math.max(1, Math.ceil(rows.length / 8));
  const pageRows = rows.slice((page - 1) * 8, page * 8);
  const columns = isStock
    ? [
        { key: 'id', label: 'Mã sản phẩm', width: '14%', align: 'center' },
        { key: 'name', label: 'Tên sản phẩm', width: '34%' },
        { key: 'category', label: 'Phân loại', width: '18%' },
        { key: 'stock', label: 'Tồn kho', width: '16%', align: 'center' },
        { key: 'status', label: 'Trạng thái tồn kho', width: '18%', align: 'center', render: (item) => <StatusBadge tone={item.tone}>{item.status}</StatusBadge> },
      ]
    : [
        { key: 'lot', label: 'Mã lô', width: '12%', align: 'center' },
        { key: 'id', label: 'Mã SP', width: '12%', align: 'center' },
        { key: 'name', label: 'Tên sản phẩm', width: '26%' },
        { key: 'category', label: 'Phân loại', width: '14%' },
        { key: 'expiry', label: 'Hạn sử dụng', width: '13%', align: 'center' },
        { key: 'days', label: 'Số ngày còn lại', width: '11%', align: 'center' },
        { key: 'status', label: 'Trạng thái', width: '12%', align: 'center', render: (item) => <StatusBadge tone={item.tone}>{item.status}</StatusBadge> },
      ];
  const heading = isStock ? 'CẢNH BÁO MỸ PHẨM TỒN KHO' : 'CẢNH BÁO HẠN SỬ DỤNG';
  const panelHeading = isStock ? 'Danh sách mỹ phẩm tồn kho' : 'Danh sách mỹ phẩm sắp hết hạn sử dụng';
  const summary = (
    <div className={`alert-summary-grid${isStock ? '' : ' alert-summary-grid--inside'}`}>
      {isStock ? (
        <>
          <AlertSummary icon={Package} label="Số mỹ phẩm sắp hết hàng" value={summaryData?.lowStock?.soon ?? 0} tone="warning" />
          <AlertSummary icon={PackageX} label="Số mỹ phẩm hết hàng" value={summaryData?.lowStock?.out ?? 0} tone="danger" />
        </>
      ) : (
        <>
          <AlertSummary icon={Package} label="Số lô mỹ phẩm sắp hết hạn sử dụng" value={summaryData?.expiry?.soon ?? 0} tone="warning" />
          <AlertSummary icon={PackageX} label="Số lô mỹ phẩm đã hết hạn sử dụng" value={summaryData?.expiry?.expired ?? 0} tone="danger" />
        </>
      )}
    </div>
  );

  return (
    <div className={`page-stack alert-page${isStock ? ' alert-page--stock' : ' alert-page--expiry'}`}>
      <PageHeader title={heading} />
      {loading && <div className="panel data-loading" role="status">Đang tổng hợp cảnh báo từ SQL…</div>}
      {loadError && <div className="panel data-error" role="alert">Không tải được cảnh báo: {loadError}</div>}
      <FeedbackDialog
        open={stockWarningOpen}
        title="Cảnh báo tồn kho"
        message="Cảnh báo có mỹ phẩm đã chạm ngưỡng tối thiểu!"
        closeLabel="Xem thông báo"
        onClose={() => { setStockWarningOpen(false); sessionStorage.setItem('huong-spa-stock-warning-seen', 'true'); }}
      ><Button variant="secondary" onClick={() => { setStockWarningOpen(false); sessionStorage.setItem('huong-spa-stock-warning-seen', 'true'); }}>Đóng</Button></FeedbackDialog>
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
        <DataTable columns={columns} rows={pageRows} rowKey={isStock ? 'id' : 'lot'} emptyMessage="Không tìm thấy sản phẩm phù hợp!" />
        <div className="panel__footer"><Pagination page={page} pageCount={pageCount} onChange={setPage} /></div>
      </section>
      <Link className="alert-page__switch" to={isStock ? '/canh-bao/han-su-dung' : '/canh-bao/ton-kho'}>
        <CircleAlert aria-hidden="true" size={16} />
        {isStock ? 'Xem cảnh báo hạn sử dụng' : 'Xem cảnh báo tồn kho'}
      </Link>
    </div>
  );
}
