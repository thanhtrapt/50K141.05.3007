import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

/**
 * Nút "Quay lại" dùng chung cho toàn bộ các trang chi tiết.
 * - Tự động ưu tiên navigate(-1) nếu có lịch sử duyệt trang.
 * - Chuyển về fallbackPath nếu người dùng truy cập trực tiếp bằng URL.
 * - Kích thước nhỏ gọn (cao 32-36px, padding ngang 12-14px, font 13-14px, icon 15px).
 * - Viền nâu/vàng đồng, nền trắng, chữ nâu đậm, hover sang màu be nhạt.
 * - Responsive: thu gọn hoặc chỉ hiện icon trên màn hình hẹp, không vỡ layout.
 */
export default function BackButton({
  fallbackPath = '/',
  onBack,
  label = 'Quay lại',
  className = '',
}) {
  const navigate = useNavigate();

  const handleClick = (event) => {
    if (onBack) {
      onBack(event);
      return;
    }

    if (typeof window !== 'undefined' && window.history?.state?.idx > 0) {
      navigate(-1);
    } else if (fallbackPath) {
      navigate(fallbackPath);
    } else {
      navigate(-1);
    }
  };

  return (
    <button
      type="button"
      className={`back-button ${className}`.trim()}
      onClick={handleClick}
      aria-label={label}
      title={label}
    >
      <ArrowLeft className="back-button__icon" size={15} />
      <span className="back-button__text">{label}</span>
    </button>
  );
}
