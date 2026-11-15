import { endpoint } from '../_lib/http.js';
import { getServicePackage } from '../_lib/customerService.js';

// GET /api/service-packages/{packageId}
export default endpoint({
  path: '/api/service-packages/{packageId}',
  methods: ['GET'],
  params: ['packageId'],
  handler: ({ params }) => getServicePackage(params.packageId),
});
