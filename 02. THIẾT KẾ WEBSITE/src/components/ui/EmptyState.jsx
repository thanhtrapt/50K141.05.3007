import { SearchX } from 'lucide-react';

export default function EmptyState({ title = 'Không tìm thấy kết quả phù hợp', description }) {
  return (
    <div className="empty-state">
      <span className="empty-state__icon"><SearchX aria-hidden="true" size={26} strokeWidth={1.7} /></span>
      <strong>{title}</strong>
      {description && <p>{description}</p>}
    </div>
  );
}
