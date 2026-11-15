import { endpoint } from '../../../../../_lib/http.js';
import { updatePackageSessionResult } from '../../../../../_lib/customerService.js';

// PUT /api/service-packages/{packageId}/sessions/{sessionId}
export default endpoint({
  path: '/api/service-packages/{packageId}/sessions/{sessionId}',
  methods: ['PUT'],
  params: ['packageId', 'sessionId'],
  handler: ({ body, params, user }) => updatePackageSessionResult(params.packageId, params.sessionId, body, user),
});
