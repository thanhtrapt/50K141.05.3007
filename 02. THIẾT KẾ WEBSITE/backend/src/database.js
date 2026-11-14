import sql from 'mssql/msnodesqlv8.js';
import { config } from './config.js';

const baseOptions = {
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
  pool: { max: 10, min: 0, idleTimeoutMillis: 30000 },
  requestTimeout: 30000,
  connectionTimeout: 15000,
};

export const sqlTypes = sql;
let pool;

export async function connectDatabase() {
  if (pool?.connected) return pool;
  if (!['windows','sql'].includes(config.sqlAuth)) throw new Error('SQL_AUTH phải là windows hoặc sql trong backend/.env.');
  if (config.sqlAuth === 'sql' && (!config.sqlUser || !config.sqlPassword)) {
    throw new Error('Cần cấu hình SQL_USER và SQL_PASSWORD trong backend/.env.');
  }
  const adminPool = await new sql.ConnectionPool({ ...baseOptions, database: 'master' }).connect();
  try {
    await adminPool.request().input('databaseName', sql.NVarChar(128), config.sqlDatabase)
      .query(`IF DB_ID(@databaseName) IS NULL
      BEGIN
        DECLARE @createDatabaseSql NVARCHAR(MAX)=N'CREATE DATABASE '+QUOTENAME(@databaseName);
        EXEC sys.sp_executesql @createDatabaseSql;
      END`);
  } finally {
    await adminPool.close();
  }
  pool = await new sql.ConnectionPool({ ...baseOptions, database: config.sqlDatabase }).connect();
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
  const transaction = new sql.Transaction(getPool());
  await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
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
  return transaction ? new sql.Request(transaction) : getPool().request();
}
