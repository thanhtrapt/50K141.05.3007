import { endpoint } from '../../../_lib/http.js';
import { cancelAppointment } from '../../../_lib/appointmentService.js';

// POST /api/appointments/{id}/cancel
export default endpoint({
  path: '/api/appointments/{id}/cancel',
  methods: ['POST'],
  params: ['id'],
  roles: ['OWNER'],
  handler: ({ body, params, user }) => cancelAppointment(params.id, body, user),
});
