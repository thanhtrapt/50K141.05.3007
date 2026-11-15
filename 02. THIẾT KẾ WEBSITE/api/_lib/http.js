import { AppError, badRequest, unauthorized } from './errors.js';
import { authenticate } from './authService.js';
import { ensureDatabase } from './bootstrap.js';

// Vercel giới hạn body của Serverless Function ở 4,5 MB, nên hạ mặc định cho khớp.
const DEFAULT_MAX_BODY_BYTES = process.env.VERCEL ? 4 * 1024 * 1024 : 12 * 1024 * 1024;
export const MAX_BODY_BYTES = Number(process.env.MAX_BODY_BYTES || DEFAULT_MAX_BODY_BYTES);
const BODY_METHODS = ['POST', 'PUT', 'PATCH', 'DELETE'];

export function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
  });
  res.end(body);
}

function parseMultipart(raw, contentTypeHeader) {
  const boundary = /boundary=(?:"([^"]+)"|([^;]+))/i.exec(contentTypeHeader);
  if (!boundary) throw badRequest('Thiếu boundary của biểu mẫu tải tệp.');
  const marker = Buffer.from(`--${boundary[1] || boundary[2]}`);
  const fields = {};
  let cursor = 0;
  while ((cursor = raw.indexOf(marker, cursor)) >= 0) {
    cursor += marker.length;
    if (raw.subarray(cursor, cursor + 2).toString() === '--') break;
    if (raw.subarray(cursor, cursor + 2).toString() === '\r\n') cursor += 2;
    const headerEnd = raw.indexOf(Buffer.from('\r\n\r\n'), cursor);
    if (headerEnd < 0) break;
    const headerText = raw.subarray(cursor, headerEnd).toString('utf8');
    const next = raw.indexOf(marker, headerEnd + 4);
    if (next < 0) break;
    const value = raw.subarray(headerEnd + 4, Math.max(headerEnd + 4, next - 2));
    const name = /name="([^"]+)"/i.exec(headerText)?.[1];
    const filename = /filename="([^"]*)"/i.exec(headerText)?.[1];
    const contentType = /\r\ncontent-type:\s*([^\r\n]+)/i.exec(`\r\n${headerText}`)?.[1]?.trim();
    if (name && filename !== undefined) {
      fields.base64 = value.toString('base64');
      fields.mimeType = contentType || 'application/octet-stream';
      fields.originalName = filename;
    } else if (name) {
      fields[name] = value.toString('utf8');
    }
    cursor = next;
  }
  return fields;
}

export async function readBody(req) {
  const contentTypeHeader = String(req.headers['content-type'] || '');
  const type = contentTypeHeader.split(';')[0].trim().toLowerCase();

  // Runtime của Vercel có thể đã đọc và parse body sẵn (JSON, form-urlencoded).
  // Khi đó request stream đã cạn, nên phải dùng `req.body` trước khi đọc stream.
  const provided = req.body;
  if (provided !== undefined && provided !== null) {
    if (Buffer.isBuffer(provided)) return provided.length ? decodeBody(provided, type, contentTypeHeader) : {};
    if (typeof provided === 'string') return provided ? decodeBody(Buffer.from(provided, 'utf8'), type, contentTypeHeader) : {};
    // Đã là object: JSON/form-urlencoded đã parse, hoặc biểu mẫu đã được xử lý sẵn.
    return provided;
  }

  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) throw new AppError(413, 'PAYLOAD_TOO_LARGE', 'Tệp hoặc nội dung gửi lên vượt quá giới hạn.');
    chunks.push(chunk);
  }
  const raw = Buffer.concat(chunks);
  if (!raw.length) return {};
  return decodeBody(raw, type, contentTypeHeader);
}

