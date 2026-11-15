# Hương Spa API

Backend chạy dưới dạng Vercel Serverless Functions trong thư mục `api/`. Mỗi tệp là một endpoint; `api/_lib/` chứa mã dùng chung và không được định tuyến.

- Xác thực: `Authorization: Bearer <JWT>` (HS256, cấp từ `POST /api/auth/login`).
- Quyền: `OWNER` (Chủ Spa) và `STAFF` (Nhân viên).
- Phản hồi thành công: `{ "code": "OK", "message": "…", "data": … }`, HTTP 201 cho `POST`, 200 cho các phương thức khác.
- Phản hồi lỗi: `{ "code": "…", "message": "…", "fieldErrors": [] }`.
- Đường dẫn tĩnh được ưu tiên hơn đường dẫn động (`/api/appointments/availability` trước `/api/appointments/:id`).

## Quy tắc phân quyền

- `OWNER` (Chủ Spa) kế thừa toàn bộ quyền của `STAFF` (Nhân viên) và có thêm quyền quản trị.
- `STAFF` có toàn quyền hồ sơ khách hàng, mỹ phẩm, phiếu xuất kho, đánh giá và cảnh báo; chỉ được `GET` lịch hẹn và dịch vụ; **không** truy cập `/api/stock-receipts*` hay `/api/system-config*`.
- Backend kiểm tra role theo từng HTTP method trong `endpoint({ roles })`. Sai quyền trả `403 FORBIDDEN`; thiếu/sai token trả `401 UNAUTHORIZED`.
- Trong bảng dưới, ô `OWNER, STAFF / OWNER` nghĩa là method đầu cho cả hai role, method sau chỉ `OWNER`; ô `OWNER, STAFF` cho cả hai role với mọi method.

## Danh sách endpoint

| Method | Endpoint | Quyền | Tệp |
|---|---|---|---|
| GET | `/api/health` | Công khai | `api/health.js` |
| POST | `/api/auth/login` | Công khai | `api/auth/login.js` |
| GET | `/api/auth/me` | OWNER, STAFF | `api/auth/me.js` |
| GET, POST | `/api/services` | OWNER, STAFF / OWNER | `api/services/index.js` |
| GET, PUT, DELETE | `/api/services/:id` | OWNER, STAFF / OWNER | `api/services/[id]/index.js` |
| GET, POST | `/api/customers` | OWNER, STAFF | `api/customers/index.js` |
| GET, PUT, DELETE | `/api/customers/:id` | OWNER, STAFF | `api/customers/[id]/index.js` |
| GET | `/api/customers/:id/service-history` | OWNER, STAFF | `api/customers/[id]/service-history.js` |
| POST | `/api/customers/:id/service-packages` | OWNER, STAFF | `api/customers/[id]/service-packages.js` |
| POST | `/api/customers/:id/retail-sales` | OWNER, STAFF | `api/customers/[id]/retail-sales.js` |
| GET | `/api/customers/:id/cancellations` | OWNER, STAFF | `api/customers/[id]/cancellations.js` |
| GET | `/api/service-packages/:id` | OWNER, STAFF | `api/service-packages/[id].js` |
| POST | `/api/service-packages/:packageId/sessions/:sessionId/start` | OWNER, STAFF | `api/service-packages/[packageId]/sessions/[sessionId]/start.js` |
| POST | `/api/service-packages/:packageId/sessions/:sessionId/complete` | OWNER, STAFF | `…/complete.js` |
| GET | `/api/retail-products` | OWNER, STAFF | `api/retail-products.js` |
| GET, POST | `/api/reviews` | OWNER, STAFF | `api/reviews/index.js` |
| GET | `/api/reviews/:id` | OWNER, STAFF | `api/reviews/[id].js` |
| GET | `/api/appointments/availability` | OWNER, STAFF | `api/appointments/availability.js` |
| GET, POST | `/api/appointments` | OWNER, STAFF / OWNER | `api/appointments/index.js` |
| GET, PUT | `/api/appointments/:id` | OWNER, STAFF / OWNER | `api/appointments/[id]/index.js` |
| POST | `/api/appointments/:id/cancel` | OWNER | `api/appointments/[id]/cancel.js` |
| GET | `/api/appointments/cancellations` | OWNER, STAFF | `api/appointments/cancellations.js` |
| GET, POST | `/api/cosmetics` | OWNER, STAFF | `api/cosmetics/index.js` |
| GET, PUT, DELETE | `/api/cosmetics/:id` | OWNER, STAFF | `api/cosmetics/[id]/index.js` |
| GET | `/api/cosmetics/:id/lots` | OWNER, STAFF | `api/cosmetics/[id]/lots.js` |
| GET | `/api/lots` | OWNER, STAFF | `api/lots.js` |
| POST | `/api/files/images` | OWNER, STAFF | `api/files/images.js` |
| GET | `/api/alerts`, `/api/alerts/stock`, `/api/alerts/expiry` | OWNER, STAFF | `api/alerts/*.js` |
| GET, PATCH | `/api/system-config`, `/api/system-config/:key` | OWNER | `api/system-config/*.js` |
| GET, POST | `/api/stock-receipts` | OWNER | `api/stock-receipts/index.js` |
| GET | `/api/stock-receipts/:id` | OWNER | `api/stock-receipts/[id].js` |
| GET, POST | `/api/stock-issues` | OWNER, STAFF | `api/stock-issues/index.js` |
| GET | `/api/stock-issues/:id` | OWNER, STAFF | `api/stock-issues/[id].js` |
| POST | `/api/webhooks/n8n/session-confirmed` | Bearer secret + action token | `api/webhooks/n8n/session-confirmed.js` |
| POST | `/api/webhooks/n8n/review-submitted` | Bearer secret + action token | `api/webhooks/n8n/review-submitted.js` |

