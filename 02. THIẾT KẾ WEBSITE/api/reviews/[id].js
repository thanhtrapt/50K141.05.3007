import { endpoint } from '../_lib/http.js';
import { getReview } from '../_lib/customerService.js';

// GET /api/reviews/{id}
export default endpoint({
  path: '/api/reviews/{id}',
  methods: ['GET'],
  params: ['id'],
  handler: ({ params }) => getReview(params.id),
});
