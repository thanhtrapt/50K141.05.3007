import { endpoint } from '../../../_lib/http.js';
import { listLots } from '../../../_lib/stockService.js';

// GET /api/cosmetics/{id}/lots
export default endpoint({
  path: '/api/cosmetics/{id}/lots',
  methods: ['GET'],
  params: ['id'],
  handler: ({ params, query }) => listLots({ ...query, cosmeticId: params.id }),
});
