import { endpoint } from '../_lib/http.js';
import { getServicePackage } from '../_lib/customerService.js';

// GET /api/service-packages/{id}
export default endpoint({
  path: '/api/service-packages/{id}',
  methods: ['GET'],
  params: ['id'],
  handler: ({ params }) => getServicePackage(params.id),
});
