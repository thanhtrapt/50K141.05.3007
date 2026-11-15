import crypto from 'node:crypto';
import { config } from './config.js';
import { AppError, unauthorized } from './errors.js';
import { markDueReminders, dailyExpiryScan } from './appointmentScheduler.js';
import { tick as dispatchNotifications } from './notificationService.js';

/**
 * Trên Vercel không có tiến trình chạy nền, nên các tác vụ định kỳ (nhắc lịch,
 * quét hạn sử dụng, gửi thông báo n8n) được gom vào một endpoint để một bộ hẹn
 * giờ bên ngoài gọi (n8n Schedule, GitHub Actions, cron-job.org...).
 */
export function verifyJobsSecret(req) {
  if (!config.jobsSecret) {
    throw new AppError(503, 'JOBS_NOT_CONFIGURED', 'Chưa cấu hình JOBS_SECRET cho tác vụ định kỳ.');
  }
  const supplied = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '') || String(req.headers['x-jobs-secret'] || '');
  const expected = Buffer.from(config.jobsSecret);
  const actual = Buffer.from(supplied);
  if (!supplied || expected.length !== actual.length || !crypto.timingSafeEqual(expected, actual)) {
    throw unauthorized('Tác vụ định kỳ không được xác thực.');
  }
}

export async function runJobs() {
  let expiryAlerts = null;
  await markDueReminders();
  try {
    expiryAlerts = await dailyExpiryScan();
  } finally {
    await dispatchNotifications();
  }
  return { ranAt: new Date().toISOString(), expiryAlerts };
}
