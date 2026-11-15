import { endpoint } from '../../_lib/http.js';
import { assignServicePackage } from '../../_lib/customerService.js';

// POST /api/customers/{id}/service-packages
export default endpoint({
  path: '/api/customers/{id}/service-packages',
  methods: ['POST'],
  params: ['id'],
  handler: ({ body, params, user }) => assignServicePackage(params.id, body, user),
});