function decodeBody(raw, type, contentTypeHeader) {
  if (type === 'application/json') {
    try {
      return JSON.parse(raw.toString('utf8'));
    } catch {
      throw badRequest('Dữ liệu JSON không hợp lệ.');
    }
  }
  if (type === 'application/x-www-form-urlencoded') return Object.fromEntries(new URLSearchParams(raw.toString('utf8')));
  if (type === 'multipart/form-data') return parseMultipart(raw, contentTypeHeader);
  throw new AppError(415, 'UNSUPPORTED_MEDIA_TYPE', 'Content-Type phải là application/json.');
}

/**
 * Quy tắc role theo HTTP method.
 *
 * - `roles: null` → mọi tài khoản đã đăng nhập (STAFF và OWNER) đều được phép.
 * - `roles: ['OWNER']` → chỉ Chủ Spa (quyền quản trị).
 * - `roles: { POST: ['OWNER'], DELETE: ['OWNER'] }` → giới hạn riêng từng method,
 *   method không khai báo thì mọi tài khoản đã đăng nhập đều được phép.
 */
export function rolesForMethod(roles, method) {
  if (!roles) return null;
  if (Array.isArray(roles)) return roles;
  return roles[method] || null;
}

/**
 * OWNER kế thừa toàn bộ quyền của STAFF: nếu một method cho phép STAFF thì OWNER
 * cũng được phép, còn danh sách chỉ có OWNER thì STAFF bị chặn.
 */
export function canAccess(requiredRoles, role) {
  if (!requiredRoles) return true;
  if (!role) return false;
  return requiredRoles.includes(role);
}

/**
 * Tạo Vercel Serverless Function từ một endpoint của Backend.
 *
 * Giữ nguyên hợp đồng phản hồi cũ: `{ code, message, data }`, mã 201 cho POST,
 * 200 cho các phương thức còn lại, lỗi theo `AppError` với `fieldErrors`.
 */
export function endpoint({ path, methods, roles = null, params = [], auth = true, internal = false, database = true, handler }) {
  const allowed = methods.map((method) => method.toUpperCase());

  const routeHandler = async function routeHandler(req, res) {
    const method = String(req.method || 'GET').toUpperCase();
    try {
      if (!allowed.includes(method)) {
        res.setHeader('Allow', allowed.join(', '));
        throw new AppError(405, 'METHOD_NOT_ALLOWED', `Phương thức ${method} không được hỗ trợ cho API này.`);
      }

      if (database) await ensureDatabase();

      let user = null;
      if (auth) user = await authenticate(req);
      const requiredRoles = rolesForMethod(roles, method);
      // Endpoint giới hạn role bắt buộc phải có người dùng hợp lệ, tránh trường hợp
      // một endpoint khai báo `auth: false` nhưng vẫn gắn `roles` mà bị bỏ qua kiểm tra.
      if (requiredRoles && !user) throw unauthorized();
      if (!canAccess(requiredRoles, user?.role)) {
        throw new AppError(403, 'FORBIDDEN', 'Bạn không có quyền thực hiện thao tác này.');
      }

      const url = new URL(req.url || '/', 'http://localhost');
      const query = Object.fromEntries(url.searchParams.entries());
      const platformParams = req.query && typeof req.query === 'object' ? req.query : {};
      const routeParams = Object.fromEntries(params.map((name) => [name, platformParams[name]]));

      const body = BODY_METHODS.includes(method) ? await readBody(req) : {};
      const result = await handler({ req, res, body, params: routeParams, query, user });

      // Handler đã tự ghi phản hồi (tải tệp, HTML...).
      if (res.writableEnded) return;

      sendJson(res, method === 'POST' ? 201 : 200, {
        code: 'OK',
        message: result?.message || 'Thành công',
        data: result,
      });
    } catch (error) {
      if (res.writableEnded) return;
      const known = error instanceof AppError;
      if (!known) console.error(error);
      sendJson(res, known ? error.status : 500, {
        code: known ? error.code : 'INTERNAL_ERROR',
        message: known ? error.message : 'Đã xảy ra lỗi trong quá trình xử lý.',
        fieldErrors: known ? error.fieldErrors : [],
      });
    }
  };

  routeHandler.route = { path, methods: allowed, roles, auth, internal };
  return routeHandler;
}
