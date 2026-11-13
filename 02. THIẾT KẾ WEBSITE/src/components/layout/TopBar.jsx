import { Bell, CalendarDays, Menu } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';

const routeTitles = {
  '/trang-chu': 'Trang chủ',
  '/lich-hen': 'Lịch hẹn',
  '/khach-hang': 'Khách hàng',
  '/ho-so-khach-hang': 'Hồ sơ khách hàng',
  '/danh-gia': 'Đánh giá',
  '/dich-vu': 'Dịch vụ',
  '/my-pham': 'Mỹ phẩm',
  '/phieu-nhap-kho': 'Phiếu nhập kho',
  '/phieu-xuat-kho': 'Phiếu xuất kho nội bộ',
  '/canh-bao': 'Cảnh báo',
};

const vietnameseDate = new Intl.DateTimeFormat('vi-VN', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
}).format(new Date());

export default function TopBar({ onMenuClick }) {
  const { pathname } = useLocation();
  const pageTitle = routeTitles[pathname] ?? 'Trang chủ';

  return (
    <header className="top-bar">
      <button
        className="icon-button top-bar__menu"
        type="button"
        aria-label="Mở menu điều hướng"
        onClick={onMenuClick}
      >
        <Menu aria-hidden="true" size={22} />
      </button>
      <div className="top-bar__breadcrumb" aria-label="Đường dẫn trang">
        <Link to="/trang-chu">Quản lý Spa</Link>
        <span aria-hidden="true">&gt;&gt;</span>
        <span>{pageTitle}</span>
      </div>
      <div className="top-bar__actions">
        <div className="top-bar__date">
          <CalendarDays aria-hidden="true" size={20} strokeWidth={1.8} />
          <span>{vietnameseDate}</span>
        </div>
        <span className="top-bar__divider" aria-hidden="true" />
        <Link className="icon-button top-bar__notifications" to="/canh-bao" aria-label="Xem cảnh báo">
          <Bell aria-hidden="true" size={25} strokeWidth={1.8} />
          <span className="notification-dot" aria-hidden="true" />
        </Link>
      </div>
    </header>
  );
}
