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
  '/canh-bao/ton-kho': 'Cảnh báo tồn kho',
  '/canh-bao/han-su-dung': 'Cảnh báo hạn sử dụng',
};

const vietnameseDate = new Intl.DateTimeFormat('vi-VN', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
}).format(new Date());

function getPageTitle(pathname) {
  if (routeTitles[pathname]) return routeTitles[pathname];

  const segments = pathname.split('/').filter(Boolean);
  const section = segments[0];
  const action = segments.at(-1);

  if ((section === 'ho-so-khach-hang' || section === 'khach-hang') && segments[2] === 'dich-vu-dang-su-dung') {
    return 'Dịch vụ đang sử dụng';
  }

  if (section === 'ho-so-khach-hang' || section === 'khach-hang') {
    if (action === 'tao-moi') return 'Tạo hồ sơ khách hàng';
    if (action === 'chinh-sua') return 'Chỉnh sửa hồ sơ khách hàng';
    if (segments.length > 1) return 'Chi tiết hồ sơ khách hàng';
  }

  if (section === 'dich-vu') {
    if (action === 'tao-moi') return 'Tạo dịch vụ';
    if (action === 'chinh-sua') return 'Chỉnh sửa dịch vụ';
    if (segments.length > 1) return 'Chi tiết dịch vụ';
  }

  if (section === 'lich-hen' && segments.length > 1) return 'Chi tiết lịch hẹn';
  if (section === 'danh-gia' && segments.length > 1) return 'Chi tiết đánh giá';
  if (section === 'phieu-nhap-kho' && segments.length > 1) {
    if (action === 'tao-moi') return 'Tạo phiếu nhập kho';
    return 'Chi tiết phiếu nhập kho';
  }

  if (section === 'my-pham') {
    if (action === 'tao-moi') return 'Tạo mới';
    if (action === 'chinh-sua') return 'Chỉnh sửa';
    if (segments.length > 1) return 'Chi tiết sản phẩm';
  }

  return 'Trang chủ';
}

function getBreadcrumbItems(pathname, pageTitle) {
  const segments = pathname.split('/').filter(Boolean);
  const section = segments[0];
  const isCustomerService = (section === 'khach-hang' || section === 'ho-so-khach-hang')
    && segments[2] === 'dich-vu-dang-su-dung';

  if (!isCustomerService) return [{ label: 'Quản lý Spa', to: '/trang-chu' }, { label: pageTitle }];

  const basePath = section === 'ho-so-khach-hang' ? '/ho-so-khach-hang' : '/khach-hang';
  return [
    { label: 'Quản lý Spa', to: '/trang-chu' },
    { label: 'Hồ sơ khách hàng', to: `${basePath}/${segments[1]}` },
    { label: 'Dịch vụ đang sử dụng' },
  ];
}

export default function TopBar({ onMenuClick }) {
  const { pathname } = useLocation();
  const pageTitle = getPageTitle(pathname);
  const breadcrumbs = getBreadcrumbItems(pathname, pageTitle);

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
        {breadcrumbs.map((item, index) => (
          <span className="top-bar__breadcrumb-part" key={item.label}>
            {index > 0 && <span aria-hidden="true">&gt;&gt;</span>}
            {item.to ? <Link to={item.to}>{item.label}</Link> : <span>{item.label}</span>}
          </span>
        ))}
      </div>
      <div className="top-bar__actions">
        <div className="top-bar__date">
          <CalendarDays aria-hidden="true" size={20} strokeWidth={1.8} />
          <span>{vietnameseDate}</span>
        </div>
        <span className="top-bar__divider" aria-hidden="true" />
        <Link className="icon-button top-bar__notifications" to="/canh-bao/ton-kho" aria-label="Xem cảnh báo">
          <Bell aria-hidden="true" size={25} strokeWidth={1.8} />
          <span className="notification-dot" aria-hidden="true" />
        </Link>
      </div>
    </header>
  );
}
