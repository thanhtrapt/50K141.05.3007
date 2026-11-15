import { endpoint } from '../../_lib/http.js';
import { confirmSessionFromWebhook } from '../../_lib/webhooks.js';

// POST /api/webhooks/n8n/session-confirmed
export default endpoint({
  path: '/api/webhooks/n8n/session-confirmed',
  methods: ['POST'],
  auth: false,
  handler: ({ req, body }) => confirmSessionFromWebhook(req, body),
});
