import { endpoint } from '../../_lib/http.js';
import { getService, updateService, deleteService } from '../../_lib/serviceService.js';

// GET, PUT, DELETE /api/services/{id}
export default endpoint({
  path: '/api/services/{id}',
  methods: ['GET', 'PUT', 'DELETE'],
  params: ['id'],
  roles: { PUT: ['OWNER'], DELETE: ['OWNER'] },
  handler: ({ req, body, params, user }) => {
    if (req.method === 'PUT') return updateService(params.id, body, user);
    if (req.method === 'DELETE') return deleteService(params.id, user);
    return getService(params.id);
  },
});
