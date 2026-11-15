# Hương Spa — Hệ thống quản lý Spa

Frontend (React + Vite) và Backend (Vercel Serverless Functions) nằm trong **một project duy nhất**, chạy chung một deployment Vercel. Không có `vercel.json`, không có domain Backend riêng, không cấu hình CORS.

## Cấu trúc thư mục

```
.
├── index.html                 # điểm vào của Frontend (Vercel nhận diện Vite)
├── vite.config.js             # cấu hình Vite + proxy /api khi phát triển
├── package.json               # dependency chung của Frontend và Backend
├── public/                    # tài nguyên tĩnh: ảnh, /openapi.json
│   ├── assets/…
│   └── openapi.json
├── src/                       # mã nguồn Frontend (React)
│   ├── api.js                 # gọi API bằng đường dẫn tương đối /api/...
│   ├── components/ pages/ styles/ …
├── api/                       # Vercel Serverless Functions (Backend)
│   ├── _lib/                  # lõi dùng chung: CSDL, xác thực, nghiệp vụ…
│   ├── auth/login.js          # → POST /api/auth/login
│   ├── customers/[id]/index.js# → GET|PUT|DELETE /api/customers/:id
│   ├── …                      # mỗi tệp là một endpoint
│   ├── docs.js                # → Swagger UI tại /api/docs
│   └── jobs/tick.js           # → tác vụ định kỳ (nhắc lịch, hạn dùng, n8n)
├── migrations/                # migration SQL Server có đánh phiên bản
├── scripts/                   # dev-api.js (giả lập Vercel) và dev.mjs
├── test/                      # unit test + integration test
├── docs/                      # ERD, API, quyết định thiết kế, hướng dẫn deploy
└── n8n/                       # workflow Zalo OA/ZBS mẫu
```

Quy ước định tuyến của Vercel: tệp `api/customers/[id]/service-history.js` tương ứng `GET /api/customers/:id/service-history`. Thư mục `api/_lib` bắt đầu bằng `_` nên **không** bị biến thành endpoint.

## Yêu cầu môi trường

- Node.js **22.13** trở lên (đã khai báo `engines` trong `package.json`).
- SQL Server (local hoặc cloud) mà môi trường chạy đọc/ghi được.
- Khi phát triển trên Windows với Windows Authentication: cài thêm ODBC Driver 18 for SQL Server.

## Chạy ở máy cục bộ

```bash
npm install
cp .env.example .env          # Windows: copy .env.example .env
npm run db:setup              # chạy migration + seed tài khoản/cấu hình mẫu
npm run dev                   # http://localhost:5173 (Vite) + API ở http://127.0.0.1:4000
```

`npm run dev` chạy song song Vite và `scripts/dev-api.js`. Server dev này mô phỏng đúng cách Vercel ánh xạ thư mục `api/` (tham số động `[id]`, bắt toàn bộ `[...path]`, ưu tiên đường dẫn tĩnh), nên không cần cài Vercel CLI.

Lệnh riêng lẻ:

| Lệnh | Việc thực hiện |
|---|---|
| `npm run dev` | Vite + API cục bộ |
| `npm run dev:web` | Chỉ Vite (cần API đang chạy) |
| `npm run dev:api` | Chỉ API cục bộ tại `PORT` (mặc định 4000) |
| `npm run build` | Build giao diện ra `dist/` |
| `npm run migrate` | Áp dụng `migrations/*.sql` |
| `npm run seed` | Migration + tạo tài khoản/cấu hình/dữ liệu mẫu |
| `npm test` | Unit test (không cần CSDL) |
| `npm run test:integration` | Integration test với SQL Server thật |

Tài khoản seed mặc định: Chủ Spa `0912345678 / chuspa123`, Nhân viên `0901234567 / nhanvien123`.

## Phân quyền (RBAC)

