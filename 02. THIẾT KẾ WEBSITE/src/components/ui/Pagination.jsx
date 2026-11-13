import { ChevronLeft, ChevronRight } from 'lucide-react';

export default function Pagination({ page = 1, pageCount = 3, onChange }) {
  return (
    <nav className="pagination" aria-label="Phân trang">
      <button type="button" aria-label="Trang trước" onClick={() => onChange?.(Math.max(1, page - 1))} disabled={page <= 1}>
        <ChevronLeft aria-hidden="true" size={16} />
      </button>
      {Array.from({ length: pageCount }, (_, index) => index + 1).map((pageNumber) => (
        <button
          key={pageNumber}
          className={pageNumber === page ? 'is-current' : ''}
          type="button"
          aria-current={pageNumber === page ? 'page' : undefined}
          onClick={() => onChange?.(pageNumber)}
        >
          {pageNumber}
        </button>
      ))}
      <button type="button" aria-label="Trang sau" onClick={() => onChange?.(Math.min(pageCount, page + 1))} disabled={page >= pageCount}>
        <ChevronRight aria-hidden="true" size={16} />
      </button>
    </nav>
  );
}
