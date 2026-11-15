import EmptyState from './EmptyState.jsx';

const ALIGNMENTS = new Set(['left', 'center', 'right']);

function alignmentClass(align) {
  return ALIGNMENTS.has(align) ? `data-table__cell--${align}` : undefined;
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
  className = '',
  fitContainer = false,
}) {
  const columnMinWidths = columns.map((column) => column.minWidth ?? Math.max(70, String(column.label ?? '').length * 8 + 32));
  const tableMinWidth = fitContainer ? undefined : Math.max(className.includes('data-table--inventory') ? 720 : 620, Number.parseInt(minWidth, 10) || 0, columnMinWidths.reduce((sum, width) => sum + width, 0));
  return (
    <div className={['table-scroll', className].filter(Boolean).join(' ')} role="region" aria-label={ariaLabel} tabIndex={0}>
      <table className={['data-table', fitContainer ? 'data-table--fit-container' : ''].filter(Boolean).join(' ')} style={tableMinWidth ? { minWidth: tableMinWidth } : undefined}>
        <colgroup>
          {columns.map((column, index) => (
            <col key={column.key} style={{ width: column.width, ...(fitContainer ? {} : { minWidth: columnMinWidths[index] }) }} />
          ))}
        </colgroup>
        <thead>
          <tr>
            {columns.map((column) => (
              <th
                key={column.key}
                scope="col"
                className={[alignmentClass(column.align), column.wrap ? 'data-table__cell--wrap' : '', column.nowrap ? 'data-table__cell--nowrap' : ''].filter(Boolean).join(' ') || undefined}
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
                    className={[alignmentClass(column.align), column.wrap ? 'data-table__cell--wrap' : '', column.nowrap ? 'data-table__cell--nowrap' : '', column.cellClassName].filter(Boolean).join(' ') || undefined}
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
