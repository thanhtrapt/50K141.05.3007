import { endpoint } from '../../_lib/http.js';
import { listCancellations } from '../../_lib/appointmentService.js';

// GET /api/customers/{id}/cancellations
export default endpoint({
  path: '/api/customers/{id}/cancellations',
  methods: ['GET'],
  params: ['id'],
  handler: ({ params, query }) => listCancellations(params.id, query),
});
