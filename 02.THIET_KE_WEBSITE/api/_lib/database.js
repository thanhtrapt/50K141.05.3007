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

export async function inTransaction(work) {
  const currentPool = await connectDatabase();
  const client = await pool.connect();
  await client.query('BEGIN ISOLATION LEVEL SERIALIZABLE');
  try {
    const result = await work({ request: () => new PgRequest(client) });
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
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
