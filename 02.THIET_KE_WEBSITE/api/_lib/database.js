import pg from 'pg';
import { config } from './config.js';
import { createPoolOptions, PgRequest } from './postgres.js';

const { Pool } = pg;
let pool;
let connecting;

class PoolFacade {
  request() { return new PgRequest(pool); }
}
const facade = new PoolFacade();

export async function connectDatabase() {
  if (pool) return facade;
  if (!connecting) {
    connecting = (async () => {
      if (!config.databaseUrl) throw new Error('DATABASE_URL chưa được cấu hình cho Supabase PostgreSQL.');
      const nextPool = new Pool(createPoolOptions());
      nextPool.on('error', (error) => console.error('Lỗi kết nối Supabase PostgreSQL:', error.message));
      await nextPool.query('SELECT 1');
      pool = nextPool;
      return facade;
    })().finally(() => { connecting = undefined; });
  }
  return connecting;
}

export function getPool() {
  if (!pool) throw new Error('Cơ sở dữ liệu Supabase chưa kết nối.');
  return facade;
}

export async function closeDatabase() {
  const current = pool;
  pool = undefined;
  if (current) await current.end();
}

const RETRYABLE_CODES = new Set(['40001', '40P01']);
const MAX_TRANSACTION_ATTEMPTS = 25;
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
// Jitter ngắn giúp các giao dịch đang tranh khóa lệch nhịp, mỗi "lượt" chỉ một
// giao dịch thắng và commit, tránh phải chờ backoff dài.
const backoff = (attempt) => 2 + Math.floor(Math.random() * Math.min(40, 4 * attempt));

export async function inTransaction(work) {
  await connectDatabase();
  // SERIALIZABLE bảo đảm không có hai giao dịch cùng đọc một MAX rồi ghi trùng mã.
  // Khi PostgreSQL phát hiện xung đột (40001) hoặc deadlock (40P01), giao dịch đã
  // được rollback nên có thể chạy lại toàn bộ callback một cách an toàn.
  for (let attempt = 1; ; attempt += 1) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN ISOLATION LEVEL SERIALIZABLE');
      const result = await work({ request: () => new PgRequest(client) });
      await client.query('COMMIT');
      client.release();
      return result;
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {});
      client.release();
      if (attempt < MAX_TRANSACTION_ATTEMPTS && RETRYABLE_CODES.has(error?.code)) {
        await wait(backoff(attempt));
        continue;
      }
      throw error;
    }
  }
}

export function requestFor(transaction) {
  return transaction ? transaction.request() : getPool().request();
}

export const dbTypes = new Proxy({ MAX: -1 }, {
  get(target, key) {
    if (key in target) return target[key];
    return (..._args) => String(key);
  },
});
