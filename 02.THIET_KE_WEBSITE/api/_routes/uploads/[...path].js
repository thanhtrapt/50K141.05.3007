import { endpoint } from '../../_lib/http.js';
import { serveUpload } from '../../_lib/uploads.js';

// GET /api/uploads/{...path}
export default endpoint({
  path: '/api/uploads/{...path}',
  methods: ['GET'],
  params: ['path'],
  auth: false,
  internal: true,
  database: false,
  handler: async ({ params, res }) => {
    const segments = Array.isArray(params.path) ? params.path : String(params.path || '').split('/').filter(Boolean);
    await serveUpload(segments.join('/'), res);
  },
});
