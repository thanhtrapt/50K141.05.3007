import { endpoint } from './_lib/http.js';

// GET /api/docs - Swagger UI cho tài liệu OpenAPI (tệp tĩnh /openapi.json).
const html = `<!doctype html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Hương Spa API</title><link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css"></head><body><div id="swagger-ui"></div><script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"><\/script><script>SwaggerUIBundle({url:"/openapi.json",dom_id:"#swagger-ui",deepLinking:true,persistAuthorization:true,displayRequestDuration:true})<\/script></body></html>`;

export default endpoint({
  path: '/api/docs',
  methods: ['GET'],
  auth: false,
  internal: true,
  database: false,
  handler: async ({ res }) => {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Content-Length': Buffer.byteLength(html), 'Cache-Control': 'no-store' });
    res.end(html);
    return null;
  },
});
