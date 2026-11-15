import { useState } from 'react';
import {
  CalendarDays,
  ChevronDown,
  ClipboardList,
  House,
  LogOut,
  Package,
  PackageCheck,
  Sparkles,
  Star,
  UserRound,
  UsersRound,
} from 'lucide-react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext.jsx';
import { roleLabel } from '../../auth/permissions.js';

const navigationItems = [
  { to: '/trang-chu', label: 'Trang chủ', icon: House, permission: 'dashboard:read' },
  { to: '/lich-hen', label: 'Lịch hẹn', icon: CalendarDays, permission: 'appointments:read' },
  {
    to: '/khach-hang',
    label: 'Khách hàng',
    icon: UsersRound,
    permission: 'customers:read',
    children: [
      { to: '/ho-so-khach-hang', label: 'Hồ sơ khách hàng', icon: UserRound, permission: 'customers:read' },
      { to: '/danh-gia', label: 'Đánh giá', icon: Star, permission: 'reviews:read' },
    ],
  },
  { to: '/dich-vu', label: 'Dịch vụ', icon: Sparkles, permission: 'services:read' },
  { to: '/my-pham', label: 'Mỹ phẩm', icon: Package, permission: 'cosmetics:read' },
  // Phiếu nhập kho chỉ OWNER thấy; menu tự ẩn với STAFF và route vẫn bị chặn bằng RouteGuard.
  { to: '/phieu-nhap-kho', label: 'Phiếu nhập kho', icon: ClipboardList, permission: 'stock-receipts:read' },
  { to: '/phieu-xuat-kho', label: 'Phiếu xuất kho nội bộ', icon: PackageCheck, permission: 'stock-issues:read' },
];

function initialsOf(name) {
  return name.trim().split(/\s+/).slice(-2).map((word) => word.charAt(0)).join('').toLocaleUpperCase('vi-VN');
}

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
  const navigate = useNavigate();
  const { user, role, can, logout } = useAuth();
  const [customersExpanded, setCustomersExpanded] = useState(() => pathname.startsWith('/ho-so-khach-hang') || pathname.startsWith('/danh-gia'));

  const toggleCustomers = () => {
    setCustomersExpanded((expanded) => !expanded);
  };

  const displayName = user?.full_name || user?.name || 'Người dùng';
  const visibleItems = navigationItems
    .filter((item) => can(item.permission))
    .map((item) => (item.children ? { ...item, children: item.children.filter((child) => can(child.permission)) } : item));

  const signOut = () => {
    logout();
    navigate('/dang-nhap', { replace: true });
  };

  return (
    <aside className="app-sidebar" aria-label="Điều hướng chính">
      <div className="sidebar-brand">
        <img src="/assets/brand-lockup.png" alt="Hương Spa — Hệ thống quản lý spa" />
      </div>

      <nav className="sidebar-navigation">
        {visibleItems.map(({ to, label, icon: Icon, children }) => children ? (
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
        <span className="sidebar-user__avatar" aria-hidden="true">{initialsOf(displayName)}</span>
        <span className="sidebar-user__text">
          <strong>{displayName}</strong>
          <small>{roleLabel(role, user?.roleName)}</small>
        </span>
        <button type="button" className="sidebar-user__logout" onClick={signOut} aria-label="Đăng xuất" title="Đăng xuất">
          <LogOut aria-hidden="true" size={18} strokeWidth={1.8} />
        </button>
      </div>
    </aside>
  );
}
