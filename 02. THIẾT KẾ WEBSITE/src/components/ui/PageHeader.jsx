export default function PageHeader({ title, subtitle, actions, compact = false }) {
  return (
    <div className={`page-heading${compact ? ' page-heading--compact' : ''}`}>
      <div className="page-heading__text">
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {actions && <div className="page-heading__actions">{actions}</div>}
    </div>
  );
}
