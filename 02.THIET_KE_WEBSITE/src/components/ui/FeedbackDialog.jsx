import { Check, SearchX, TriangleAlert } from 'lucide-react';
import Modal from './Modal.jsx';
import Button from './Button.jsx';

export default function FeedbackDialog({ open, tone = 'warning', title, message, onClose, closeLabel = 'Đóng', closeVariant = 'primary', children, actions = [], layer = 1, size = 'small', wideButton = false }) {
  const Icon = tone === 'success' ? Check : tone === 'empty' ? SearchX : TriangleAlert;
  return (
    <Modal open={open} title={title} onClose={onClose} size={size} layer={layer} hideHeader hideClose ariaLabel={title || message} className={`feedback-dialog feedback-dialog--${tone}${wideButton ? ' feedback-dialog--wide-button' : ''}`}>
      <div className="feedback-dialog__content">
        <span className="feedback-dialog__icon"><Icon size={34} strokeWidth={2} aria-hidden="true" /></span>
        {title && <h2>{title}</h2>}
        {message && <p>{message}</p>}
        {children}
        {actions.length ? <div className="feedback-dialog__actions">{actions.map((action, index) => <Button key={index} variant={action.variant || 'primary'} onClick={action.onClick}>{action.label}</Button>)}</div> : onClose && <Button variant={closeVariant} onClick={onClose}>{closeLabel}</Button>}
      </div>
    </Modal>
  );
}
