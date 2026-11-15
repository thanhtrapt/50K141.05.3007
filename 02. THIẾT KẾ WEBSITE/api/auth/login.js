import { endpoint } from '../_lib/http.js';
import { login } from '../_lib/authService.js';

// POST /api/auth/login
export default endpoint({
  path: '/api/auth/login',
  methods: ['POST'],
  auth: false,
  handler: ({ req, body }) => login(body, req),
});
