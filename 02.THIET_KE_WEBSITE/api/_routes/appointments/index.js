import { endpoint } from '../../_lib/http.js';
import { listAppointments, createAppointment } from '../../_lib/appointmentService.js';

// GET, POST /api/appointments
export default endpoint({
  path: '/api/appointments',
  methods: ['GET', 'POST'],
  roles: { POST: ['OWNER'] },
  handler: ({ req, query, body, user }) => (req.method === 'POST' ? createAppointment(body, user) : listAppointments(query)),
});
