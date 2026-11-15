import { createRequire } from 'node:module';
import { config } from './config.js';

const require = createRequire(import.meta.url);
let driver;

// `mssql` (driver thuần JS) dùng được trên mọi môi trường, `mssql/msnodesqlv8.js`
// chỉ cần cho Windows Authentication khi phát triển trên máy có SQL Server cục bộ.
function driverModule() {
  if (driver) return driver;
  if (config.sqlAuth === 'windows') {
    try {
      driver = require('mssql/msnodesqlv8.js');
    } catch {
      throw new Error('Không tải được driver msnodesqlv8. Cài dependency này hoặc dùng SQL_AUTH=sql.');
    }
  } else {
    driver = require('mssql');
  }
  return driver;
}

// Proxy để các module khác vẫn dùng `sql.ConnectionPool`, `sqlTypes.NVarChar`...
// mà không nạp driver native ngay khi import (quan trọng trên Vercel/Linux).
export const sql = new Proxy({}, { get: (_target, key) => driverModule()[key] });
export const sqlTypes = sql;

function baseOptions() {
  return {
    server: config.sqlServer,
    driver: 'ODBC Driver 18 for SQL Server',
    ...(config.sqlPort ? { port: config.sqlPort } : {}),
    ...(config.sqlAuth === 'sql' ? { user: config.sqlUser, password: config.sqlPassword } : {}),
    options: {
      encrypt: config.sqlEncrypt,
      trustServerCertificate: config.sqlTrustServerCertificate,
      trustedConnection: config.sqlAuth === 'windows',
      enableArithAbort: true,
    },
    pool: { max: config.sqlPoolMax, min: 0, idleTimeoutMillis: 30000 },
    requestTimeout: 30000,
    connectionTimeout: 15000,
  };
}

let pool;
let connecting;

export async function connectDatabase() {
  if (pool?.connected) return pool;
  if (!connecting) {
    connecting = openPool().finally(() => {
      connecting = undefined;
    });
  }
  return connecting;
}

async function openPool() {
  const mssql = driverModule();
  if (!['windows', 'sql'].includes(config.sqlAuth)) throw new Error('SQL_AUTH phải là windows hoặc sql trong biến môi trường.');
  if (config.sqlAuth === 'sql' && (!config.sqlUser || !config.sqlPassword)) {
    throw new Error('Cần cấu hình SQL_USER và SQL_PASSWORD trong biến môi trường.');
  }
  const adminPool = await new mssql.ConnectionPool({ ...baseOptions(), database: 'master' }).connect();
  try {
    await adminPool.request().input('databaseName', mssql.NVarChar(128), config.sqlDatabase)
      .query(`IF DB_ID(@databaseName) IS NULL
      BEGIN
        DECLARE @createDatabaseSql NVARCHAR(MAX)=N'CREATE DATABASE '+QUOTENAME(@databaseName);
        EXEC sys.sp_executesql @createDatabaseSql;
      END`);
  } finally {
    await adminPool.close();
  }
  pool = await new mssql.ConnectionPool({ ...baseOptions(), database: config.sqlDatabase }).connect();
  return pool;
}

export function getPool() {
  if (!pool?.connected) throw new Error('Cơ sở dữ liệu chưa kết nối.');
  return pool;
}

export async function closeDatabase() {
  if (pool?.connected) await pool.close();
  pool = undefined;
}

export async function inTransaction(work) {
  const mssql = driverModule();
  const transaction = new mssql.Transaction(getPool());
  await transaction.begin(mssql.ISOLATION_LEVEL.SERIALIZABLE);
  try {
    const result = await work(transaction);
    await transaction.commit();
    return result;
  } catch (error) {
    await transaction.rollback().catch(() => {});
    throw error;
  }
}

export function requestFor(transaction) {
  const mssql = driverModule();
  return transaction ? new mssql.Request(transaction) : getPool().request();
}
