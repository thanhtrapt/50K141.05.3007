import { endpoint } from '../../../_lib/http.js';
import { getCosmetic, updateCosmetic, deleteCosmetic } from '../../../_lib/stockService.js';

// GET, PUT, DELETE /api/cosmetics/{id} — cả STAFF và OWNER đều có toàn quyền.
export default endpoint({
  path: '/api/cosmetics/{id}',
  methods: ['GET', 'PUT', 'DELETE'],
  params: ['id'],
  handler: ({ req, body, params, user }) => {
    if (req.method === 'PUT') return updateCosmetic(params.id, body, user);
    if (req.method === 'DELETE') return deleteCosmetic(params.id, user);
    return getCosmetic(params.id);
  },
});
