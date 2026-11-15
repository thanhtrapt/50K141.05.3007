import { useEffect, useMemo, useState } from 'react';
import { FileText } from 'lucide-react';
import Button from '../ui/Button.jsx';
import Modal from '../ui/Modal.jsx';
import {
  DEFAULT_REPORT_CONTENT,
  REPORT_CONTENT_OPTIONS,
  REPORT_SCOPES,
  buildTreatmentReportHtml,
  getRecordedSessions,
  openTreatmentReport,
  resolveReportSessions,
} from '../../utils/treatmentReport.js';

/**
 * Hộp thoại xuất báo cáo liệu trình.
 * - A. Phạm vi: toàn bộ / khoảng buổi / một buổi cụ thể.
 * - B. Nội dung: mặc định chọn tất cả.
 * - C. Hành động: Hủy / XUẤT PDF.
 * Dữ liệu lấy từ chính các buổi đã ghi nhận (dùng chung nguồn với báo cáo Zalo tự động).
 */
export default function TreatmentReportModal({
  open,
  onClose,
  customer,
  usage,
  serviceStatus,
  completedCount,
  remainingCount,
  onResult,
}) {
  const recordedSessions = useMemo(() => getRecordedSessions(usage.sessions), [usage.sessions]);
  const sessionNumbers = useMemo(() => recordedSessions.map((session) => session.number), [recordedSessions]);
  const firstNumber = sessionNumbers[0] ?? '';
  const lastNumber = sessionNumbers[sessionNumbers.length - 1] ?? '';

  const [scope, setScope] = useState('all');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [sessionNumber, setSessionNumber] = useState('');
  const [content, setContent] = useState(DEFAULT_REPORT_CONTENT);

  useEffect(() => {
    if (!open) return;
    setScope('all');
    setFrom(String(firstNumber));
    setTo(String(lastNumber));
    setSessionNumber(String(firstNumber));
    setContent({ ...DEFAULT_REPORT_CONTENT });
  }, [open, firstNumber, lastNumber]);

  const handleExport = () => {
    if (!recordedSessions.length) {
      onResult('Chưa có dữ liệu liệu trình để tạo báo cáo.');
      return;
    }
    if (!content.customerInfo && !content.images && !content.results) {
      onResult('Hãy chọn ít nhất một nội dung cho báo cáo.');
      return;
    }

    const sessions = resolveReportSessions(usage.sessions, { scope, from, to, sessionNumber });
    if (!sessions.length) {
      onResult('Không có buổi nào trong phạm vi đã chọn.');
      return;
    }

    const html = buildTreatmentReportHtml({
      customer,
      usage,
      sessions,
      options: { scope, content },
      serviceStatus,
      completedCount,
      remainingCount,
    });

    if (!openTreatmentReport(html)) {
      onResult('Trình duyệt đã chặn cửa sổ báo cáo. Hãy cho phép cửa sổ bật lên rồi thử lại.');
      return;
    }

    onResult('Báo cáo đã sẵn sàng. Chọn “Lưu dưới dạng PDF” trong hộp thoại in của trình duyệt.');
    onClose();
  };

  const numberOptions = sessionNumbers.map((number) => <option key={number} value={number}>Buổi {number}</option>);

  return (
    <Modal
      open={open}
      title="XUẤT BÁO CÁO LIỆU TRÌNH"
      onClose={onClose}
      size="medium"
      className="treatment-report-modal"
      footer={(
        <>
          <Button variant="secondary" onClick={onClose}>Hủy</Button>
          <Button onClick={handleExport}><FileText size={16} />XUẤT PDF</Button>
        </>
      )}
    >
      <div className="treatment-report">
        <section className="treatment-report__section">
          <h3>A. Phạm vi báo cáo</h3>
          <div className="treatment-report__options">
            {REPORT_SCOPES.map((option) => (
              <label className="treatment-report__option" key={option.value}>
                <input
                  type="radio"
                  name="treatment-report-scope"
                  value={option.value}
                  checked={scope === option.value}
                  onChange={() => setScope(option.value)}
                />
                <span>{option.label}</span>
              </label>
            ))}
          </div>

          {scope === 'range' && (
            <div className="treatment-report__range">
              <label className="treatment-report__range-field">
                <span>Từ buổi</span>
                <select value={from} onChange={(event) => setFrom(event.target.value)}>{numberOptions}</select>
              </label>
              <label className="treatment-report__range-field">
                <span>Đến buổi</span>
                <select value={to} onChange={(event) => setTo(event.target.value)}>{numberOptions}</select>
              </label>
            </div>
          )}

          {scope === 'single' && (
            <div className="treatment-report__range">
              <label className="treatment-report__range-field">
                <span>Buổi cụ thể</span>
                <select value={sessionNumber} onChange={(event) => setSessionNumber(event.target.value)}>{numberOptions}</select>
              </label>
            </div>
          )}
        </section>

        <section className="treatment-report__section">
          <h3>B. Nội dung báo cáo</h3>
          <div className="treatment-report__options">
            {REPORT_CONTENT_OPTIONS.map((option) => (
              <label className="treatment-report__option" key={option.key}>
                <input
                  type="checkbox"
                  checked={content[option.key]}
                  onChange={(event) => setContent((current) => ({ ...current, [option.key]: event.target.checked }))}
                />
                <span>{option.label}</span>
              </label>
            ))}
          </div>
        </section>

        {!recordedSessions.length && (
          <p className="treatment-report__hint">Chưa có buổi nào được ghi nhận để tạo báo cáo.</p>
        )}
      </div>
    </Modal>
  );
}
