import { endpoint } from './_lib/http.js';
import { listLots } from './_lib/stockService.js';

// GET /api/lots
export default endpoint({
  path: '/api/lots',
  methods: ['GET'],
  handler: ({ query }) => listLots(query),
});
