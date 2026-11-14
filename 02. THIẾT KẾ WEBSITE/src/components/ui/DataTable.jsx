import EmptyState from './EmptyState.jsx';

export default function DataTable({ columns = [], rows = [], rowKey = 'id', emptyMessage = 'Không có dữ liệu phù hợp.' }) {
  return (
    <div className="table-scroll" role="region" aria-label="Bảng dữ liệu" tabIndex={0}>
      <table className="data-table">
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.key} scope="col" style={column.width ? { width: column.width } : undefined}>
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

                return <td key={column.key} title={title}>{value}</td>;
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
