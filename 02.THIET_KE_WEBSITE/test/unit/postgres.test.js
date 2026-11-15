import test from 'node:test';
import assert from 'node:assert/strict';
import { toPostgresSql, PgRequest } from '../../api/_lib/postgres.js';

test('translates legacy route queries into PostgreSQL SQL', () => {
  const sql = toPostgresSql('SELECT TOP(1) maTK,tenDangNhap AS userName FROM dbo.TaiKhoan WITH (UPDLOCK,HOLDLOCK) WHERE tenDangNhap=$1');
  assert.equal(sql, 'select matk,tendangnhap as "userName" from public.taikhoan where tendangnhap=$1 LIMIT 1');
  const update = toPostgresSql('UPDATE dbo.KhachHang SET soLanHuyLich=soLanHuyLich+1 OUTPUT inserted.soLanHuyLich AS count WHERE maKhachHang=$1');
  assert.equal(update, 'update public.khachhang set solanhuylich=solanhuylich+1 where makhachhang=$1 RETURNING solanhuylich as "count"');
});

test('PgRequest binds each named parameter once and returns the existing recordset contract', async () => {
  const calls = [];
  const request = new PgRequest({ async query(sql, values) { calls.push({ sql, values }); return { rows: [{ value: 7 }], rowCount: 1 }; } });
  const result = await request.input('value', 7).query('SELECT @value AS value WHERE @value > 0');
  assert.deepEqual(calls, [{ sql: 'select $1 as "value" where $1 > 0', values: [7] }]);
  assert.deepEqual(result.recordset, [{ value: 7 }]);
  assert.deepEqual(result.rowsAffected, [1]);
});
