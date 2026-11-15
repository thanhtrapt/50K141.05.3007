import { Pencil, Trash2 } from 'lucide-react';

/**
 * Bộ nút "Chỉnh sửa" và "Xóa" chuẩn hóa dùng chung trên toàn website Hương Spa.
 * - Đồng nhất chiều cao (36px), căn giữa theo phương dọc, khoảng cách chuẩn.
 * - Font chữ 13.5px, độ bo góc 8px, icon 15px.
 * - Trạng thái hover, focus mượt mà và nhất quán.
 */

export function EditButton({
  onClick,
  label = 'Chỉnh sửa',
  className = '',
  disabled = false,
  ...props
}) {
  return (
    <button
      type="button"
      className={`btn-action btn-action--edit ${className}`.trim()}
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      {...props}
    >
      <Pencil className="btn-action__icon" size={15} />
      <span>{label}</span>
    </button>
  );
}

export function DeleteButton({
  onClick,
  label = 'Xóa',
  className = '',
  disabled = false,
  ...props
}) {
  return (
    <button
      type="button"
      className={`btn-action btn-action--delete ${className}`.trim()}
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      {...props}
    >
      <Trash2 className="btn-action__icon" size={15} />
      <span>{label}</span>
    </button>
  );
}

export function ActionGroup({ children, className = '' }) {
  return (
    <div className={`detail-action-group ${className}`.trim()}>
      {children}
    </div>
  );
}

export default {
  EditButton,
  DeleteButton,
  ActionGroup,
};
