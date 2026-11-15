import { endpoint } from './_lib/http.js';
// GET /api/health
export default endpoint({
  path: '/api/health',
  methods: ['GET'],
  auth: false,
  database: false,
  handler: async () => ({ status: 'ok', service: 'huong-spa-backend' }),
});
