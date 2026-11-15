import { endpoint } from '../../_lib/http.js';
import { getReceipt } from '../../_lib/stockService.js';

// GET /api/stock-receipts/{id}
export default endpoint({
  path: '/api/stock-receipts/{id}',
  methods: ['GET'],
  params: ['id'],
  roles: ['OWNER'],
  handler: ({ params }) => getReceipt(params.id),
});
