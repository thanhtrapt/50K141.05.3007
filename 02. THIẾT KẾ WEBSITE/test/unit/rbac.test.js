import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { canAccess, rolesForMethod } from '../../api/_lib/http.js';
import { can, PERMISSIONS } from '../../src/auth/permissions.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

function endpointFiles(dir) {
  const files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('_')) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...endpointFiles(full));
    else if (entry.name.endsWith('.js')) files.push(full);
  }
  return files;
}

const routes = new Map();
for (const file of endpointFiles(path.join(root, 'api'))) {
  const route = (await import(pathToFileURL(file).href)).default?.route;
  assert.ok(route, `${path.relative(root, file)} phải xuất handler tạo bởi endpoint()`);
  routes.set(route.path, route);
}

function routeOf(apiPath) {
  const route = routes.get(apiPath);
  if (route) return route;
  throw new Error(`Không tìm thấy endpoint ${apiPath}`);
}

function staffAllowed(apiPath, method) {
  const route = routeOf(apiPath);
  return canAccess(rolesForMethod(route.roles, method), 'STAFF');
}

function ownerAllowed(apiPath, method) {
  const route = routeOf(apiPath);
  return canAccess(rolesForMethod(route.roles, method), 'OWNER');
}

// STAFF được xem/tạo/sửa/xóa hồ sơ khách hàng, mỹ phẩm, phiếu xuất kho, đánh giá, cảnh báo.
const STAFF_ALLOWED = [
  ['/api/auth/me', 'GET'],
  ['/api/customers', 'GET'], ['/api/customers', 'POST'],
  ['/api/customers/{id}', 'GET'], ['/api/customers/{id}', 'PUT'], ['/api/customers/{id}', 'DELETE'],
  ['/api/customers/{id}/service-history', 'GET'],
  ['/api/customers/{id}/service-packages', 'POST'],
  ['/api/customers/{id}/retail-sales', 'POST'],
  ['/api/customers/{id}/cancellations', 'GET'],
  ['/api/service-packages/{packageId}', 'GET'],
  ['/api/service-packages/{packageId}/sessions/{sessionId}/start', 'POST'],
  ['/api/service-packages/{packageId}/sessions/{sessionId}/complete', 'POST'],
  ['/api/retail-products', 'GET'],
  ['/api/reviews', 'GET'], ['/api/reviews', 'POST'], ['/api/reviews/{id}', 'GET'],
  ['/api/cosmetics', 'GET'], ['/api/cosmetics', 'POST'],
  ['/api/cosmetics/{id}', 'GET'], ['/api/cosmetics/{id}', 'PUT'], ['/api/cosmetics/{id}', 'DELETE'],
  ['/api/cosmetics/{id}/lots', 'GET'], ['/api/lots', 'GET'],
  ['/api/alerts', 'GET'], ['/api/alerts/stock', 'GET'], ['/api/alerts/expiry', 'GET'],
  ['/api/files/images', 'POST'],
  ['/api/stock-issues', 'GET'], ['/api/stock-issues', 'POST'], ['/api/stock-issues/{id}', 'GET'],
  ['/api/appointments', 'GET'], ['/api/appointments/{id}', 'GET'],
  ['/api/appointments/availability', 'GET'], ['/api/appointments/cancellations', 'GET'],
  ['/api/services', 'GET'], ['/api/services/{id}', 'GET'],
];

// STAFF bị cấm: tạo/sửa/hủy lịch hẹn, thêm/sửa/xóa dịch vụ, mọi thao tác phiếu nhập kho,
// cấu hình hệ thống.
const STAFF_FORBIDDEN = [
  ['/api/appointments', 'POST'],
  ['/api/appointments/{id}', 'PUT'],
  ['/api/appointments/{id}/cancel', 'POST'],
  ['/api/services', 'POST'],
  ['/api/services/{id}', 'PUT'], ['/api/services/{id}', 'DELETE'],
  ['/api/stock-receipts', 'GET'], ['/api/stock-receipts', 'POST'],
  ['/api/stock-receipts/{id}', 'GET'],
  ['/api/system-config', 'GET'], ['/api/system-config/{key}', 'PATCH'],
];

test('STAFF có đúng quyền xem/thao tác theo quy định', () => {
  for (const [apiPath, method] of STAFF_ALLOWED) {
    assert.equal(staffAllowed(apiPath, method), true, `STAFF phải được phép ${method} ${apiPath}`);
  }
});

test('STAFF bị chặn ở lịch hẹn, dịch vụ, phiếu nhập kho và cấu hình', () => {
  for (const [apiPath, method] of STAFF_FORBIDDEN) {
    assert.equal(staffAllowed(apiPath, method), false, `STAFF không được phép ${method} ${apiPath}`);
  }
});

test('OWNER kế thừa toàn bộ quyền STAFF và có thêm quyền quản trị', () => {
  for (const [apiPath, method] of [...STAFF_ALLOWED, ...STAFF_FORBIDDEN]) {
    assert.equal(ownerAllowed(apiPath, method), true, `OWNER phải được phép ${method} ${apiPath}`);
  }
  for (const route of routes.values()) {
    for (const method of route.methods) {
      const required = rolesForMethod(route.roles, method);
      if (!required) continue;
      assert.ok(required.includes('OWNER'), `OWNER không được bị chặn ở ${method} ${route.path}`);
      assert.ok(required.every((role) => role === 'OWNER' || role === 'STAFF'), `role lạ ở ${method} ${route.path}`);
    }
  }
});

test('quyền của Frontend khớp với Backend cho cả STAFF và OWNER', () => {
  const expectations = {
    'dashboard:read': [true, true],
    'customers:read': [true, true], 'customers:write': [true, true],
    'reviews:read': [true, true], 'reviews:write': [true, true],
    'appointments:read': [true, true], 'appointments:write': [false, true],
    'services:read': [true, true], 'services:write': [false, true],
    'cosmetics:read': [true, true], 'cosmetics:write': [true, true],
    'alerts:read': [true, true],
    'stock-issues:read': [true, true], 'stock-issues:write': [true, true],
    'stock-receipts:read': [false, true], 'stock-receipts:write': [false, true],
    'system-config:write': [false, true],
  };
  for (const [permission, [staff, owner]] of Object.entries(expectations)) {
    assert.equal(can('STAFF', permission), staff, `STAFF ${permission}`);
    assert.equal(can('OWNER', permission), owner, `OWNER ${permission}`);
  }
  for (const [permission, roles] of Object.entries(PERMISSIONS)) {
    assert.ok(roles.includes('OWNER'), `${permission} phải cho OWNER`);
    assert.deepEqual(roles.filter((role) => !['OWNER', 'STAFF'].includes(role)), [], `${permission} có role lạ`);
  }
  assert.equal(can(null, 'customers:read'), false);
  assert.equal(can('STAFF', 'khong-ton-tai'), false);
});
