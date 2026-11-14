import Button from './Button.jsx';
import EmptyState from './EmptyState.jsx';
import PageHeader from './PageHeader.jsx';

export default function FeatureNotFound({ heading = 'KHÔNG TÌM THẤY', message = 'Không tìm thấy dữ liệu phù hợp!', onBack, backLabel = 'Quay lại danh sách' }) {
  return (
    <div className="page-stack feature-not-found">
      <PageHeader title={heading} />
      <section className="panel feature-not-found__panel">
        <EmptyState title={message} />
        <div className="form-actions"><Button variant="secondary" onClick={onBack}>{backLabel}</Button></div>
      </section>
    </div>
  );
}
