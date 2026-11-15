import { endpoint } from '../../_lib/http.js';
import { listAlerts } from '../../_lib/stockService.js';

// GET /api/alerts/expiry
export default endpoint({
  path: '/api/alerts/expiry',
  methods: ['GET'],
  handler: ({ query }) => listAlerts({ ...query, type: 'EXPIRY' }),
});
