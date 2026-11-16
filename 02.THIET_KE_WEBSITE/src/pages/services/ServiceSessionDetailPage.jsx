import { useState } from 'react';
import ConfirmDialog from '../../components/ui/ConfirmDialog.jsx';
import PageHeader from '../../components/ui/PageHeader.jsx';
import { ActionGroup, DeleteButton, EditButton } from '../../components/ui/ActionButtons.jsx';
import { formatCurrency } from '../../data/mockData.js';

export default function ServiceSessionDetailPage({ service, sessionNumber, canWrite = false, onBack, onEdit, onDelete }) {
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const session = service.sessionDetails?.[sessionNumber - 1];
  const entries = session?.entries ?? [];
  const techniques = [...new Map(entries
    .filter((entry) => entry.technique?.trim())
    .map((entry) => [entry.technique.trim().replace(/\s+/g, ' ').toLocaleLowerCase('vi'), entry.technique.trim()])
  ).values()];

  return (
    <div className="page-stack service-session-detail-page">
      <PageHeader
        title="CHI TIẾT DỊCH VỤ"
        fallbackPath={`/dich-vu/${service.id}`}
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
      <section className="panel service-session-detail__panel">
        <div className="service-detail__section-heading">
          <h2>Chi tiết buổi thực hiện</h2>
          {canWrite && (
            <ActionGroup className="service-detail__actions">
              <EditButton onClick={onEdit} />
              <DeleteButton onClick={() => setDeleteConfirmOpen(true)} />
            </ActionGroup>
          )}
        </div>
        <div className="service-session-detail__title">
          <span className="service-detail__session-number">Buổi {sessionNumber}</span>
          <strong>{session?.name || `Buổi ${sessionNumber}`}</strong>
          {session?.minutes && <span>{session.minutes} phút</span>}
        </div>
        <div className="service-session-detail__columns">
          <section>
            <h3>Kỹ thuật thực hiện</h3>
            {techniques.length ? <ul>{techniques.map((technique) => <li key={technique}>{technique}</li>)}</ul> : <p>Chưa có kỹ thuật thực hiện.</p>}
          </section>
          <section>
            <h3>Mỹ phẩm sử dụng</h3>
            {entries.length
              ? <ul>{entries.map((entry, index) => <li key={`${entry.product}-${index}`}>{entry.product}{entry.amount ? `: ${entry.amount}` : ''}</li>)}</ul>
              : <p>Chưa có mỹ phẩm sử dụng</p>}
          </section>
        </div>
      </section>
      {canWrite && (
        <ConfirmDialog open={deleteConfirmOpen} title="Xóa dịch vụ" message="Bạn có chắc chắn muốn xóa dịch vụ này không?" onCancel={() => setDeleteConfirmOpen(false)} onConfirm={onDelete} confirmLabel="Xóa" cancelLabel="Hủy" danger />
      )}
    </div>
  );
}
