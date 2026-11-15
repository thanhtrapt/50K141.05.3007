import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveRoute } from '../../api/[...route].js';

test('catch-all router resolves nested service package params by name', () => {
  const match = resolveRoute('/api/service-packages/PACKAGE-01/sessions/SESSION-02/complete');
  assert.equal(match.handler.route.path, '/api/service-packages/{packageId}/sessions/{sessionId}/complete');
  assert.deepEqual(match.params, { packageId: 'PACKAGE-01', sessionId: 'SESSION-02' });
});

test('catch-all router preserves wildcard upload params as decoded path segments', () => {
  const match = resolveRoute('/api/uploads/folder/image%20one.png');
  assert.equal(match.handler.route.path, '/api/uploads/{...path}');
  assert.deepEqual(match.params, { path: ['folder', 'image one.png'] });
});

test('catch-all router prioritizes static paths over matching dynamic IDs', () => {
  const match = resolveRoute('/api/appointments/cancellations');
  assert.equal(match.handler.route.path, '/api/appointments/cancellations');
});
test('catch-all function keeps the existing /api/health URL and response contract', async () => {
  const response = {
    status: null,
    headers: {},
    body: '',
    writeHead(status, headers) { this.status = status; this.headers = headers; },
    setHeader(name, value) { this.headers[name] = value; },
    end(body) { this.body = body || ''; this.writableEnded = true; },
    get writableEnded() { return this._writableEnded || false; },
    set writableEnded(value) { this._writableEnded = value; },
  };
  await (await import('../../api/[...route].js')).default(
    { url: '/api/health', method: 'GET', headers: {}, query: {} },
    response,
  );
  assert.equal(response.status, 200);
  assert.deepEqual(JSON.parse(response.body).data, { status: 'ok', service: 'huong-spa-backend' });
});
