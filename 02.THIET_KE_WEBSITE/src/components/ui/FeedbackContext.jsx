import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import Toast from './Toast.jsx';
import FeedbackDialog from './FeedbackDialog.jsx';

const FeedbackContext = createContext(null);

export function FeedbackProvider({ children }) {
  const [toast, setToast] = useState(null);
  const [dialog, setDialog] = useState(null);
  const notify = useCallback((message, tone = 'error') => {
    const id = Date.now() + Math.random();
    setToast({ message, tone, id });
    window.setTimeout(() => setToast((current) => current?.id === id ? null : current), 4500);
  }, []);
  const showDialog = useCallback((details) => setDialog(details), []);
  useEffect(() => {
    const handleToast = (event) => notify(event.detail?.message || 'Có lỗi xảy ra. Vui lòng thử lại.', 'error');
    window.addEventListener('huong-spa:toast', handleToast);
    return () => window.removeEventListener('huong-spa:toast', handleToast);
  }, [notify]);
  const value = useMemo(() => ({ notify, showDialog }), [notify, showDialog]);

  return (
    <FeedbackContext.Provider value={value}>
      {children}
      <Toast key={toast?.id} message={toast?.message} tone={toast?.tone} onClose={() => setToast(null)} />
      <FeedbackDialog
        open={Boolean(dialog)}
        tone={dialog?.tone}
        title={dialog?.title}
        message={dialog?.message}
        onClose={() => setDialog(null)}
        closeLabel={dialog?.closeLabel || 'Đóng'}
        closeVariant={dialog?.closeVariant || 'primary'}
        size={dialog?.size || 'small'}
        wideButton={dialog?.wideButton || false}
      />
    </FeedbackContext.Provider>
  );
}

export function useFeedback() {
  const context = useContext(FeedbackContext);
  if (!context) throw new Error('useFeedback must be used inside FeedbackProvider');
  return context;
}
