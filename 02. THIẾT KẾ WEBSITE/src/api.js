/**
 * Toàn bộ lời gọi API dùng đường dẫn tương đối bắt đầu bằng `/api/...` trên
 * cùng domain với giao diện (Vercel Serverless Functions trong thư mục `api/`).
 * Không còn domain backend riêng, không cần biến môi trường URL và không cần CORS.
 */
export async function apiRequest(path, { method = 'GET', body, auth = true } = {}) {
  const token = window.localStorage.getItem('huong-spa-access-token');
  const response = await fetch(path, {
    method,
    headers: {
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...(auth && token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload.message || 'Không thể kết nối máy chủ.');
    error.status = response.status;
    error.code = payload.code;
    error.fieldErrors = payload.fieldErrors ?? [];
    throw error;
  }
  // Backend responses wrap endpoint results in { code, message, data }.
  return payload && Object.hasOwn(payload, 'data') && Object.hasOwn(payload, 'code') ? payload.data : payload;
}