Hai vai trò: `OWNER` (Chủ Spa) và `STAFF` (Nhân viên). `OWNER` kế thừa toàn bộ quyền của `STAFF`.

| Chức năng | STAFF | OWNER |
|---|---|---|
| Hồ sơ khách hàng: xem, tạo, sửa, xóa, lịch sử dịch vụ, dịch vụ đang sử dụng, đánh giá, sản phẩm mua thêm | Toàn quyền | Toàn quyền |
| Mỹ phẩm: xem, tạo, sửa, xóa; cảnh báo tồn kho và hạn sử dụng | Toàn quyền | Toàn quyền |
| Phiếu xuất kho: xem, tạo | Toàn quyền | Toàn quyền |
| Lịch hẹn | Chỉ xem | Xem, tạo, điều chỉnh, hủy |
| Dịch vụ | Chỉ xem | Xem, thêm, sửa, xóa |
| Phiếu nhập kho | **Bị chặn hoàn toàn** | Xem, tạo |
| Cấu hình hệ thống | **Bị chặn** | Toàn quyền |

Cách thực thi:

- **Backend:** `endpoint({ roles })` trong `api/_lib/http.js` kiểm tra role theo từng HTTP method trước khi vào handler; sai quyền trả `403 FORBIDDEN`. `roles: null` nghĩa là mọi tài khoản đã đăng nhập đều được phép.
- **Frontend:** ma trận quyền ở `src/auth/permissions.js` (`can(role, permission)`); `src/auth/RouteGuard.jsx` chặn URL trực tiếp, `Sidebar.jsx` ẩn menu không có quyền, các trang Lịch hẹn/Dịch vụ ẩn nút thao tác với `STAFF`.
- **Kiểm thử:** `test/unit/rbac.test.js` đối chiếu quyền từng endpoint với ma trận Frontend.

## Biến môi trường

Khai báo ở `.env` khi chạy cục bộ và trong **Vercel → Project → Settings → Environment Variables** khi triển khai.

| Biến | Ghi chú |
|---|---|
| `JWT_SECRET` | **Bắt buộc**, tối thiểu 32 ký tự ngẫu nhiên. Production từ chối khóa mặc định. |
| `JWT_EXPIRES_IN` | Thời hạn token, mặc định `8h`. |
| `SQL_AUTH` | `windows` (Windows Authentication, chỉ chạy trên Windows) hoặc `sql` (tài khoản SQL, chạy được trên Vercel). |
| `SQL_SERVER`, `SQL_PORT`, `SQL_DATABASE` | Máy chủ/cổng/tên CSDL; bỏ trống `SQL_PORT` với named instance. |
| `SQL_USER`, `SQL_PASSWORD` | Bắt buộc khi `SQL_AUTH=sql`. |
| `SQL_ENCRYPT`, `SQL_TRUST_SERVER_CERT` | `true`/`false`. Với Azure SQL nên đặt `SQL_ENCRYPT=true`. |
| `SQL_POOL_MAX` | Số kết nối tối đa mỗi function (mặc định 3 trên Vercel, 10 khi chạy cục bộ). |
| `AUTO_SETUP` | `true` (mặc định) tự chạy migration + seed ở lần kết nối đầu của mỗi function; đặt `false` trên production sau khi đã chạy `npm run migrate`. |
| `PUBLIC_BASE_URL` | Gốc URL công khai dùng để tạo link ảnh/PDF. Trên Vercel tự suy ra từ `VERCEL_URL`. |
| `UPLOAD_DIR` | Nơi lưu ảnh/PDF (mặc định `public/uploads` khi cục bộ, thư mục tạm khi chạy trên Vercel). |
| `MAX_BODY_BYTES` | Giới hạn body API, mặc định 12 MB cục bộ và 4 MB trên Vercel (nền tảng chặn ≈4,5 MB). |
| `PDF_FONT_PATH`, `PDF_BOLD_FONT_PATH` | Tệp TTF cho PDFKit (mặc định font Arial của Windows). |
| `N8N_WEBHOOK_BASE_URL`, `N8N_PUBLIC_BASE_URL`, `N8N_WEBHOOK_SECRET`, `N8N_MAX_RETRIES` | Tích hợp Zalo OA/ZBS qua n8n. |
| `JOBS_SECRET` | Bí mật cho `/api/jobs/tick`; nếu bỏ trống sẽ dùng `N8N_WEBHOOK_SECRET`. |
| `SEED_OWNER_*`, `SEED_STAFF_*` | Tài khoản tạo ở lần seed đầu tiên. |

