import { endpoint } from './_lib/http.js';
import { listRetailCosmetics } from './_lib/customerService.js';

// GET /api/retail-products
export default endpoint({
  path: '/api/retail-products',
  methods: ['GET'],
  handler: ({ query }) => listRetailCosmetics(query),
});