Endpoint hạ tầng (không nằm trong OpenAPI):

| Method | Endpoint | Bảo vệ | Mục đích |
|---|---|---|---|
| GET | `/api/docs` | Công khai | Swagger UI đọc `/openapi.json` |
| GET | `/api/uploads/[...path]` | Công khai | Phục vụ ảnh/PDF do API tạo ra |
| GET, POST | `/api/jobs/tick` | `Authorization: Bearer $JOBS_SECRET` | Chạy một vòng nhắc lịch, quét hạn dùng, gửi thông báo n8n |
| POST | `/api/dev/simulate-zalo-*` | OWNER, chỉ `NODE_ENV=development` | Giả lập webhook n8n |

## Quy ước tham số

- Danh sách nhận `page`, `limit`, `keyword`; từ khóa so sánh không phân biệt dấu tiếng Việt.
- Dịch vụ: `name`, `price`, `totalSessions`, `sessions[]` (`name`, `technique`, `durationMinutes`, `cosmeticsUsage`).
- Upload ảnh: `multipart/form-data` (trường tệp bất kỳ, khuyến nghị `file`) hoặc JSON `{ base64, mimeType, originalName }`, PNG/JPEG/WEBP tối đa 8 MB. Ảnh được trả về tại `/api/uploads/<tên tệp>`.
- Webhook n8n dùng `Authorization: Bearer $N8N_WEBHOOK_SECRET` kèm token hành động có chữ ký (xác nhận buổi / đánh giá).

## Tác vụ định kỳ

Bản chạy Node liên tục trước đây dùng `setInterval` để nhắc lịch, quét hạn sử dụng và gửi thông báo n8n. Trên Vercel không có tiến trình nền, nên mỗi vòng chạy được gom vào `api/jobs/tick.js`:

```bash
curl -X POST https://<deployment>/api/jobs/tick \
  -H "Authorization: Bearer $JOBS_SECRET"
```

Gọi mỗi 1–5 phút từ n8n Schedule, GitHub Actions hoặc cron-job.org. Khi phát triển cục bộ, các timer vẫn chạy tự động (`JOBS_IN_DEV=false` để tắt).