Không còn biến `VITE_API_BASE_URL` hay `CORS_ORIGINS`: Frontend luôn gọi `/api/...` trên chính domain đang mở.

## API

Mỗi endpoint là một tệp trong `api/`, tự công bố route qua `endpoint()` trong `api/_lib/http.js`, giữ nguyên hợp đồng phản hồi cũ:

```json
{ "code": "OK", "message": "Thành công", "data": { } }
```

Lỗi trả về `{ code, message, fieldErrors }` với mã HTTP tương ứng (`400`, `401`, `403`, `404`, `405`, `413`, `415`, `500`). Danh sách đầy đủ và phân quyền: [docs/API.md](docs/API.md). Tài liệu OpenAPI 3.1: `public/openapi.json`, giao diện Swagger: `/api/docs` sau khi chạy.

## Triển khai Vercel

Hướng dẫn chi tiết: [docs/DEPLOYMENT-VERCEL.md](docs/DEPLOYMENT-VERCEL.md). Tóm tắt:

1. Import repository vào Vercel, **Root Directory** để trống (thư mục gốc).
2. Vercel tự nhận diện Vite: build `npm run build`, output `dist/`; thư mục `api/` tự động thành Serverless Functions.
3. Khai báo biến môi trường ở bảng trên, dùng `SQL_AUTH=sql` (driver thuần JS) vì function chạy trên Linux.
4. Chạy `npm run migrate` một lần với CSDL production, sau đó có thể đặt `AUTO_SETUP=false`.
5. Đặt lịch gọi `POST /api/jobs/tick` (header `Authorization: Bearer $JOBS_SECRET`) mỗi 1–5 phút để thay cho các timer chạy nền.

## Giới hạn cần biết trên Vercel

- **Không có tiến trình chạy nền**: các timer nhắc lịch/quét hạn/gửi n8n chỉ chạy khi phát triển cục bộ; trên Vercel chúng được gọi qua `/api/jobs/tick`.
- **Tệp tải lên không bền vững**: filesystem của function chỉ đọc, trừ thư mục `/tmp`, và mỗi instance có vùng tạm riêng. Ảnh/PDF phục vụ qua `/api/uploads/...` sẽ mất khi instance bị thu hồi — nên chuyển sang Vercel Blob/S3 nếu cần lưu lâu dài.
- **Giới hạn request body** của Vercel (≈4,5 MB) thấp hơn giới hạn 8 MB của API upload ảnh.
- **PDF** cần font TTF: đặt `PDF_FONT_PATH`/`PDF_BOLD_FONT_PATH` trỏ tới tệp TTF có trong bundle hoặc ổ đĩa của function.
- **Windows Authentication (`msnodesqlv8`)** chỉ dùng khi phát triển trên Windows; đây là `optionalDependency` nên `npm install` trên Linux của Vercel không bị lỗi.
- **Số lượng Serverless Function**: Vercel giới hạn **12 function/deployment ở gói Hobby** khi không dùng framework backend; project này có 43 endpoint (mỗi endpoint một tệp, đúng mô hình `/api/...`). Gói **Pro không giới hạn**. Nếu chỉ có Hobby, cần gộp nhiều route vào một function (ví dụ `api/[...path].js`) — khi đó mất đặc tính mỗi endpoint một tệp.
