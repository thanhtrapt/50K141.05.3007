/**
 * Toàn bộ lời gọi API dùng đường dẫn tương đối bắt đầu bằng `/api/...` trên
 * cùng domain với giao diện (Vercel Serverless Functions trong thư mục `api/`).
 * Không còn domain backend riêng, không cần biến môi trường URL và không cần CORS.
 */
const NETWORK_ERROR_MESSAGE = 'Không thể kết nối máy chủ.';

export async function apiRequest(path, { method = 'GET', body, auth = true } = {}) {
  const token = window.localStorage.getItem('huong-spa-access-token');

  let response;
  try {
    response = await fetch(path, {
      method,
      headers: {
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
        ...(auth && token ? { Authorization: `Bearer ${token}` } : {}),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  } catch (cause) {
    // Chỉ lỗi mạng/kết nối mới hiển thị "Không thể kết nối máy chủ."
    console.error(`[api] Không gửi được yêu cầu ${method} ${path}:`, cause);
    const error = new Error(NETWORK_ERROR_MESSAGE);
    error.code = 'NETWORK_ERROR';
    error.cause = cause;
    throw error;
  }

  const contentType = response.headers.get('content-type') || '';
  let isJson = contentType.includes('application/json');
  let payload = {};
  if (isJson) {
    payload = await response.json().catch(() => {
      isJson = false;
      return {};
    });
  }

  if (!response.ok) {
    // Vercel trả HTML/plain text khi không tìm thấy function (404) hoặc khi
    // function crash (500). Khi đó `payload.message` không có, nên phải tách
    // riêng để không hiển thị nhầm thành lỗi mất kết nối.
    const serverMessage = isJson && typeof payload.message === 'string' ? payload.message : '';
    const fallbackMessage = response.status === 404
      ? `Không tìm thấy API ${path}. Kiểm tra lại cấu hình định tuyến trên Vercel.`
      : `Máy chủ trả về lỗi ${response.status}${response.statusText ? ` ${response.statusText}` : ''}.`;

    const error = new Error(serverMessage || fallbackMessage);
    error.status = response.status;
    error.code = isJson ? payload.code : 'HTTP_ERROR';
    error.fieldErrors = isJson && Array.isArray(payload.fieldErrors) ? payload.fieldErrors : [];
    console.error(
      `[api] ${method} ${path} → HTTP ${response.status}`,
      serverMessage || fallbackMessage,
      payload,
    );
    throw error;
  }

  // Backend responses wrap endpoint results in { code, message, data }.
  return payload && Object.hasOwn(payload, 'data') && Object.hasOwn(payload, 'code') ? payload.data : payload;
}
