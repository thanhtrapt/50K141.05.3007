# Deploy Hương Spa lên Vercel với Supabase

## Cấu hình Vercel

Import repository hiện có vào Vercel, giữ Root Directory ở project, chọn Vite, Build Command `npm run build`, Output Directory `dist`.

`vercel.json` ở thư mục project đảm nhiệm hai việc:

- Chuyển mọi đường dẫn `/api/...` (kể cả nhiều tầng như `/api/auth/login`) về Serverless Function duy nhất `api/index.js` qua tham số `__path`. Vercel chỉ định tuyến được **một tầng** động cho một Function, nên không thể dựa vào tên tệp `[...route].js` để bắt các route con.
- Rewrite các route SPA còn lại (ví dụ `/dang-nhap`) về `/index.html`, để truy cập trực tiếp hoặc F5 không bị 404.

Các handler hỗ trợ nằm trong `api/_routes/` và thư viện dùng chung trong `api/_lib/` (thư mục bắt đầu bằng `_` không bị Vercel biến thành Function riêng).

## Biến môi trường

Trong Local, Preview và Production, đặt `DATABASE_URL` là connection string của Supabase PostgreSQL hiện có. Không cần chạy lệnh migrate/seed và không có bước tạo schema/database.

**Bắt buộc** đặt thêm `JWT_SECRET` (chuỗi ngẫu nhiên tối thiểu 32 ký tự) trong Vercel > Settings > Environment Variables. Nếu thiếu biến này, đăng nhập sẽ thất bại vì Backend không ký được token. Có thể kiểm tra nhanh bằng `/api/health`.

Các biến Backend khác như `N8N_WEBHOOK_SECRET`, `N8N_WEBHOOK_BASE_URL`, `N8N_PUBLIC_BASE_URL`, `JOBS_SECRET`, `PUBLIC_BASE_URL`, `PDF_FONT_PATH`, `PDF_BOLD_FONT_PATH` được mô tả trong `.env.example`.

Dùng connection string Supabase phù hợp với network của Vercel. Nếu host direct không truy cập được từ runtime, chọn connection string Session Pooler do Supabase cung cấp; vẫn đặt trong cùng biến `DATABASE_URL`.

## Xác minh sau deploy

- `/api/health` trả HTTP 200.
- `/api/docs` mở tài liệu API.
- Đăng nhập và thử API theo quyền tài khoản `OWNER`/`STAFF` đã tồn tại trong Supabase.
- Frontend tiếp tục gọi `/api/...` trên cùng domain.

Deploy không tạo hoặc thay đổi bảng/dữ liệu. Bài kiểm thử kết nối chỉ đọc thực hiện `SELECT current_database(), current_schema()`; không chạy CRUD trên dữ liệu thật.
