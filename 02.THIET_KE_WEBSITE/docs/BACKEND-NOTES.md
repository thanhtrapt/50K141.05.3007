# Hương Spa Backend

Backend dùng Node.js 22+, Vercel catch-all function, `pg` và PostgreSQL trên project Supabase đã có sẵn. Các endpoint hiện giữ nguyên URL, DTO, nghiệp vụ và RBAC. Không có bước tạo database, migration hoặc seed tự động; dữ liệu/schema hiện có được giữ nguyên.

## Chạy cục bộ

1. Cài Node.js 22.13 trở lên và chạy `npm ci` tại thư mục dự án.
2. Sao chép `.env.example` thành `.env`; đặt `DATABASE_URL` bằng connection string của Supabase, cùng `JWT_SECRET` riêng cho môi trường.
3. Chạy `npm run dev` để chạy giao diện và Backend tại `http://127.0.0.1:4000`.
4. Chạy `npm test` cho unit tests. `npm run test:integration` chỉ kết nối Supabase và chạy `SELECT` chỉ đọc; bài test được bỏ qua nếu chưa có `DATABASE_URL`.

Backend không tạo bảng, không ghi seed và không sửa schema khi khởi động. Frontend tiếp tục gọi API bằng các URL tương đối `/api/...`. Tài liệu OpenAPI ở `public/openapi.json`; Swagger UI ở `/api/docs`.

## Database

`DATABASE_URL` là biến duy nhất dành cho kết nối database. Pool PostgreSQL được dùng chung trong vòng đời tiến trình/function, giới hạn connection theo môi trường và transaction nghiệp vụ chạy ở mức serializable. Bảng/cột dùng tên tiếng Việt hiện có trong schema Supabase; mã backend không chạy migration.

Các endpoint duy trì định dạng phản hồi `{ code, message, data }` hoặc `{ code, message, fieldErrors }`. RBAC `OWNER`/`STAFF`, validation, thông báo và các nghiệp vụ khách hàng, dịch vụ, lịch hẹn, mỹ phẩm và kho vẫn do các service hiện có xử lý.

## Jobs và tích hợp

`POST /api/jobs/tick` vẫn chạy worker thông báo khi được gọi bởi lịch ngoài như n8n Schedule Trigger. Các URL n8n, secrets và cấu hình PDF/upload vẫn dùng các biến riêng trong `.env.example`; không biến nào chứa thông tin database ngoài `DATABASE_URL`.
