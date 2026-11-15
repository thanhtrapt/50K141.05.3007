import { endpoint } from '../../_lib/http.js';
import { listAlerts } from '../../_lib/stockService.js';

// GET /api/alerts/stock
export default endpoint({
  path: '/api/alerts/stock',
  methods: ['GET'],
  handler: ({ query }) => listAlerts({ ...query, type: 'LOW_STOCK' }),
});
