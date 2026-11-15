import { TriangleAlert } from 'lucide-react';
import Modal from './Modal.jsx';
import Button from './Button.jsx';

export default function ConfirmDialog({ open, message, onCancel, onConfirm, confirmLabel = 'Xác nhận', cancelLabel = 'Quay lại', title = 'Xác nhận thao tác', danger = false, busy = false }) {
  return (
    <Modal open={open} title={title} onClose={onCancel} size="small" hideHeader hideClose ariaLabel={title} className="confirm-dialog">
      <div className="confirm-dialog__content">
        <span className="confirm-dialog__icon"><TriangleAlert size={34} strokeWidth={2} aria-hidden="true" /></span>
        <p>{message}</p>
        <div className="confirm-dialog__actions">
          <Button type="button" variant="secondary" onClick={onCancel} disabled={busy}>{cancelLabel}</Button>
          <Button type="button" variant={danger ? 'danger' : 'primary'} onClick={onConfirm} disabled={busy}>{confirmLabel}</Button>
        </div>
      </div>
    </Modal>
  );
}
