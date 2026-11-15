import { sendJson } from './_lib/http.js';
import route0 from './_routes/alerts/expiry.js';
import route1 from './_routes/alerts/index.js';
import route2 from './_routes/alerts/stock.js';
import route3 from './_routes/appointments/[id]/cancel.js';
import route4 from './_routes/appointments/[id]/index.js';
import route5 from './_routes/appointments/availability.js';
import route6 from './_routes/appointments/cancellations.js';
import route7 from './_routes/appointments/index.js';
import route8 from './_routes/auth/login.js';
import route9 from './_routes/auth/me.js';
import route10 from './_routes/cosmetics/[id]/index.js';
import route11 from './_routes/cosmetics/[id]/lots.js';
import route12 from './_routes/cosmetics/index.js';
import route13 from './_routes/customers/[id]/cancellations.js';
import route14 from './_routes/customers/[id]/index.js';
import route15 from './_routes/customers/[id]/retail-sales.js';
import route16 from './_routes/customers/[id]/service-history.js';
import route17 from './_routes/customers/[id]/service-packages.js';
import route18 from './_routes/customers/index.js';
import route19 from './_routes/dev/simulate-zalo-review-submitted.js';
import route20 from './_routes/dev/simulate-zalo-session-confirmed.js';
import route21 from './_routes/docs.js';
import route22 from './_routes/files/images.js';
import route23 from './_routes/health.js';
import route24 from './_routes/jobs/tick.js';
import route25 from './_routes/lots.js';
import route26 from './_routes/retail-products.js';
import route27 from './_routes/reviews/[id].js';
import route28 from './_routes/reviews/index.js';
import route29 from './_routes/service-packages/[packageId].js';
import route30 from './_routes/service-packages/[packageId]/sessions/[sessionId]/complete.js';
import route31 from './_routes/service-packages/[packageId]/sessions/[sessionId]/start.js';
import route32 from './_routes/services/[id]/index.js';
import route33 from './_routes/services/index.js';
import route34 from './_routes/stock-issues/[id].js';
import route35 from './_routes/stock-issues/index.js';
import route36 from './_routes/stock-receipts/[id].js';
import route37 from './_routes/stock-receipts/index.js';
import route38 from './_routes/system-config/[key].js';
import route39 from './_routes/system-config/index.js';
import route40 from './_routes/uploads/[...path].js';
import route41 from './_routes/webhooks/n8n/review-submitted.js';
import route42 from './_routes/webhooks/n8n/session-confirmed.js';
const routes = [  route0,
  route1,
  route2,
  route3,
  route4,
  route5,
  route6,
  route7,
  route8,
  route9,
  route10,
  route11,
  route12,
  route13,
  route14,
  route15,
  route16,
  route17,
  route18,
  route19,
  route20,
  route21,
  route22,
  route23,
  route24,
  route25,
  route26,
  route27,
  route28,
  route29,
  route30,
  route31,
  route32,
  route33,
  route34,
  route35,
  route36,
  route37,
  route38,
  route39,
  route40,
  route41,
  route42];

function compilePath(path) {
  const params = [];
  const segments = path.split('/').map((segment) => {
    const wildcard = /^\{\.\.\.([A-Za-z][A-Za-z0-9_]*)\}$/.exec(segment);
    if (wildcard) {
      params.push({ name: wildcard[1], wildcard: true });
      return '(.+)';
    }
    const parameter = /^\{([A-Za-z][A-Za-z0-9_]*)\}$/.exec(segment);
    if (parameter) {
      params.push({ name: parameter[1], wildcard: false });
      return '([^/]+)';
    }
    return segment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  });
  return { regex: new RegExp(`^${segments.join('/')}/?$`), params };
}

const routeTable = routes.map((handler) => ({ handler, ...compilePath(handler.route.path) }));
routeTable.sort((a, b) => {
  const aStatic = a.handler.route.path.split('/').length - a.params.length;
  const bStatic = b.handler.route.path.split('/').length - b.params.length;
  return bStatic - aStatic || b.handler.route.path.length - a.handler.route.path.length;
});

export function resolveRoute(pathname) {
  for (const route of routeTable) {
    const match = route.regex.exec(pathname);
    if (!match) continue;
    try {
      const params = Object.fromEntries(route.params.map(({ name, wildcard }, index) => {
        const value = match[index + 1];
        const decoded = wildcard
          ? value.split('/').filter(Boolean).map(decodeURIComponent)
          : decodeURIComponent(value);
        return [name, decoded];
      }));
      return { handler: route.handler, params };
    } catch {
      return { error: 'BAD_REQUEST' };
    }
  }
  return null;
}

export default async function catchAll(req, res) {
  const url = new URL(req.url || '/', 'http://localhost');

  // Vercel chỉ định tuyến được một tầng động cho một Function, nên không thể
  // dùng `api/[...route].js` để bắt các đường dẫn nhiều tầng như
  // `/api/auth/login`. `vercel.json` chuyển mọi `/api/...` về function này và
  // gửi phần đường dẫn gốc trong tham số `__path`.
  const forwarded = req.query && typeof req.query.__path === 'string' ? req.query.__path : '';
  const pathname = forwarded
    ? `/api/${forwarded.replace(/^\/+/, '')}`
    : url.pathname;

  // Bỏ `__path` khỏi query để handler chỉ thấy query thật của người dùng.
  const search = new URLSearchParams(url.searchParams);
  search.delete('__path');
  req.url = `${pathname}${search.toString() ? `?${search.toString()}` : ''}`;

  const matched = resolveRoute(pathname);
  if (matched?.error) {
    return sendJson(res, 400, {
      code: 'BAD_REQUEST',
      message: 'Tham số đường dẫn không hợp lệ.',
      fieldErrors: [],
    });
  }
  if (!matched) {
    return sendJson(res, 404, {
      code: 'NOT_FOUND',
      message: 'Không tìm thấy API phù hợp.',
      fieldErrors: [],
    });
  }

  const platformParams = { ...(req.query && typeof req.query === 'object' ? req.query : {}) };
  delete platformParams.__path;
  req.query = { ...platformParams, ...matched.params };
  return matched.handler(req, res);
}