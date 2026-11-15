import { formatCurrency } from '../data/mockData.js';

/**
 * Chuẩn dùng chung cho báo cáo liệu trình:
 * - Nguồn dữ liệu duy nhất: các buổi đã ghi nhận của liệu trình (ảnh, kết quả, quy trình, mỹ phẩm).
 * - Dùng cho cả báo cáo xuất thủ công (PDF) và dữ liệu tổng hợp gửi Zalo tự động.
 */

export function dateTimeLabel(date = new Date()) {
  return new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short' }).format(date);
}

export function escapeHtml(value = '') {
  return String(value).replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character]);
}

export function hasRecordedSessionData(session) {
  const hasCompletedVisit = session.status !== 'Chưa thực hiện' && session.date && session.date !== '--';
  return Boolean(
    hasCompletedVisit
    || session.result?.trim()
    || session.notes?.trim()
    || session.employee?.trim()
    || session.beforeImages?.length
    || session.afterImages?.length,
  );
}

export function getRecordedSessions(sessions = []) {
  return [...sessions]
    .sort((first, second) => first.number - second.number)
    .filter(hasRecordedSessionData);
}

export const REPORT_SCOPES = [
  { value: 'all', label: 'Toàn bộ liệu trình' },
  { value: 'range', label: 'Chọn khoảng buổi' },
  { value: 'single', label: 'Chỉ một buổi cụ thể' },
];

export const REPORT_CONTENT_OPTIONS = [
  { key: 'customerInfo', label: 'Thông tin khách hàng và dịch vụ' },
  { key: 'images', label: 'Hình ảnh trước và sau điều trị' },
  { key: 'results', label: 'Kết quả điều trị từng buổi / ghi chú kết quả' },
];

export const DEFAULT_REPORT_CONTENT = { customerInfo: true, images: true, results: true };

export function scopeLabel(scope) {
  return REPORT_SCOPES.find((item) => item.value === scope)?.label ?? 'Toàn bộ liệu trình';
}

/** Lọc các buổi đã ghi nhận theo phạm vi báo cáo đã chọn. */
export function resolveReportSessions(sessions, options = {}) {
  const recorded = getRecordedSessions(sessions);
  const { scope = 'all', from, to, sessionNumber } = options;
  if (scope === 'range') {
    const start = Number(from);
    const end = Number(to);
    if (!Number.isFinite(start) || !Number.isFinite(end)) return recorded;
    const low = Math.min(start, end);
    const high = Math.max(start, end);
    return recorded.filter((session) => session.number >= low && session.number <= high);
  }
  if (scope === 'single') {
    const target = Number(sessionNumber);
    if (!Number.isFinite(target)) return [];
    return recorded.filter((session) => session.number === target);
  }
  return recorded;
}

function renderImages(images, label) {
  if (!images?.length) {
    return `<p class="empty">Chưa ghi nhận hình ảnh ${escapeHtml(label.toLowerCase())}.</p>`;
  }
  return `<div class="photos">${images.map((image) => `<figure><img src="${escapeHtml(image.dataUrl)}" alt="${escapeHtml(image.name || label)}"><figcaption>${escapeHtml(image.name || label)}</figcaption></figure>`).join('')}</div>`;
}

