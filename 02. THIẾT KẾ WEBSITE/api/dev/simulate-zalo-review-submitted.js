import { endpoint } from '../_lib/http.js';
import { simulateSubmittedReview } from '../_lib/webhooks.js';

// POST /api/dev/simulate-zalo-review-submitted
export default endpoint({
  path: '/api/dev/simulate-zalo-review-submitted',
  methods: ['POST'],
  roles: ['OWNER'],
  internal: true,
  handler: ({ body, user }) => simulateSubmittedReview(body, user),
});
