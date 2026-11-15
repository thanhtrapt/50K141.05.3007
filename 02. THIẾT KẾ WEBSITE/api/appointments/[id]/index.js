import { endpoint } from '../../_lib/http.js';
import { getAppointment, updateAppointment } from '../../_lib/appointmentService.js';

// GET, PUT /api/appointments/{id}
export default endpoint({
  path: '/api/appointments/{id}',
  methods: ['GET', 'PUT'],
  params: ['id'],
  roles: { PUT: ['OWNER'] },
  handler: ({ req, body, params, user }) => (req.method === 'PUT' ? updateAppointment(params.id, body, user) : getAppointment(params.id)),
});
