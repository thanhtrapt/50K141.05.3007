import { useState } from 'react';
import { ImagePlus } from 'lucide-react';

/**
 * Chuẩn hiển thị ảnh trong ô bảng dùng chung toàn hệ thống.
 * - Kích thước cố định, canh giữa, không bóp méo ảnh (object-fit: contain).
 * - Tự thay thế bằng trạng thái rỗng chuyên nghiệp khi thiếu ảnh hoặc ảnh lỗi.
 */
export default function TableThumb({ src, alt = '', size = 52 }) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <span className="table-thumb table-thumb--empty" style={{ width: size, height: size }} aria-label="Chưa có hình ảnh" role="img">
        <ImagePlus aria-hidden="true" size={Math.round(size * 0.34)} />
      </span>
    );
  }

  return (
    <img
      className="table-thumb"
      style={{ width: size, height: size }}
      src={src}
      alt={alt}
      loading="lazy"
      onError={() => setFailed(true)}
    />
  );
}
