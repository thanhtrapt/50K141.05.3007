import { useState } from 'react';
import {
  CalendarDays,
  ChevronDown,
  ClipboardList,
  House,
  Package,
  PackageCheck,
  Sparkles,
  Star,
  UserRound,
  UsersRound,
} from 'lucide-react';
import { NavLink, useLocation } from 'react-router-dom';

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

function NavigationLink({ to, label, icon: Icon, onNavigate, onToggle, child = false, expandable = false, expanded = false }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) => `navigation-link${child ? ' navigation-link--child' : ''}${expandable ? ' navigation-link--expandable' : ''}${isActive ? ' is-active' : ''}`}
      onClick={expandable ? onToggle : onNavigate}
      aria-expanded={expandable ? expanded : undefined}
      aria-controls={expandable ? 'customer-submenu' : undefined}
    >
      <Icon aria-hidden="true" size={21} strokeWidth={1.7} />
      <span>{label}</span>
      <span className="navigation-link__marker" aria-hidden="true" />
      {expandable && <ChevronDown className={`navigation-link__chevron${expanded ? ' is-expanded' : ''}`} aria-hidden="true" size={15} />}
    </NavLink>
  );
}

export default function Sidebar({ onNavigate }) {
  const { pathname } = useLocation();
  const [customersExpanded, setCustomersExpanded] = useState(() => pathname.startsWith('/ho-so-khach-hang') || pathname.startsWith('/danh-gia'));

  const toggleCustomers = () => {
    setCustomersExpanded((expanded) => !expanded);
  };

  return (
    <aside className="app-sidebar" aria-label="Điều hướng chính">
      <div className="sidebar-brand">
        <img src="/assets/brand-lockup.png" alt="Hương Spa — Hệ thống quản lý spa" />
      </div>

      <nav className="sidebar-navigation">
        {navigationItems.map(({ to, label, icon: Icon, children }) => children ? (
          <div className={`navigation-group${customersExpanded ? ' navigation-group--expanded' : ''}`} key={to}>
            <NavigationLink to={to} label={label} icon={Icon} expandable expanded={customersExpanded} onToggle={toggleCustomers} />
            <div className="navigation-submenu" id="customer-submenu" aria-hidden={!customersExpanded} inert={!customersExpanded}>
              <div className="navigation-submenu__inner">
                {children.map((child) => <NavigationLink key={child.to} {...child} child onNavigate={onNavigate} />)}
              </div>
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
