import { endpoint } from '../../_lib/http.js';
import { listIssues, createIssue } from '../../_lib/stockService.js';

// GET, POST /api/stock-issues
export default endpoint({
  path: '/api/stock-issues',
  methods: ['GET', 'POST'],
  handler: ({ req, query, body, user }) => (req.method === 'POST' ? createIssue(body, user) : listIssues(query)),
});
