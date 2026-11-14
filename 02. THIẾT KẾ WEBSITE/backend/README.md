# Hương Spa Backend — Giai đoạn 1–6

Backend dùng Node.js, HTTP tích hợp sẵn, SQL Server qua `mssql`, migration SQL Server có phiên bản, JWT HS256 và băm mật khẩu `scrypt` của Node. API không cần Express hoặc ORM runtime; các truy vấn dùng tham số SQL Server.

## Khởi chạy

1. Cài Node.js 22.13 trở lên và SQL Server. Với Windows Authentication, bật giao thức TCP/IP cho instance SQL Server và cấu hình cổng tĩnh trùng `SQL_PORT` trong `.env` (mặc định `1433`), sau đó khởi động lại dịch vụ SQL Server. Driver `msnodesqlv8` cần TCP/IP.
2. Sao chép `backend/.env.example` thành `backend/.env`, đặt `SQL_AUTH=windows`, tên máy/cổng/database phù hợp và thay `JWT_SECRET` bằng chuỗi bí mật riêng. Không cần `SQL_USER`/`SQL_PASSWORD` cho Windows Authentication.
3. Chạy `npm install --prefix backend`.
4. Chạy `npm run migrate --prefix backend` để tạo CSDL/migration, hoặc `npm run start --prefix backend`; lệnh start sẽ chạy migration và seed trước khi mở API.
5. Chạy `npm test --prefix backend` cho Unit Test. Chạy `npm run test:integration --prefix backend` để kiểm thử với SQL Server; test tự tạo CSDL tên ngẫu nhiên `HuongSpaTest_*` rồi xóa CSDL đó khi hoàn tất. Cần cho phép tài khoản Windows/SQL tạo và xóa CSDL trong suốt bài test.
6. API mặc định chạy ở `http://127.0.0.1:4000`; tài liệu Swagger UI ở `/docs`, đặc tả JSON ở `/openapi.json`.

Tài khoản seed phát triển hiện tại: Chủ Spa `0912345678` / `chuspa123`; Nhân viên `0901234567` / `nhanvien123`. Đặt lại các biến `SEED_*` trước lần seed đầu tiên của môi trường thật. Tài khoản đã tồn tại không bị ghi đè mật khẩu.

## API Giai đoạn 1–6

Swagger UI hiển thị toàn bộ API đã triển khai và cho phép thử các request có xác thực: `http://127.0.0.1:4000/docs`. Đặc tả OpenAPI 3.1 nằm tại `backend/docs/openapi.json` và được phục vụ ở `/openapi.json`. Giao diện Swagger tải từ unpkg CDN nên cần Internet; tệp OpenAPI vẫn có thể mở/import riêng khi ngoại tuyến. Đặt `servers[0].url` trong đặc tả thành URL Backend tương ứng khi triển khai.

| Method | Endpoint | Quyền |
|---|---|---|
| POST | `/api/auth/login` | Công khai |
| GET | `/api/auth/me` | OWNER, STAFF |
| GET | `/api/services`, `/api/services/:id` | OWNER, STAFF |
| POST, PUT, DELETE | `/api/services`, `/api/services/:id` | OWNER |
| GET, POST | `/api/customers` | OWNER, STAFF |
| GET, PUT, DELETE | `/api/customers/:id` | OWNER, STAFF |
| GET | `/api/customers/:id/service-history` | OWNER, STAFF |
| POST | `/api/customers/:id/service-packages` | OWNER, STAFF |
| GET | `/api/service-packages/:id` | OWNER, STAFF |
| POST | `/api/service-packages/:packageId/sessions/:sessionId/start` | OWNER, STAFF |
| POST | `/api/service-packages/:packageId/sessions/:sessionId/complete` | OWNER, STAFF |
| GET | `/api/retail-products` | OWNER, STAFF |
| POST | `/api/customers/:id/retail-sales` | OWNER, STAFF |
| GET, POST | `/api/reviews` | OWNER, STAFF |
| GET | `/api/reviews/:id` | OWNER, STAFF |
| GET | `/api/appointments`, `/api/appointments/:id` | OWNER, STAFF |
| GET | `/api/appointments/availability` | OWNER, STAFF |
| POST, PUT | `/api/appointments`, `/api/appointments/:id` | OWNER |
| POST | `/api/appointments/:id/cancel` | OWNER |
| GET | `/api/appointments/cancellations`, `/api/customers/:id/cancellations` | OWNER, STAFF |
| GET | `/api/cosmetics`, `/api/cosmetics/:id`, `/api/lots` | OWNER, STAFF |
| POST, PUT, DELETE | `/api/cosmetics` | OWNER |
| POST | `/api/files/images` | OWNER, STAFF |
| POST | `/api/webhooks/n8n/session-confirmed` | n8n webhook secret + signed action token |
| POST | `/api/webhooks/n8n/review-submitted` | n8n webhook secret + signed review token |
| GET | `/api/alerts`, `/api/alerts/stock`, `/api/alerts/expiry` | OWNER, STAFF |
| GET, PATCH | `/api/system-config`, `/api/system-config/:key` | OWNER |
| GET, POST | `/api/stock-receipts`, `/api/stock-receipts/:id` | OWNER |
| GET, POST | `/api/stock-issues`, `/api/stock-issues/:id` | OWNER, STAFF |

