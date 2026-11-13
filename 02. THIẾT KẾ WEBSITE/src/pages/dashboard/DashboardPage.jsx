import { useState } from 'react';
import { AlertTriangle, CircleAlert, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import PageHeader from '../../components/ui/PageHeader.jsx';
import Panel from '../../components/ui/Panel.jsx';

const alertGroups = [
  {
    id: 'stock',
    banner: 'Cảnh báo có mỹ phẩm đã chạm ngưỡng tối thiểu!',
    heading: 'Tổng quan cảnh báo tồn kho',
    rows: [
      { label: 'Hết hàng', count: '01 mặt hàng', detail: 'Tồn hiện tại: 0 đơn vị', tone: 'danger' },
      { label: 'Sắp hết hàng', count: '01 mặt hàng', detail: 'Tồn hiện tại: 3 đơn vị', tone: 'warning' },
    ],
  },
  {
    id: 'expiry',
    banner: 'Cảnh báo có mỹ phẩm sắp hết hạn sử dụng!',
    heading: 'Tổng quan cảnh báo hạn sử dụng',
    rows: [
      { label: 'Hết hạn', count: '0 mặt hàng', detail: 'Tồn hiện tại: 1 đơn vị', tone: 'danger' },
      { label: 'Sắp hết hạn', count: '01 mặt hàng', detail: 'Tồn hiện tại: 3 đơn vị', tone: 'warning' },
    ],
  },
];

export default function DashboardPage() {
  const [dismissed, setDismissed] = useState([]);

  const dismiss = (id) => setDismissed((current) => [...current, id]);

  return (
    <div className="page-stack dashboard-page">
      <PageHeader title="TRANG CHỦ" />
      {alertGroups.map((group) => (
        <div className="dashboard-alert-group" key={group.id}>
          {!dismissed.includes(group.id) && (
            <div className="dashboard-alert-banner" role="status">
              <AlertTriangle aria-hidden="true" size={22} />
              <strong>{group.banner}</strong>
              <Link to="/canh-bao">Xem thông báo</Link>
              <button type="button" aria-label="Đóng thông báo" onClick={() => dismiss(group.id)}>
                <X aria-hidden="true" size={19} />
              </button>
            </div>
          )}
          <Panel
            title={group.heading}
            action={<Link className="text-link" to="/canh-bao">Xem chi tiết ›</Link>}
            className="dashboard-panel"
          >
            <div className="dashboard-summary-grid">
              {group.rows.map((row) => (
                <Link className={`summary-card summary-card--${row.tone}`} to="/canh-bao" key={row.label}>
                  <span className="summary-card__icon">
                    {row.tone === 'danger'
                      ? <CircleAlert aria-hidden="true" size={21} />
                      : <AlertTriangle aria-hidden="true" size={21} />}
                  </span>
                  <strong className="summary-card__label">{row.label}</strong>
                  <span className="summary-card__count">{row.count}</span>
                  <span className="summary-card__detail">{row.detail}</span>
                </Link>
              ))}
            </div>
          </Panel>
        </div>
      ))}
    </div>
  );
}
