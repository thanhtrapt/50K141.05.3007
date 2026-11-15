export default function PageListToolbar({ search, filters, actions, className = '' }) {
  const classNames = ['page-list-toolbar', className].filter(Boolean).join(' ');

  return (
    <div className={classNames}>
      <div className="page-list-toolbar__controls">
        {search}
        {filters}
      </div>
      {actions && <div className="page-list-toolbar__actions">{actions}</div>}
    </div>
  );
}
