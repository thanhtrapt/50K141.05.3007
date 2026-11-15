/**
 * Toàn bộ lời gọi API dùng đường dẫn tương đối bắt đầu bằng `/api/...` trên
 * cùng domain với giao diện (Vercel Serverless Functions trong thư mục `api/`).
 * Không còn domain backend riêng, không cần biến môi trường URL và không cần CORS.
 */
const NETWORK_ERROR_MESSAGE = 'Có lỗi xảy ra. Vui lòng thử lại.';

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
    window.dispatchEvent(new CustomEvent('huong-spa:toast', { detail: { message: NETWORK_ERROR_MESSAGE } }));
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
    const isServerFailure = response.status >= 500 || !isJson;
    const fallbackMessage = isServerFailure
      ? 'Có lỗi xảy ra. Vui lòng thử lại.'
      : `Yêu cầu không thành công (${response.status}).`;

    const error = new Error(isServerFailure ? fallbackMessage : serverMessage || fallbackMessage);
    error.status = response.status;
    error.isServerError = isServerFailure;
    error.code = isJson ? payload.code : 'HTTP_ERROR';
    error.fieldErrors = isJson && Array.isArray(payload.fieldErrors) ? payload.fieldErrors : [];
    console.error(
      `[api] ${method} ${path} → HTTP ${response.status}`,
      serverMessage || fallbackMessage,
      payload,
    );
    if (isServerFailure) {
      window.dispatchEvent(new CustomEvent('huong-spa:toast', { detail: { message: 'Có lỗi xảy ra. Vui lòng thử lại.' } }));
    }
    throw error;
  }

  // Backend responses wrap endpoint results in { code, message, data }.
  return payload && Object.hasOwn(payload, 'data') && Object.hasOwn(payload, 'code') ? payload.data : payload;
}

export async function apiList(path) {
  const url = new URL(path, window.location.origin);
  const rows = [];
  let page = 1;
  let pageCount = 1;

  do {
    url.searchParams.set('page', String(page));
    url.searchParams.set('limit', '100');
    const result = await apiRequest(`${url.pathname}${url.search}`);
    const pageRows = Array.isArray(result) ? result : result?.data;
    if (!Array.isArray(pageRows)) return [];
    rows.push(...pageRows);
    pageCount = Number(result?.meta?.totalPages) || 1;
    page += 1;
  } while (page <= pageCount);

  return rows;
}
