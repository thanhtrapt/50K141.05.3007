import { endpoint } from '../../_lib/http.js';
import { listAlerts } from '../../_lib/stockService.js';

// GET /api/alerts
export default endpoint({
  path: '/api/alerts',
  methods: ['GET'],
  handler: ({ query }) => listAlerts(query),
});
