import { CircleAlert, CircleCheck, X } from 'lucide-react';

export default function Toast({ message, tone = 'error', onClose }) {
  if (!message) return null;
  const Icon = tone === 'success' ? CircleCheck : CircleAlert;
  return (
    <div className={`app-toast app-toast--${tone}`} role={tone === 'error' ? 'alert' : 'status'}>
      <Icon size={19} aria-hidden="true" />
      <span>{message}</span>
      {onClose && <button type="button" aria-label="Đóng thông báo" onClick={onClose}><X size={16} /></button>}
    </div>
  );
}
