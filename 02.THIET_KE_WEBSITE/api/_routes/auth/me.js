import { endpoint } from '../../_lib/http.js';
// GET /api/auth/me
export default endpoint({
  path: '/api/auth/me',
  methods: ['GET'],
  handler: ({ user }) => ({ user }),
});
