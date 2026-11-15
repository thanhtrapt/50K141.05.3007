import { endpoint } from '../_lib/http.js';
import { uploadImage } from '../_lib/uploads.js';

// POST /api/files/images
export default endpoint({
  path: '/api/files/images',
  methods: ['POST'],
  handler: ({ body, user }) => uploadImage(body, user),
});
