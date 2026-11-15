import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Chạy song song Vite (Frontend) và API cục bộ (`scripts/dev-api.js`).
 * Vite proxy `/api` sang API nên Frontend luôn gọi đường dẫn tương đối `/api/...`
 * đúng như khi chạy trên Vercel.
 */
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const viteBin = path.join(root, 'node_modules', 'vite', 'bin', 'vite.js');

if (!fs.existsSync(viteBin)) {
  process.stderr.write('Chưa cài dependency. Hãy chạy `npm install` trước.\n');
  process.exit(1);
}

const children = [
  spawn(process.execPath, [path.join(root, 'scripts', 'dev-api.js')], { cwd: root, stdio: 'inherit', env: process.env }),
  spawn(process.execPath, [viteBin], { cwd: root, stdio: 'inherit', env: process.env }),
];

let exiting = false;
function shutdown(code = 0) {
  if (exiting) return;
  exiting = true;
  for (const child of children) if (child.exitCode === null) child.kill('SIGTERM');
  process.exit(code);
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));
for (const child of children) child.on('exit', (code) => shutdown(code ?? 0));
