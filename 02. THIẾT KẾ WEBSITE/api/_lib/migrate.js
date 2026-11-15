import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { connectDatabase, getPool, closeDatabase, inTransaction } from './database.js';
import { nowIso } from './utils.js';

// api/_lib -> thư mục gốc của project (nơi chứa migrations/).
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

export async function runMigrations() {
  await connectDatabase();
  await getPool().request().query(`IF OBJECT_ID(N'dbo.LichSuMigration',N'U') IS NULL
    CREATE TABLE dbo.LichSuMigration(tenMigration NVARCHAR(255) NOT NULL PRIMARY KEY,thoiGian DATETIME2(0) NOT NULL DEFAULT(SYSDATETIME()))`);
  const files = (await fs.readdir(path.join(root, 'migrations'))).filter((file) => file.endsWith('.sql')).sort();
  for (const file of files) {
    const exists = await getPool().request().input('name', file).query('SELECT 1 AS found FROM dbo.LichSuMigration WHERE tenMigration=@name');
    if (exists.recordset.length) continue;
    const sqlText = await fs.readFile(path.join(root, 'migrations', file), 'utf8');
    await inTransaction(async (tx) => {
      await tx.request().batch(sqlText);
      await tx.request().input('name', file).input('now', nowIso())
        .query('INSERT INTO dbo.LichSuMigration(tenMigration,thoiGian) VALUES(@name,@now)');
    });
    process.stdout.write(`Đã áp dụng migration ${file}\n`);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  runMigrations().then(closeDatabase).catch(async (error) => {
    console.error('Không thể chạy migration:', error.message);
    await closeDatabase();
    process.exitCode = 1;
  });
}
