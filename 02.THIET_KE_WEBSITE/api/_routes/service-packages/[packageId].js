import { endpoint } from '../../_lib/http.js';
import { getServicePackage, updateServicePackageDetails } from '../../_lib/customerService.js';

// GET /api/service-packages/{packageId}
export default endpoint({
  path: '/api/service-packages/{packageId}',
  methods: ['GET', 'PUT'],
  params: ['packageId'],
  handler: ({ req, body, params, user }) => req.method.toUpperCase() === 'PUT'
    ? updateServicePackageDetails(params.packageId, body, user)
    : getServicePackage(params.packageId),
});
