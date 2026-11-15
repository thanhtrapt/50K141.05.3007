import { endpoint } from '../../_lib/http.js';
import { listCosmetics, createCosmetic } from '../../_lib/stockService.js';

// GET, POST /api/cosmetics — cả STAFF và OWNER đều có toàn quyền quản lý mỹ phẩm.
export default endpoint({
  path: '/api/cosmetics',
  methods: ['GET', 'POST'],
  handler: ({ req, query, body, user }) => (req.method === 'POST' ? createCosmetic(body, user) : listCosmetics(query)),
});
