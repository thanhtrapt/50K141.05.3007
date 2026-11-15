import { endpoint } from '../_lib/http.js';
import { getIssue } from '../_lib/stockService.js';

// GET /api/stock-issues/{id}
export default endpoint({
  path: '/api/stock-issues/{id}',
  methods: ['GET'],
  params: ['id'],
  handler: ({ params }) => getIssue(params.id),
});
