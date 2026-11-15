import { useMemo, useState } from 'react';
import ConfirmDialog from '../../components/ui/ConfirmDialog.jsx';
import PageHeader from '../../components/ui/PageHeader.jsx';
import { ActionGroup, DeleteButton, EditButton } from '../../components/ui/ActionButtons.jsx';
import { formatCurrency } from '../../data/mockData.js';

export default function ServiceDetailPage({ service, canWrite = false, onBack, onEdit, onDelete, onSessionDetail }) {
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const sessions = useMemo(() => {
    if (service.sessionDetails?.length) return service.sessionDetails;
    return Array.from({ length: Number(service.sessions) || 0 }, () => null);
  }, [service]);

  return (
    <div className="page-stack service-detail-page">
      <PageHeader
        title="CHI TIẾT DỊCH VỤ"
        fallbackPath="/dich-vu"
        onBack={onBack}
      />

      <section className="panel service-detail__general">
        <h2>Thông tin chung</h2>
        <dl className="service-detail__facts">
          <div><dt>Mã dịch vụ</dt><dd>{service.id}</dd></div>
          <div><dt>Tên dịch vụ</dt><dd>{service.name}</dd></div>
          <div><dt>Giá dịch vụ</dt><dd>{formatCurrency(service.price)}</dd></div>
          <div><dt>Số buổi thực hiện</dt><dd>{service.sessions}</dd></div>
        </dl>
      </section>

      <section className="panel service-detail__sessions">
        <div className="service-detail__section-heading">
          <h2>Buổi thực hiện</h2>
          {canWrite && (
            <ActionGroup className="service-detail__actions">
              <EditButton onClick={onEdit} />
              <DeleteButton onClick={() => setDeleteConfirmOpen(true)} />
            </ActionGroup>
          )}
        </div>
        {sessions.length ? (
          <div className="service-detail__session-grid">
            {sessions.map((session, index) => {
              const displayName = `Buổi ${index + 1}`;
              const hasMinutes = Boolean(session?.minutes && session.minutes !== '—');
              return (
                <button
                  type="button"
                  className="service-detail__session-card"
                  key={`session-${index}`}
                  onClick={() => onSessionDetail(index + 1)}
                  aria-label={`Xem chi tiết ${displayName}`}
                >
                  <strong className="service-detail__session-name">{displayName}</strong>
                  {hasMinutes && (
                    <span className="service-detail__session-duration">{session.minutes} phút</span>
                  )}
                </button>
              );
            })}
          </div>
        ) : (
          <p className="muted-copy">Chưa có thông tin buổi thực hiện.</p>
        )}
      </section>

      <section className="panel service-detail__result">
        <h2>Kết quả dịch vụ</h2>
        <p>{service.result || 'Chưa có kết quả dịch vụ.'}</p>
      </section>

      {canWrite && (
        <ConfirmDialog open={deleteConfirmOpen} title="Xóa dịch vụ" message="Bạn có chắc chắn muốn xóa dịch vụ này không?" onCancel={() => setDeleteConfirmOpen(false)} onConfirm={onDelete} confirmLabel="Xóa" cancelLabel="Hủy" danger />
      )}
    </div>
  );
}
