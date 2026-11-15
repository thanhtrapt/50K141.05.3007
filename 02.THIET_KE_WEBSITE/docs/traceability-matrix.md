# Ma trận truy vết SRS đến API và kiểm thử

Ma trận nối từng Use Case với API, module xử lý và test đang có. `IT-WORKFLOW` chạy qua migration/seed trên CSDL SQL Server tạm, sau đó chạy HTTP server để xác nhận JWT/RBAC. Các test tích hợp không sửa `HuongSpaDB`.

| Use Case | Business Rule / luồng chính | Endpoint | Tệp xử lý | Test |
|---|---|---|---|---|
| UC 0 — Đăng nhập | BR-0-01…04: bắt buộc trường, định dạng số di động, độ dài mật khẩu, xác thực tài khoản và ghi lịch sử | `POST /api/auth/login`, `GET /api/auth/me` | `authService.js`, `server.js`, `security.js` | `UT-RULES-LOGIN`, `UT-SECURITY`, `IT-WORKFLOW` |
| UC 1.1 — Xem hồ sơ | BR-1.1-01…03: blacklist, số lần hủy mặc định, trạng thái rỗng và nút tác vụ | `GET /api/customers`, `GET /api/customers/:id` | `customerService.js` | `IT-WORKFLOW` |
| UC 1.2 — Sửa hồ sơ | BR-1.2-01…03: thông tin bắt buộc, số điện thoại và mã không đổi | `PUT /api/customers/:id` | `customerService.js` | `UT-RULES-CUSTOMER`, `IT-WORKFLOW` |
| UC 1.3 — Xóa hồ sơ | Bảo toàn khách hàng có lịch sử/giao dịch liên quan | `DELETE /api/customers/:id` | `customerService.js` | `IT-WORKFLOW` |
| UC 1.4 — Tạo hồ sơ | BR-1.4-01…03: mã tự sinh, số lần hủy do hệ thống quản lý, trạng thái rỗng | `POST /api/customers` | `customerService.js`, `repositories.js` | `UT-RULES-CUSTOMER`, `IT-WORKFLOW` |
| UC 1.5 — Tổng hợp quá trình | Tạo PDF ở mốc giữa/cuối, tiếng Việt và ảnh khi khách xác nhận | `GET /api/service-packages/:packageId`, webhook xác nhận | `pdfSummaryService.js`, `notificationService.js`, `customerService.js` | `IT-WORKFLOW` |
| UC 1.6 — Theo dõi liệu trình | Máy trạng thái buổi, kết quả/ảnh, xác nhận khách, số buổi và PDF | `POST /api/service-packages/:packageId/sessions/:sessionId/{start,complete}`, `POST /api/webhooks/n8n/session-confirmed` | `customerService.js`, `notificationService.js` | `IT-WORKFLOW` |
| UC 1.7 — Đánh giá | BR-1.7-01: mức sao từ 1 đến 5; lưu đánh giá | `GET,POST /api/reviews`, `POST /api/webhooks/n8n/review-submitted` | `customerService.js`, `notificationService.js` | `UT-RULES-REVIEW`, `IT-WORKFLOW` |
| UC 1.8 — Sản phẩm mua thêm | FEFO/FIFO, kiểm tồn trong transaction, chống trừ quá số lượng và ghi đơn | `GET /api/retail-products`, `POST /api/customers/:id/retail-sales` | `customerService.js`, `stockService.js` | `IT-WORKFLOW` (FEFO và hai giao dịch đồng thời) |
| UC 2.1 — Xem mỹ phẩm | Danh sách/chi tiết và lô được sắp theo hạn dùng | `GET /api/cosmetics`, `GET /api/cosmetics/:id`, `GET /api/lots` | `stockService.js` | `IT-WORKFLOW` |
| UC 2.2 — Tạo mỹ phẩm | BR-2.2-01…04: tên duy nhất/bắt buộc, mã tự sinh, giá không âm, lỗi theo trường | `POST /api/cosmetics` | `stockService.js`, `repositories.js` | `UT-RULES-COSMETIC`, `IT-WORKFLOW` |
| UC 2.3 — Sửa mỹ phẩm | BR-2.3-01…04: tên không trùng, mã không đổi, giá hợp lệ | `PUT /api/cosmetics/:id` | `stockService.js` | `UT-RULES-COSMETIC`, `IT-WORKFLOW` |
| UC 2.4 — Xóa mỹ phẩm | Chặn xóa khi có tồn hoặc lịch sử; ngừng hoạt động thay cho xóa vật lý | `DELETE /api/cosmetics/:id` | `stockService.js` | `IT-WORKFLOW` |
| UC 2.5 — Cảnh báo tồn | BR-2.5-01…05: ngưỡng 10, phát sinh/gỡ cảnh báo, sắp hết/hết hàng | `GET /api/alerts`, `/api/alerts/stock`; nhập/xuất/bán cập nhật cảnh báo | `stockService.js`, `customerService.js` | `IT-WORKFLOW` (10, 11, 0 và gỡ cảnh báo) |
| UC 2.6 — Cảnh báo hạn | BR-2.6-01…04: 60 ngày, số ngày còn lại, hết hạn, xóa cảnh báo khi ngoài ngưỡng; job hằng ngày | `GET /api/alerts/expiry`, scheduler nền | `stockService.js`, `appointmentScheduler.js` | `IT-WORKFLOW` (mốc 60/61 ngày và hết hạn); lịch chạy job chưa có đồng hồ giả lập |
| UC 3.1 — Xem lịch | Danh sách lịch, chi tiết và lịch sử hủy | `GET /api/appointments`, `GET /api/appointments/:id`, `/api/appointments/cancellations` | `appointmentService.js` | `IT-WORKFLOW` |
| UC 3.2 — Tạo lịch | BR-3.2-01…02: thời lượng theo buổi, tính giờ kết thúc, nhắc trước 45 phút; blacklist và trùng lịch | `GET /api/appointments/availability`, `POST /api/appointments` | `appointmentService.js`, `appointmentScheduler.js` | `UT-SLOTS`, `UT-RULES-APPOINTMENT`, `IT-WORKFLOW` |
| UC 3.3 — Điều chỉnh lịch | Tính lại thời lượng, kiểm tra sức chứa, thay lịch nhắc cũ | `PUT /api/appointments/:id` | `appointmentService.js` | `IT-WORKFLOW` |
| UC 3.4 — Hủy lịch | BR-3.4-01: lưu lịch sử, tăng số lần hủy, chặn lịch tiếp theo khi đạt ngưỡng | `POST /api/appointments/:id/cancel`, `GET /api/customers/:id/cancellations` | `appointmentService.js`, `customerService.js` | `IT-WORKFLOW` (ba lần hủy và blacklist) |
| UC 4.1 — Xem dịch vụ | Tìm kiếm và xem chi tiết dịch vụ/buổi | `GET /api/services`, `GET /api/services/:id` | `serviceService.js` | `IT-WORKFLOW` |
| UC 4.2 — Tạo dịch vụ | BR-4.2-01/02/04: trường bắt buộc, giá/số buổi dương, mã tự sinh | `POST /api/services` | `serviceService.js`, `repositories.js` | `UT-RULES-SERVICE`, `IT-WORKFLOW` |
| UC 4.3 — Sửa dịch vụ | BR-4.3-01/02: mã bất biến, trường cập nhật hợp lệ, snapshot lịch sử | `PUT /api/services/:id` | `serviceService.js` | `UT-RULES-SERVICE`, `IT-WORKFLOW` |
| UC 4.4 — Xóa dịch vụ | BR-4.4-01/02: chỉ OWNER, chỉ xóa dịch vụ có tồn tại và chưa mua | `DELETE /api/services/:id` | `server.js`, `serviceService.js` | `UT-OPENAPI-RBAC`, `IT-WORKFLOW` |
| UC 5.1 — Tạo phiếu nhập | BR-5.1.01…07: mã, thành tiền/tổng, lô riêng, định dạng mã lô, hạn sau ngày sản xuất | `POST /api/stock-receipts` | `stockService.js`, `repositories.js` | `UT-RULES-RECEIPT`, `UT-LOT-CODE`, `IT-WORKFLOW` |
| UC 5.2 — Xem phiếu nhập | Danh sách và chi tiết, không thay đổi tồn | `GET /api/stock-receipts`, `GET /api/stock-receipts/:id` | `stockService.js` | `IT-WORKFLOW` |
| UC 6.1 — Tạo phiếu xuất | BR-6.1-01…06: loại mỹ phẩm, tồn lô, hạn dùng, lô lặp, ưu tiên hạn gần, transaction | `POST /api/stock-issues` | `stockService.js`, `repositories.js` | `UT-RULES-ISSUE`, `IT-WORKFLOW` |
| UC 6.2 — Xem phiếu xuất | Danh sách/chi tiết, không đổi tồn | `GET /api/stock-issues`, `GET /api/stock-issues/:id` | `stockService.js` | `IT-WORKFLOW` |

## Test được chạy

- `npm test`: 18 unit test đã đạt; gồm quy tắc trường, token, mật khẩu, ngày, mã định danh, gợi ý khung giờ và độ phủ OpenAPI/RBAC.
- `npm run test:integration`: một luồng tích hợp SQL Server đã đạt; tạo CSDL dùng một lần, áp dụng migration/seed, chạy CRUD/nhập-xuất/bán FEFO/cạnh tranh tồn, lịch hẹn/blacklist, máy trạng thái buổi, PDF, đánh giá và khởi động HTTP server để kiểm tra phân quyền; CSDL được dọn sau khi chạy.

## Giới hạn độ phủ hiện tại

Ma trận cho thấy các luồng chức năng chính đều có mã xử lý và test tổng hợp. Bộ test chưa có case riêng cho mọi exception message trong SRS, toàn bộ quyền trên từng endpoint, mọi lỗi mạng Zalo/n8n hoặc thời điểm chạy job bằng đồng hồ giả lập. Các phần này cần test riêng trước khi khẳng định đạt yêu cầu “mỗi BR và mỗi Exception flow có ít nhất một test”.
