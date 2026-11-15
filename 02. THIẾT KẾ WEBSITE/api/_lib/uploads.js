import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { config } from './config.js';
import { inTransaction } from './database.js';
import { badRequest, notFound } from './errors.js';
import { insertAudit } from './repositories.js';

const mimeTypes = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.pdf': 'application/pdf' };

export function uploadPublicPath(fileName) {
  return `/api/uploads/${fileName}`;
}

function validImageSignature(buffer, mime) {
  if (mime === 'image/png') return buffer.length > 8 && buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  if (mime === 'image/jpeg') return buffer.length > 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  if (mime === 'image/webp') return buffer.length > 12 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP';
  return false;
}

export async function uploadImage(body, user) {
  const mime = String(body.mimeType || '');
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(mime)) {
    throw badRequest('Định dạng ảnh không được hỗ trợ.', [{ field: 'mimeType', message: 'Chỉ hỗ trợ PNG, JPEG hoặc WEBP' }]);
  }
  const data = String(body.base64 || '').replace(/^data:[^;]+;base64,/, '');
  let buffer;
  try {
    buffer = Buffer.from(data, 'base64');
  } catch {
    throw badRequest('Tệp ảnh không hợp lệ.', [{ field: 'base64', message: 'Dữ liệu ảnh không hợp lệ' }]);
  }
  if (!buffer.length || buffer.length > 8 * 1024 * 1024 || !validImageSignature(buffer, mime)) {
    throw badRequest('Tệp ảnh không hợp lệ.', [{ field: 'base64', message: 'Ảnh rỗng, quá lớn hoặc nội dung không khớp định dạng' }]);
  }
  await fs.mkdir(config.uploadDir, { recursive: true });
  const ext = mime === 'image/jpeg' ? '.jpg' : mime === 'image/webp' ? '.webp' : '.png';
  const filename = `${crypto.randomUUID()}${ext}`;
  await fs.writeFile(path.join(config.uploadDir, filename), buffer, { flag: 'wx' });
  await inTransaction((tx) => insertAudit({
    transaction: tx,
    user,
    action: 'Tải ảnh lên',
    entity: 'TaiNguyenTep',
    entityId: filename,
    before: null,
    after: { mimeType: mime, size: buffer.length, originalName: String(body.originalName || '').slice(0, 255) },
  }));
  return {
    path: uploadPublicPath(filename),
    url: `${config.publicBaseUrl}${uploadPublicPath(filename)}`,
    mimeType: mime,
    size: buffer.length,
  };
}

export async function serveUpload(relativePath, res) {
  const relative = decodeURIComponent(String(relativePath || '').replace(/^\/+/, ''));
  if (!relative) throw notFound('Không tìm thấy tệp.');
  const root = path.resolve(config.uploadDir);
  const full = path.resolve(root, relative);
  if (!full.startsWith(`${root}${path.sep}`)) throw notFound('Không tìm thấy tệp.');
  let file;
  try {
    file = await fs.readFile(full);
  } catch {
    throw notFound('Không tìm thấy tệp.');
  }
  const contentType = mimeTypes[path.extname(full).toLowerCase()] || 'application/octet-stream';
  res.writeHead(200, {
    'Content-Type': contentType,
    'Content-Length': file.length,
    'Cache-Control': 'private, max-age=3600',
  });
  res.end(file);
}
