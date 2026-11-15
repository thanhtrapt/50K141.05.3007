import test from 'node:test';
import assert from 'node:assert/strict';
import { config } from '../../api/_lib/config.js';
import { closeDatabase, connectDatabase, getPool } from '../../api/_lib/database.js';

test('connects to the existing Supabase database without modifying schema or data', {
  skip: !config.databaseUrl ? 'Set DATABASE_URL locally to enable the read-only Supabase connection check.' : false,
}, async () => {
  try {
    await connectDatabase();
    const result = await getPool().request().query('SELECT current_database() AS databaseName, current_schema() AS schemaName');
    assert.ok(result.recordset[0]?.databaseName);
    assert.ok(result.recordset[0]?.schemaName);
  } finally {
    await closeDatabase();
  }
});
