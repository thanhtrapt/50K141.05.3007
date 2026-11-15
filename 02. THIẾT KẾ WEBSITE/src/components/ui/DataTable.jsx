import EmptyState from './EmptyState.jsx';

const ALIGNMENTS = new Set(['left', 'center', 'right']);

function alignmentClass(align) {
  return ALIGNMENTS.has(align) && align !== 'left' ? `data-table__cell--${align}` : undefined;
}

/**
 * Bảng dữ liệu chuẩn dùng chung.
 * - `columns[].align`: 'left' | 'center' | 'right' (mặc định 'left'), áp dụng cho cả ô tiêu đề và ô dữ liệu.
 * - `columns[].width`: bề rộng cột theo tỉ lệ (ví dụ '18%').
 * - `columns[].cellClassName`: lớp CSS bổ sung cho ô dữ liệu (ví dụ ô ảnh).
 * - `minWidth`: bề rộng tối thiểu của bảng trước khi xuất hiện cuộn ngang.
 */
export default function DataTable({
  columns = [],
  rows = [],
  rowKey = 'id',
  emptyMessage = 'Không có dữ liệu phù hợp.',
  minWidth,
  ariaLabel = 'Bảng dữ liệu',
}) {
  return (
    <div className="table-scroll" role="region" aria-label={ariaLabel} tabIndex={0}>
      <table className="data-table" style={minWidth ? { minWidth } : undefined}>
        <thead>
          <tr>
            {columns.map((column) => (
              <th
                key={column.key}
                scope="col"
                className={alignmentClass(column.align)}
                style={column.width ? { width: column.width } : undefined}
              >
                <span className="data-table__heading" title={column.label}>{column.label}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length ? rows.map((row, index) => (
            <tr key={row[rowKey] ?? index}>
              {columns.map((column) => {
                const value = column.render ? column.render(row, index) : row[column.key];
                const title = typeof value === 'string' || typeof value === 'number' ? String(value) : undefined;

                return (
                  <td
                    key={column.key}
                    className={[alignmentClass(column.align), column.cellClassName].filter(Boolean).join(' ') || undefined}
                    title={title}
                  >
                    {value}
                  </td>
                );
              })}
            </tr>
          )) : (
            <tr>
              <td className="data-table__empty" colSpan={Math.max(columns.length, 1)}><EmptyState title={emptyMessage} /></td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
