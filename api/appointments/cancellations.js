import { endpoint } from '../_lib/http.js';
import { listCancellations } from '../_lib/appointmentService.js';

// GET /api/appointments/cancellations
export default endpoint({
  path: '/api/appointments/cancellations',
  methods: ['GET'],
  handler: ({ query }) => listCancellations(null, query),
});
