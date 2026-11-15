import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { config } from '../api/_lib/config.js';

/**
 * Server HTTP cục bộ giả lập cách Vercel định tuyến thư mục `api/`:
 * mỗi tệp .js (trừ những tệp bắt đầu bằng `_`) là một endpoint `/api/...`,
 * `[id]` là tham số động và `[...path]` là tham số bắt toàn bộ phần còn lại.
 *
 * Nhờ vậy `npm run dev` chạy được toàn bộ Frontend + API bằng Node thuần,
 * không cần cài Vercel CLI.
 */
const apiDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'api');

const routes = [];
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('_')) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full);
      continue;
    }
    if (!entry.name.endsWith('.js')) continue;

    const relative = path.relative(apiDir, full).replaceAll('\\', '/');
    const segments = relative.replace(/\.js$/, '').split('/').filter((segment) => segment !== 'index');
    const keys = [];
    let dynamicCount = 0;
    const pattern = segments.map((segment) => {
      const catchAll = /^\[\.\.\.(.+)\]$/.exec(segment);
      if (catchAll) {
        keys.push({ name: catchAll[1], catchAll: true });
        dynamicCount += 1;
        return '(.*)';
      }
      const dynamic = /^\[(.+)\]$/.exec(segment);
      if (dynamic) {
        keys.push({ name: dynamic[1], catchAll: false });
        dynamicCount += 1;
        return '([^/]+)';
      }
      return segment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }).join('/');
    routes.push({ regex: new RegExp(`^/api/${pattern}/?$`), keys, full, dynamicCount, pattern });
  }
}

walk(apiDir);
// Đường dẫn tĩnh phải được ưu tiên trước đường dẫn động, giống Vercel.
routes.sort((a, b) => a.dynamicCount - b.dynamicCount || b.pattern.length - a.pattern.length);

for (const route of routes) {
  route.handler = (await import(pathToFileURL(route.full).href)).default;
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', 'http://localhost');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const matched = routes.find((route) => route.regex.test(url.pathname));
  if (!matched) {
    res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ code: 'NOT_FOUND', message: 'Không tìm thấy API phù hợp.', fieldErrors: [] }));
    return;
  }

  const values = matched.regex.exec(url.pathname).slice(1);
  const params = Object.fromEntries(matched.keys.map((key, index) => {
    const value = values[index];
    if (key.catchAll) return [key.name, value ? value.split('/').filter(Boolean).map(decodeURIComponent) : []];
    return [key.name, value ? decodeURIComponent(value) : value];
  }));

  req.query = { ...Object.fromEntries(url.searchParams.entries()), ...params };
  await matched.handler(req, res);
});

const port = config.port;
server.listen(port, config.host, () => {
  process.stdout.write(`Hương Spa API (local) đang chạy tại http://${config.host}:${port}\n`);
});

if (process.env.JOBS_IN_DEV !== 'false') {
  try {
    const { ensureDatabase } = await import('../api/_lib/bootstrap.js');
    await ensureDatabase();
    const { startAppointmentScheduler, startDailyExpiryScheduler } = await import('../api/_lib/appointmentScheduler.js');
    const { startNotificationWorker } = await import('../api/_lib/notificationService.js');
    startAppointmentScheduler();
    startDailyExpiryScheduler();
    startNotificationWorker();
    process.stdout.write('Đã bật tác vụ định kỳ cho môi trường phát triển.\n');
  } catch (error) {
    process.stderr.write(`Không bật được tác vụ định kỳ: ${error.message}\n`);
  }
}

function shutdown() {
  server.close(() => process.exit(0));
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
