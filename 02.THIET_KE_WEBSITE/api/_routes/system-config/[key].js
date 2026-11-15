import { endpoint } from '../../_lib/http.js';
import { updateConfiguration } from '../../_lib/stockService.js';

// PATCH /api/system-config/{key}
export default endpoint({
  path: '/api/system-config/{key}',
  methods: ['PATCH'],
  params: ['key'],
  roles: ['OWNER'],
  handler: ({ body, params, user }) => updateConfiguration(params.key, body.value, user),
});
