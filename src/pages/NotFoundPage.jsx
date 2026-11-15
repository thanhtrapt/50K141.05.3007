import { useNavigate } from 'react-router-dom';
import FeatureNotFound from '../components/ui/FeatureNotFound.jsx';

export default function NotFoundPage() {
  const navigate = useNavigate();
  return (
    <FeatureNotFound
      heading="KHÔNG TÌM THẤY TRANG"
      message="Không tìm thấy trang bạn đang tìm."
      onBack={() => window.history.length > 1 ? navigate(-1) : navigate('/trang-chu')}
      backLabel="Quay lại"
    />
  );
}
