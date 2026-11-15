import { endpoint } from '../../_lib/http.js';
import { listReviews, createReview } from '../../_lib/customerService.js';

// GET, POST /api/reviews
export default endpoint({
  path: '/api/reviews',
  methods: ['GET', 'POST'],
  handler: ({ req, query, body, user }) => (req.method === 'POST' ? createReview(body, user) : listReviews(query)),
});
