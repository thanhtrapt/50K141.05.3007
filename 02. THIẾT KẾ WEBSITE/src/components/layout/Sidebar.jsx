import {
  CalendarDays,
  ClipboardList,
  House,
  Package,
  PackageCheck,
  Sparkles,
  Star,
  UserRound,
  UsersRound,
} from 'lucide-react';
import { NavLink } from 'react-router-dom';

const navigationItems = [
  { to: '/trang-chu', label: 'Trang chủ', icon: House },
  { to: '/lich-hen', label: 'Lịch hẹn', icon: CalendarDays },
  {
    to: '/khach-hang',
    label: 'Khách hàng',
    icon: UsersRound,
    children: [
      { to: '/ho-so-khach-hang', label: 'Hồ sơ khách hàng', icon: UserRound },
      { to: '/danh-gia', label: 'Đánh giá', icon: Star },
    ],
  },
  { to: '/dich-vu', label: 'Dịch vụ', icon: Sparkles },
  { to: '/my-pham', label: 'Mỹ phẩm', icon: Package },
  { to: '/phieu-nhap-kho', label: 'Phiếu nhập kho', icon: ClipboardList },
  { to: '/phieu-xuat-kho', label: 'Phiếu xuất kho nội bộ', icon: PackageCheck },
];

function NavigationLink({ to, label, icon: Icon, onNavigate, child = false }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) => `navigation-link${child ? ' navigation-link--child' : ''}${isActive ? ' is-active' : ''}`}
      onClick={onNavigate}
    >
      <Icon aria-hidden="true" size={21} strokeWidth={1.7} />
      <span>{label}</span>
      <span className="navigation-link__marker" aria-hidden="true" />
    </NavLink>
  );
}

export default function Sidebar({ onNavigate }) {
  return (
    <aside className="app-sidebar" aria-label="Điều hướng chính">
      <div className="sidebar-brand">
        <img src="/assets/brand-lockup.png" alt="Hương Spa — Hệ thống quản lý spa" />
      </div>

      <nav className="sidebar-navigation">
        {navigationItems.map(({ to, label, icon: Icon, children }) => children ? (
          <div className="navigation-group" key={to}>
            <NavigationLink to={to} label={label} icon={Icon} onNavigate={onNavigate} />
            <div className="navigation-submenu">
              {children.map((child) => <NavigationLink key={child.to} {...child} child onNavigate={onNavigate} />)}
            </div>
          </div>
        ) : (
          <NavigationLink key={to} to={to} label={label} icon={Icon} onNavigate={onNavigate} />
        ))}
      </nav>

      <div className="sidebar-user">
        <span className="sidebar-user__avatar" aria-hidden="true">TH</span>
        <span className="sidebar-user__text">
          <strong>Lê Thị Thu Hương</strong>
          <small>Quản trị viên</small>
        </span>
      </div>
    </aside>
  );
}
