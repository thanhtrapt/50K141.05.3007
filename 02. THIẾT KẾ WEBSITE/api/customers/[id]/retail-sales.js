import { endpoint } from '../../_lib/http.js';
import { createRetailSale } from '../../_lib/customerService.js';

// POST /api/customers/{id}/retail-sales
export default endpoint({
  path: '/api/customers/{id}/retail-sales',
  methods: ['POST'],
  params: ['id'],
  handler: ({ body, params, user }) => createRetailSale(params.id, body, user),
});
