import { endpoint } from '../../_lib/http.js';
import { getCustomer, updateCustomer, deleteCustomer } from '../../_lib/customerService.js';

// GET, PUT, DELETE /api/customers/{id}
export default endpoint({
  path: '/api/customers/{id}',
  methods: ['GET', 'PUT', 'DELETE'],
  params: ['id'],
  handler: ({ req, body, params, user }) => {
    if (req.method === 'PUT') return updateCustomer(params.id, body, user);
    if (req.method === 'DELETE') return deleteCustomer(params.id, user);
    return getCustomer(params.id);
  },
});
