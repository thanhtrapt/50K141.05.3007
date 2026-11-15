import { endpoint } from '../../_lib/http.js';
import { getAvailability } from '../../_lib/appointmentService.js';

// GET /api/appointments/availability
export default endpoint({
  path: '/api/appointments/availability',
  methods: ['GET'],
  handler: ({ query }) => getAvailability(query),
});
