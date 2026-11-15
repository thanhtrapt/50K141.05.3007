import { endpoint } from '../_lib/http.js';
import { listCustomers, createCustomer } from '../_lib/customerService.js';

// GET, POST /api/customers
export default endpoint({
  path: '/api/customers',
  methods: ['GET', 'POST'],
  handler: ({ req, query, body, user }) => (req.method === 'POST' ? createCustomer(body, user) : listCustomers(query)),
});
