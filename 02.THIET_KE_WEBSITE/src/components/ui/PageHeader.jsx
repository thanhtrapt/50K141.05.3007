import BackButton from './BackButton.jsx';

export default function PageHeader({
  title,
  subtitle,
  actions,
  compact = false,
  back = false,
  fallbackPath,
  onBack,
  backLabel = 'Quay lại',
}) {
  let backElement = null;
  if (back || fallbackPath || onBack) {
    const finalFallback = typeof back === 'string' ? back : fallbackPath;
    const finalOnBack = typeof back === 'function' ? back : onBack;
    backElement = (
      <BackButton
        fallbackPath={finalFallback}
        onBack={finalOnBack}
        label={backLabel}
      />
    );
  }

  const finalActions = actions || backElement ? (
    <div className="page-heading__actions">
      {actions}
      {backElement}
    </div>
  ) : null;

  return (
    <div className={`page-heading${compact ? ' page-heading--compact' : ''}`}>
      <div className="page-heading__text">
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {finalActions}
    </div>
  );
}
