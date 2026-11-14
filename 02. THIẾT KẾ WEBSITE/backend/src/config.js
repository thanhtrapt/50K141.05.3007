import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const dirname = path.dirname(fileURLToPath(import.meta.url));
const backendRoot = path.resolve(dirname, '..');
const rootEnv = path.resolve(backendRoot, '..', '.env');
const localEnv = path.join(backendRoot, '.env');

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

loadEnv(rootEnv);
loadEnv(localEnv);

function resolveBackendPath(value, fallback) {
  const chosen = value || fallback;
  return path.isAbsolute(chosen) ? chosen : path.resolve(backendRoot, chosen);
}

export const config = Object.freeze({
  backendRoot,
  host: process.env.HOST || '127.0.0.1',
  port: Number(process.env.PORT || 4000),
  nodeEnv: process.env.NODE_ENV || 'development',
  jwtSecret: process.env.JWT_SECRET || 'development-only-change-this-jwt-secret-32chars',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '8h',
  sqlServer: process.env.SQL_SERVER || 'localhost',
  sqlPort: process.env.SQL_PORT ? Number(process.env.SQL_PORT) : undefined,
  sqlAuth: (process.env.SQL_AUTH || 'sql').toLowerCase(),
  sqlDatabase: process.env.SQL_DATABASE || 'HuongSpaDB',
  sqlUser: process.env.SQL_USER || '',
  sqlPassword: process.env.SQL_PASSWORD || '',
  sqlEncrypt: process.env.SQL_ENCRYPT === 'true',
  sqlTrustServerCertificate: process.env.SQL_TRUST_SERVER_CERT !== 'false',
  uploadDir: resolveBackendPath(process.env.UPLOAD_DIR, './public/uploads'),
  publicBaseUrl: (process.env.PUBLIC_BASE_URL || `http://localhost:${process.env.PORT || 4000}`).replace(/\/$/, ''),
  pdfFontPath: resolveBackendPath(process.env.PDF_FONT_PATH, 'C:/Windows/Fonts/arial.ttf'),
  pdfBoldFontPath: resolveBackendPath(process.env.PDF_BOLD_FONT_PATH, 'C:/Windows/Fonts/arialbd.ttf'),
  n8nWebhookBaseUrl: (process.env.N8N_WEBHOOK_BASE_URL || '').replace(/\/$/, ''),
  n8nPublicBaseUrl: (process.env.N8N_PUBLIC_BASE_URL || '').replace(/\/$/, ''),
  n8nWebhookSecret: process.env.N8N_WEBHOOK_SECRET || '',
  n8nMaxRetries: Math.max(1,Number(process.env.N8N_MAX_RETRIES||5)),
  corsOrigins: (process.env.CORS_ORIGINS || 'http://localhost:5173,http://127.0.0.1:5173')
    .split(',').map((value) => value.trim()).filter(Boolean),
});

if (config.nodeEnv === 'production' && config.jwtSecret.startsWith('development-only')) {
  throw new Error('JWT_SECRET phải được thay bằng khóa bí mật riêng trước khi chạy production.');
}
