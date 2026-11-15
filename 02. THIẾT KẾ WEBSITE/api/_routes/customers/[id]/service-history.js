import { endpoint } from '../../../_lib/http.js';
import { listCustomerServiceHistory } from '../../../_lib/customerService.js';

// GET /api/customers/{id}/service-history
export default endpoint({
  path: '/api/customers/{id}/service-history',
  methods: ['GET'],
  params: ['id'],
  handler: ({ params, query }) => listCustomerServiceHistory(params.id, query),
});