Danh sách nhận `page`, `limit`, `keyword`; từ khóa so sánh không phân biệt dấu tiếng Việt. API dịch vụ nhận `name`, `price`, `totalSessions` và `sessions[]` gồm `name`, `technique`, `durationMinutes`, `cosmeticsUsage`. `totalSessions` có thể bỏ qua khi tạo, khi đó lấy theo số buổi; nếu gửi thì phải bằng số buổi khai báo. Upload ảnh dùng `multipart/form-data`, trường tệp bất kỳ (khuyến nghị `file`) và chỉ nhận PNG/JPEG/WEBP tối đa 8 MB. Tệp phục vụ ở `/uploads/...`.

## Tương thích schema nhóm

Migration giữ nguyên tên bảng và các cột nghiệp vụ tiếng Việt trong schema nhóm: `TaiKhoan`, `KhachHang`, `DichVu`, `MyPham`, `LichSuDangNhap`, `PhieuNhapKho`, `PhieuXuatKho`, `LoHang`, `CT_DichVu`, `DonMuaDV`, `CT_DonMua`, `LichHen`, `DanhGia`, `CT_PhieuNhapKho`, `CT_PhieuXuatKho`, `DonGhiNhanBan`, `CT_DonGhiNhanBan`.

Các điều chỉnh có chủ đích: `TaiKhoan.matKhau` được tăng lên `VARCHAR(255)` để lưu hash; ràng buộc độ dài mật khẩu áp dụng trước khi hash ở API. `MyPham.giaBan` và tổng tiền bán/nhập cho phép 0 theo quyết định Giai đoạn 0. `KhachHang.soDienThoai` được unique theo quyết định Giai đoạn 0. Cột bổ sung và bảng phụ trợ dùng tên tiếng Việt (`NhatKyThaoTac`, `CauHinhHeThong`, `CanhBao`, `NhatKyThongBao`, `LichSuMigration`).

Migration `003_session_template_snapshot.sql` bổ sung các cột snapshot tiếng Việt vào `CT_DonMua` và điền dữ liệu cho hồ sơ cũ. Xóa dịch vụ đã được khách mua bị từ chối để bảo toàn lịch sử; chỉnh sửa nội dung buổi giữ nguyên mã buổi và lịch sử cũ sẽ đọc từ snapshot.

Migration `004_customer_package_review.sql` bổ sung ngày kết thúc liệu trình và liên kết đánh giá với liệu trình/tài khoản. Migration `005_session_provider.sql` ghi nhận tài khoản nhân viên thực hiện từng buổi để hiển thị trong chi tiết đánh giá. Bán lẻ trừ kho theo FEFO (hạn dùng gần nhất trước), rồi FIFO (ngày nhập trước); không bán lô đã hết hạn.

Migration `006_appointments.sql` tạo lịch sử hủy và gắn job nhắc hẹn vào nhật ký thông báo. Lịch hủy được ẩn khỏi lịch nhưng giữ lại trong lịch sử.

