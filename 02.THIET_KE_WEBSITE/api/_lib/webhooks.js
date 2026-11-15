import crypto from 'node:crypto';
import { config } from './config.js';
import { AppError, notFound, unauthorized } from './errors.js';
import { verifyActionToken } from './security.js';
import { markCustomerConfirmed } from './customerService.js';
import { createReview } from './customerService.js';
import { logInboundEvent } from './notificationService.js';

export function verifyN8nWebhook(req) {
  if (!config.n8nWebhookSecret) throw new AppError(503, 'WEBHOOK_NOT_CONFIGURED', 'Webhook n8n chưa được cấu hình.');
  const supplied = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  const expected = Buffer.from(config.n8nWebhookSecret);
  const actual = Buffer.from(supplied);
  if (!supplied || expected.length !== actual.length || !crypto.timingSafeEqual(expected, actual)) {
    throw unauthorized('Webhook không được xác thực.');
  }
}

export async function confirmSessionFromWebhook(req, body) {
  verifyN8nWebhook(req);
  const data = body && typeof body === 'object' ? body : {};
  const token = verifyActionToken(data.confirmationToken, 'session-confirmation');
  if (!token || token.packageId !== String(data.packageId) || token.sessionId !== String(data.sessionId)) {
    throw unauthorized('Liên kết xác nhận không hợp lệ hoặc đã hết hạn.');
  }
  const result = await markCustomerConfirmed(data.packageId, data.sessionId, null);
  await logInboundEvent({
    event: 'SESSION_CONFIRMED',
    recipient: data.phone || null,
    payload: { packageId: data.packageId, sessionId: data.sessionId },
    response: result,
  });
  return result;
}

export async function submitReviewFromWebhook(req, body) {
  verifyN8nWebhook(req);
  const data = body && typeof body === 'object' ? body : {};
  const token = verifyActionToken(data.reviewToken, 'service-review');
  if (!token) throw unauthorized('Liên kết đánh giá không hợp lệ hoặc đã hết hạn.');
  const result = await createReview({ ...data, customerId: token.customerId, servicePackageId: token.packageId }, null);
  await logInboundEvent({
    event: 'REVIEW_SUBMITTED',
    recipient: data.phone || null,
    payload: { customerId: token.customerId, servicePackageId: token.packageId, rating: data.rating },
    response: { reviewId: result.id },
  });
  return result;
}

function requireDevelopment() {
  if (config.nodeEnv !== 'development') throw notFound('Không tìm thấy API phù hợp.');
}

function requireZaloSimulationEnabled() {
  if (!config.enableZaloSimulation) throw notFound('Không tìm thấy API phù hợp.');
}

export async function simulateConfirmedSession(body, user) {
  requireZaloSimulationEnabled();
  const result = await markCustomerConfirmed(String(body.packageId || ''), String(body.sessionId || ''), user);
  return { ...result, simulated: true };
}

export async function simulateSubmittedReview(body, user) {
  requireDevelopment();
  return { ...(await createReview(body, user)), simulated: true };
}
