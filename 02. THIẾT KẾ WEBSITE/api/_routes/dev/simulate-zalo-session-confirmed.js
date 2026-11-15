import { endpoint } from '../../_lib/http.js';
import { simulateConfirmedSession } from '../../_lib/webhooks.js';

// POST /api/dev/simulate-zalo-session-confirmed
export default endpoint({
  path: '/api/dev/simulate-zalo-session-confirmed',
  methods: ['POST'],
  roles: ['OWNER'],
  internal: true,
  handler: ({ body, user }) => simulateConfirmedSession(body, user),
});
