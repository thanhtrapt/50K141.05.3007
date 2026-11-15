import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext.jsx';
import ForbiddenPage from '../pages/ForbiddenPage.jsx';

/**
 * Chặn truy cập khi chưa đăng nhập và kiểm tra quyền theo ma trận RBAC.
 *
 * Dùng cho cả AppShell (chỉ cần đăng nhập) và các route quản trị như
 * Phiếu nhập kho (cần quyền `stock-receipts:read`, chỉ OWNER có).
 */
export default function RouteGuard({ permission, forbiddenMessage, children }) {
  const { status, user, can } = useAuth();
  const location = useLocation();

  if (status === 'loading') {
    return <div className="route-guard" role="status">Đang kiểm tra quyền truy cập…</div>;
  }

  if (!user) {
    return <Navigate to="/dang-nhap" replace state={{ from: location.pathname }} />;
  }

  if (permission && !can(permission)) {
    return <ForbiddenPage message={forbiddenMessage} />;
  }

  return children;
}
