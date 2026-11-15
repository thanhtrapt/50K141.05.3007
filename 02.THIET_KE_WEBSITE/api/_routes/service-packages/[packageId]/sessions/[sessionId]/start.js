import { endpoint } from '../../../../../_lib/http.js';
import { startPackageSession } from '../../../../../_lib/customerService.js';

// POST /api/service-packages/{packageId}/sessions/{sessionId}/start
export default endpoint({
  path: '/api/service-packages/{packageId}/sessions/{sessionId}/start',
  methods: ['POST'],
  params: ['packageId', 'sessionId'],
  handler: ({ params, user }) => startPackageSession(params.packageId, params.sessionId, user),
});
