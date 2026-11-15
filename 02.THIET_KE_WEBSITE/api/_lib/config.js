import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dirname = path.dirname(fileURLToPath(import.meta.url));
// api/_lib -> api -> thư mục gốc của project (nơi Vercel chạy build/deploy).
const apiRoot = path.resolve(dirname, '..');
const projectRoot = path.resolve(apiRoot, '..');
const isServerless = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);

function loadEnv(file) {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const index = trimmed.indexOf('=');
    if (index < 1) continue;
    const key = trimmed.slice(0, index).trim();
    const value = trimmed.slice(index + 1).trim().replace(/^(['"])(.*)\1$/, '$2');
    if (!process.env[key]) process.env[key] = value;
  }
}

// Local development reads .env from the project root; on Vercel the variables
// come from Project Settings > Environment Variables.
loadEnv(path.join(projectRoot, '.env'));
loadEnv(path.join(projectRoot, '.env.local'));
loadEnv(path.join(apiRoot, '.env'));

function resolveProjectPath(value, fallback) {
  const chosen = value || fallback;
  return path.isAbsolute(chosen) ? chosen : path.resolve(projectRoot, chosen);
}

function defaultUploadDir() {
  // Vercel chỉ cho phép ghi trong thư mục tạm của function.
  return isServerless ? path.join(os.tmpdir(), 'huong-spa-uploads') : './public/uploads';
}

function defaultPublicBaseUrl(port) {
  const vercelUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL;
  if (vercelUrl) return `https://${vercelUrl}`;
  return `http://localhost:${port}`;
}

const port = Number(process.env.PORT || 4000);
const DEFAULT_JWT_SECRET = 'development-only-change-this-jwt-secret-32chars';

export const config = Object.freeze({
  projectRoot,
  apiRoot,
  isServerless,
  host: process.env.HOST || '127.0.0.1',
  port,
  nodeEnv: process.env.NODE_ENV || 'development',
  jwtSecret: process.env.JWT_SECRET || DEFAULT_JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '8h',
  databaseUrl: process.env.DATABASE_URL || '',
  enableZaloSimulation: /^true$/i.test(process.env.ENABLE_ZALO_SIMULATION || ''),
  uploadDir: resolveProjectPath(process.env.UPLOAD_DIR, defaultUploadDir()),
  publicBaseUrl: (process.env.PUBLIC_BASE_URL || defaultPublicBaseUrl(port)).replace(/\/$/, ''),
  pdfFontPath: resolveProjectPath(process.env.PDF_FONT_PATH, 'C:/Windows/Fonts/arial.ttf'),
  pdfBoldFontPath: resolveProjectPath(process.env.PDF_BOLD_FONT_PATH, 'C:/Windows/Fonts/arialbd.ttf'),
  n8nWebhookBaseUrl: (process.env.N8N_WEBHOOK_BASE_URL || '').replace(/\/$/, ''),
  n8nPublicBaseUrl: (process.env.N8N_PUBLIC_BASE_URL || '').replace(/\/$/, ''),
  n8nWebhookSecret: process.env.N8N_WEBHOOK_SECRET || '',
  n8nMaxRetries: Math.max(1, Number(process.env.N8N_MAX_RETRIES || 5)),
  // Bí mật cho endpoint /api/jobs/tick (thay cho các timer chạy nền của bản chạy Node liên tục).
  jobsSecret: process.env.JOBS_SECRET || process.env.N8N_WEBHOOK_SECRET || '',
});

if (config.nodeEnv === 'production' && config.jwtSecret === DEFAULT_JWT_SECRET) {
  // Không throw ngay khi nạp module: nếu ném ở đây, toàn bộ function (kể cả
  // /api/health) sẽ trả 500 và rất khó chẩn đoán. Việc kiểm tra được thực hiện
  // khi thực sự ký/kiểm tra token.
  console.error('CẢNH BÁO: JWT_SECRET chưa được cấu hình. Hãy đặt biến JWT_SECRET trong Vercel > Settings > Environment Variables.');
}

export function assertJwtSecretConfigured() {
  if (config.nodeEnv === 'production' && config.jwtSecret === DEFAULT_JWT_SECRET) {
    throw new Error('JWT_SECRET phải được thay bằng khóa bí mật riêng trước khi chạy production.');
  }
}
