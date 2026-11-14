// In development the Vite proxy forwards /api to the local backend, avoiding CORS
// and loopback-address differences between localhost and 127.0.0.1.
const API_BASE = import.meta.env.VITE_API_BASE_URL || '';

export async function apiRequest(path, { method = 'GET', body, auth = true } = {}) {
  const token = window.localStorage.getItem('huong-spa-access-token');
  const response = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...(auth && token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.message || 'Không thể kết nối máy chủ.');
  // Backend responses wrap endpoint results in { code, message, data }.
  return payload && Object.hasOwn(payload, 'data') && Object.hasOwn(payload, 'code') ? payload.data : payload;
}