const REPORT_STYLE = `@page{size:A4;margin:16mm}*{box-sizing:border-box}body{margin:0;color:#382d26;font:13px/1.5 Arial,sans-serif}h1{margin:0;color:#684a35;font-size:24px}h2{margin:0;color:#684a35;font-size:18px}h3{margin:18px 0 8px;color:#684a35;font-size:14px}p{margin:0;white-space:pre-wrap}.subtitle{margin:4px 0 18px;color:#76685d}.summary{display:grid;grid-template-columns:1fr 1fr;gap:10px 18px;padding:15px;background:#fff8ef;border:1px solid #e8d7c3;border-radius:8px}.summary div,.meta div{display:grid;gap:2px}.summary b,.meta b{color:#80664f;font-size:11px;font-weight:600}.summary span,.meta span{font-weight:600}.progress{margin:12px 0 0;color:#684a35;font-weight:700}.session,.overview{margin-top:22px;padding-top:18px;border-top:1px solid #e8d7c3;break-inside:auto}.overall{margin-top:18px}.overall h2{margin-bottom:8px}.session-title{display:flex;justify-content:space-between;align-items:center;gap:12px}.session-title span{color:#76685d}.meta{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-top:12px;padding:12px;background:#faf7f3;border-radius:6px}.empty{color:#8a817a;font-style:italic}.result{padding:10px 12px;background:#faf7f3;border-radius:6px}.photos{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px;margin-top:8px}.photos figure{margin:0;break-inside:avoid}.photos img{display:block;width:100%;height:210px;object-fit:contain;background:#f8f4ef;border-radius:5px}.photos figcaption{padding-top:4px;color:#76685d;font-size:10px;overflow-wrap:anywhere}.photo-columns{display:grid;grid-template-columns:1fr 1fr;gap:14px}.photo-columns h3{margin-top:12px}table{width:100%;border-collapse:collapse;font-size:12px}th,td{padding:7px 9px;text-align:left;border:1px solid #e8d7c3}th{background:#fff8ef;color:#684a35}th.col-index,td.col-index{width:12%;text-align:center}th.col-amount,td.col-amount{width:30%;text-align:center}.report-footer{margin-top:24px;padding-top:10px;border-top:1px solid #e8d7c3;color:#76685d;font-size:11px}@media print{.session{break-inside:auto}.session-title,.meta,table tr,.photos figure{break-inside:avoid}img{print-color-adjust:exact}}`;

/**
 * Dựng HTML hoàn chỉnh cho báo cáo liệu trình từ dữ liệu buổi đã ghi nhận.
 * `options.content` điều khiển nội dung; `sessions` là danh sách buổi đã lọc theo phạm vi.
 */
