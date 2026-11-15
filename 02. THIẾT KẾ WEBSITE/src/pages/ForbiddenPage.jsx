import { useNavigate } from 'react-router-dom';
import FeatureNotFound from '../components/ui/FeatureNotFound.jsx';

/** Trang 403 dùng chung khi tài khoản không có quyền vào chức năng. */
export default function ForbiddenPage({ message = 'Tài khoản của bạn không có quyền truy cập chức năng này.' }) {
  const navigate = useNavigate();
  return (
    <FeatureNotFound
      heading="KHÔNG CÓ QUYỀN TRUY CẬP"
      message={message}
      onBack={() => navigate('/trang-chu')}
      backLabel="Về trang chủ"
    />
  );
}
