import { config } from './config.js';
import { signActionToken } from './security.js';

// Schema thật (Supabase) không có các bảng NhatKyThongBao/TaiLieuTongHop, nên
// hàng đợi thông báo Zalo/n8n tạm thời bị tắt. Các hàm giữ nguyên chữ ký để
// luồng nghiệp vụ (tạo lịch hẹn, hoàn thành buổi, webhook) không phát sinh lỗi.
let timer;

export function createConfirmationUrl(packageId,sessionId) {
  if(!config.n8nPublicBaseUrl)return null;
  const token=signActionToken('session-confirmation',{packageId,sessionId},7*24*60*60);
  return `${config.n8nPublicBaseUrl}/webhook/zalo/session-confirm?token=${encodeURIComponent(token)}&packageId=${encodeURIComponent(packageId)}&sessionId=${encodeURIComponent(sessionId)}`;
}

export function createReviewUrl(packageId,customerId) {
  if(!config.n8nPublicBaseUrl)return null;
  const token=signActionToken('service-review',{packageId,customerId},30*24*60*60);
  return `${config.n8nPublicBaseUrl}/webhook/zalo/review-form?token=${encodeURIComponent(token)}`;
}

export async function enqueueNotification() {
  return { queued: false, disabled: true, reason: 'NhatKyThongBao is not part of the current schema' };
}

export async function logInboundEvent() {
  return null;
}

export async function tick() {
  return;
}

export function startNotificationWorker() {
  if(timer)return;
  // Không có bảng hàng đợi nên không cần tiến trình nền.
  timer=undefined;
}

export function stopNotificationWorker() {
  if(timer)clearInterval(timer);
  timer=undefined;
}
