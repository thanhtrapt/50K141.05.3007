import { endpoint } from '../../../../_lib/http.js';
import { completePackageSession } from '../../../../_lib/customerService.js';

// POST /api/service-packages/{packageId}/sessions/{sessionId}/complete
export default endpoint({
  path: '/api/service-packages/{packageId}/sessions/{sessionId}/complete',
  methods: ['POST'],
  params: ['packageId', 'sessionId'],
  handler: ({ body, params, user }) => completePackageSession(params.packageId, params.sessionId, body, user),
});
