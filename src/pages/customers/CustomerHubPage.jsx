import { ClipboardList, Star } from 'lucide-react';
import { Link } from 'react-router-dom';

const customerSections = [
  { to: '/ho-so-khach-hang', label: 'Hồ sơ khách hàng', icon: ClipboardList },
  { to: '/danh-gia', label: 'Đánh giá', icon: Star },
];

export default function CustomerHubPage() {
  return (
    <div className="page-stack customer-hub-page">
      <nav className="customer-function-tabs" aria-label="Chức năng khách hàng">
        {customerSections.map(({ to, label, icon: Icon }) => (
          <Link className="customer-function-tab" key={to} to={to}>
            <Icon aria-hidden="true" size={19} strokeWidth={1.8} />
            <span>{label}</span>
          </Link>
        ))}
      </nav>
    </div>
  );
}
