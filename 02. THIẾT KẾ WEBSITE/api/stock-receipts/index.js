import { endpoint } from '../_lib/http.js';
import { listReceipts, createReceipt } from '../_lib/stockService.js';

// GET, POST /api/stock-receipts
export default endpoint({
  path: '/api/stock-receipts',
  methods: ['GET', 'POST'],
  roles: ['OWNER'],
  handler: ({ req, query, body, user }) => (req.method === 'POST' ? createReceipt(body, user) : listReceipts(query)),
});