Giai đoạn 5 dùng migration `007_pdf_notifications.sql` để lưu tài liệu PDF và sự kiện thông báo. Khi khách xác nhận buổi ở giữa liệu trình hoặc buổi cuối, hệ thống tạo PDF tổng hợp các buổi đã hoàn tất, lưu URL vào hồ sơ liệu trình và xếp sự kiện gửi PDF/đánh giá vào hàng đợi. Các tệp PDF được lưu trong `backend/public/uploads/summaries`.

### Kết nối n8n và Zalo

1. Import `backend/n8n/n8n_huong_spa_zalo_workflow.json` vào n8n và kích hoạt workflow sau khi cấu hình môi trường.
2. Trong `backend/.env`, đặt `N8N_WEBHOOK_BASE_URL` là địa chỉ webhook production của n8n (ví dụ `https://n8n.example/webhook`) và `N8N_PUBLIC_BASE_URL` là địa chỉ công khai người dùng có thể mở. `PUBLIC_BASE_URL` phải là địa chỉ Backend mà n8n và khách mở được để tải ảnh/PDF.
3. Trong môi trường n8n, đặt `HUONG_SPA_API_BASE_URL`, `HUONG_SPA_WEBHOOK_SECRET` (cùng giá trị với `N8N_WEBHOOK_SECRET` của Backend), `N8N_PUBLIC_BASE_URL`, `ZALO_ACCESS_TOKEN` và ba mã mẫu đã được Zalo duyệt: `ZALO_TEMPLATE_APPOINTMENT_REMINDER`, `ZALO_TEMPLATE_SESSION_CONFIRM`, `ZALO_TEMPLATE_SUMMARY_REVIEW`.
4. Các mẫu Zalo cần khai báo đúng biến `customer_name`, `appointment_date`, `appointment_time`, `spa_name`, `service_name`, `session_name`, `result`, `image_url`, `confirmation_url`, `pdf_url`, `review_url` theo từng luồng. Số điện thoại gửi đi được chuyển từ `0xxxxxxxxx` sang `84xxxxxxxxx`.

Worker kiểm tra hàng đợi mỗi 5 giây, tối đa 5 lần gửi với thời gian chờ tăng dần; nếu chưa cấu hình n8n thì sự kiện được giữ trong CSDL ở trạng thái chờ. Job quét hạn lô chạy một lần mỗi ngày theo giờ Việt Nam sau 00:05. Liên kết xác nhận buổi hết hạn sau 7 ngày; liên kết đánh giá hết hạn sau 30 ngày. Không đưa `N8N_WEBHOOK_SECRET` hoặc access token Zalo vào mã nguồn hay chia sẻ công khai.

Các webhook người dùng gọi qua n8n: `GET /webhook/zalo/session-confirm?token=...`, `GET /webhook/zalo/review-form?token=...` và `POST /webhook/zalo/review-submitted`. Hai API callback của Backend chỉ nhận request có Bearer secret đúng và token hành động còn hiệu lực.

## Lỗi API

```json
{
  "code": "VALIDATION_ERROR",
  "message": "Thông tin chưa hợp lệ, yêu cầu nhập lại",
  "fieldErrors": [{ "field": "salePrice", "message": "Giá bán không được là số âm" }]
}
```

## Kiểm thử và truy vết

Ma trận Use Case, Business Rule, endpoint, module và test nằm ở `backend/docs/traceability-matrix.md`; các lựa chọn nghiệp vụ đã xác nhận nằm ở `backend/docs/decision-log.md`. Unit Test dùng `node:test` và không cần kết nối SQL Server. Integration Test dùng CSDL tạm riêng, không tác động `HuongSpaDB`; nếu test bị dừng cưỡng bức trước khi cleanup, kiểm tra và xóa thủ công CSDL có tiền tố `HuongSpaTest_` sau khi bảo đảm không có bài test đang chạy.

Các test hiện có tập trung vào Business Rule và luồng chính; ma trận ghi rõ các exception message, quyền endpoint, lỗi kết nối Zalo/n8n và kiểm thử thời điểm job còn thiếu test riêng.
