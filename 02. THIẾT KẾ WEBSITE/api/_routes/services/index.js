import { endpoint } from '../../_lib/http.js';
import { listServices, createService } from '../../_lib/serviceService.js';

// GET, POST /api/services
export default endpoint({
  path: '/api/services',
  methods: ['GET', 'POST'],
  roles: { POST: ['OWNER'] },
  handler: ({ req, query, body, user }) => (req.method === 'POST' ? createService(body, user) : listServices(query)),
});
