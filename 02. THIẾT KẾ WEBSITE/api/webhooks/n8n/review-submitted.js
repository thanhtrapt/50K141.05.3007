import { endpoint } from '../../_lib/http.js';
import { submitReviewFromWebhook } from '../../_lib/webhooks.js';

// POST /api/webhooks/n8n/review-submitted
export default endpoint({
  path: '/api/webhooks/n8n/review-submitted',
  methods: ['POST'],
  auth: false,
  handler: ({ req, body }) => submitReviewFromWebhook(req, body),
});