export function buildTreatmentReportHtml({ customer, usage, sessions, options = {}, serviceStatus, completedCount, remainingCount }) {
  const content = { ...DEFAULT_REPORT_CONTENT, ...(options.content ?? {}) };

  const sessionsMarkup = sessions.map((session) => {
    const techniques = session.techniques ?? [];
    const products = session.products ?? [];
    const productRows = products.length
      ? products.map((product, index) => `<tr><td class="col-index">${index + 1}</td><td>${escapeHtml(product.name || '—')}</td><td class="col-amount">${escapeHtml(product.amount || '—')}</td></tr>`).join('')
      : '<tr><td colspan="3" class="empty">Chưa ghi nhận mỹ phẩm sử dụng.</td></tr>';

    const resultsMarkup = content.results
      ? `<h3>Kết quả điều trị</h3><p class="result">${escapeHtml(session.result?.trim() || 'Chưa ghi nhận kết quả điều trị.')}</p>`
        + (session.notes?.trim() ? `<h3>Thông tin ghi nhận khác</h3><p class="result">${escapeHtml(session.notes)}</p>` : '')
      : '';

    const imagesMarkup = content.images
      ? `<div class="photo-columns"><div><h3>Trước điều trị</h3>${renderImages(session.beforeImages, 'trước điều trị')}</div><div><h3>Sau điều trị</h3>${renderImages(session.afterImages, 'sau điều trị')}</div></div>`
      : '';

    return `<section class="session">
      <div class="session-title"><h2>Buổi ${escapeHtml(session.number)}</h2><span>${escapeHtml(session.date || 'Chưa cập nhật ngày')}</span></div>
      <div class="meta"><div><b>Trạng thái</b><span>${escapeHtml(session.status || '—')}</span></div><div><b>Nhân viên</b><span>${escapeHtml(session.employee || 'Chưa ghi nhận')}</span></div><div><b>Thời lượng</b><span>${escapeHtml(session.duration ? `${session.duration} phút` : '—')}</span></div><div><b>Xác nhận khách hàng</b><span>${escapeHtml(session.customerConfirmation || '—')}</span></div></div>
      <h3>Quy trình kỹ thuật</h3>${techniques.length ? `<ol>${techniques.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ol>` : '<p class="empty">Chưa ghi nhận quy trình kỹ thuật.</p>'}
      <h3>Mỹ phẩm sử dụng</h3><table><thead><tr><th class="col-index">STT</th><th>Tên mỹ phẩm</th><th class="col-amount">Định lượng</th></tr></thead><tbody>${productRows}</tbody></table>
      ${resultsMarkup}
      ${imagesMarkup}
    </section>`;
  }).join('');

  const recordedResults = content.results
    ? sessions
      .filter((session) => session.result?.trim())
      .map((session) => `Buổi ${session.number}: ${session.result.trim()}`)
      .join('\n')
    : '';

  const customerMarkup = content.customerInfo
    ? `<section class="summary"><div><b>Khách hàng</b><span>${escapeHtml(customer.name)}</span></div><div><b>Mã khách hàng</b><span>${escapeHtml(customer.id)}</span></div><div><b>Số điện thoại</b><span>${escapeHtml(customer.phone || '—')}</span></div><div><b>Dịch vụ</b><span>${escapeHtml(usage.name)}</span></div><div><b>Giá dịch vụ</b><span>${escapeHtml(formatCurrency(usage.price))}</span></div><div><b>Mã đơn mua</b><span>${escapeHtml(usage.purchaseOrder || '—')}</span></div><div><b>Ngày mua</b><span>${escapeHtml(usage.purchaseDate || 'Chưa cập nhật')}</span></div><div><b>Ngày bắt đầu</b><span>${escapeHtml(usage.startDate || 'Chưa cập nhật')}</span></div><div><b>Kết thúc dự kiến</b><span>${escapeHtml(usage.expectedEndDate || 'Chưa cập nhật')}</span></div><div><b>Trạng thái liệu trình</b><span>${escapeHtml(serviceStatus)}</span></div></section>
      <p class="progress">Tiến độ: ${completedCount}/${usage.totalSessions} buổi đã hoàn thành · Còn ${remainingCount} buổi</p>`
    : '';

  const overallMarkup = content.results
    ? `<section class="overall"><h2>Kết quả tổng hợp</h2><p class="result">${escapeHtml(recordedResults || 'Chưa có kết quả điều trị được ghi nhận.')}</p></section>`
    : '';

  const exportedAt = dateTimeLabel();
  const scopeText = options.scope === 'all' ? scopeLabel(options.scope) : `${scopeLabel(options.scope)} · ${sessions.length} buổi`;

  return `<!doctype html><html lang="vi"><head><meta charset="utf-8"><title>Báo cáo liệu trình - ${escapeHtml(customer.name)}</title><style>${REPORT_STYLE}</style></head><body>
    <header><h1>BÁO CÁO LIỆU TRÌNH</h1><p class="subtitle">Báo cáo tổng hợp dữ liệu đã ghi nhận trong quá trình thực hiện</p></header>
    ${customerMarkup}
    ${overallMarkup}
    ${sessionsMarkup || '<p class="empty" style="margin-top:18px">Chưa có buổi thực hiện nào được ghi nhận.</p>'}
    <footer class="report-footer">Phạm vi: ${escapeHtml(scopeText)} · Ngày xuất báo cáo: ${escapeHtml(exportedAt)}</footer>
    <script>window.addEventListener('load',()=>{const imgs=[...document.images];Promise.all(imgs.map((img)=>img.decode?.().catch(()=>{})??Promise.resolve())).then(()=>setTimeout(()=>window.print(),150))});</script></body></html>`;
}

/** Mở cửa sổ in với HTML báo cáo. Trả về false nếu trình duyệt chặn cửa sổ bật lên. */
export function openTreatmentReport(html) {
  const printWindow = window.open('', '_blank');
  if (!printWindow) return false;
  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
  return true;
}
