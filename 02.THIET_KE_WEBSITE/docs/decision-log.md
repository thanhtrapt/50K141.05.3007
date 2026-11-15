# Nhật ký quyết định Hương Spa

Tài liệu này ghi lại các lựa chọn đã được nhóm chốt ở Giai đoạn 0 và cách chúng được áp dụng trong Backend. Người dùng đã xác nhận toàn bộ đề xuất Giai đoạn 0 và giao quyền tự chọn công nghệ Backend. Lược sử trả lời chi tiết từng câu hỏi Giai đoạn 0 không được lưu trong workspace, nên nội dung dưới đây đối chiếu với quyết định được nhắc lại trong cuộc trò chuyện, schema nhóm gửi và mã nguồn hiện tại.

| Chủ đề | Quyết định đã xác nhận / đang áp dụng | Ánh xạ |
|---|---|---|
| Cơ sở dữ liệu | Dùng project Supabase PostgreSQL đã tạo; giữ schema và dữ liệu hiện có, không tự tạo database, bảng hoặc seed. | `api/_lib/database.js`, `docs/ERD.md` |
| Công nghệ Backend | Node.js 22+, HTTP tích hợp, PostgreSQL qua `pg` và `DATABASE_URL`; JWT HS256 và `scrypt`; PDFKit + Sharp; n8n cho Zalo; OpenAPI 3.1. | `package.json`, `api/_lib/`, `n8n/`, `docs/openapi.json` |
| Giá mỹ phẩm | Giá bán và giá nhập không âm; số lượng nhập/xuất/bán phải là số nguyên dương. Giá dịch vụ là số nguyên dương. | `api/_lib/stockService.js`, `api/_lib/serviceService.js` |
| Số điện thoại khách hàng | Bắt buộc 10 chữ số và duy nhất. | `api/_lib/customerService.js`, Supabase schema |
| Danh sách đen | Ngưỡng cấu hình mặc định 3 lần hủy; từ 3 lần trở lên chặn đặt lịch. Không có API đặt lại số lần hủy. | `CauHinhHeThong.BLACKLIST_CANCEL_LIMIT`, `api/_lib/appointmentService.js` |
| Hủy lịch | Giữ lịch trong `LichHen` với trạng thái `Đã hủy`, ghi riêng lịch sử hủy; ẩn khỏi lịch đang hoạt động. | `api/_lib/appointmentService.js`, Supabase schema |
| Xóa dữ liệu đã phát sinh | Không xóa khách có giao dịch liên quan; không xóa mỹ phẩm có tồn hoặc lịch sử kho/bán; không xóa dịch vụ đã được mua. Mỹ phẩm ngừng hoạt động được ẩn khỏi danh mục. | `api/_lib/customerService.js`, `api/_lib/stockService.js`, `api/_lib/serviceService.js` |
| Gán liệu trình | Dùng API nội bộ để gán dịch vụ cho hồ sơ khách, lưu giá mua, ngày mua, trạng thái thanh toán và snapshot buổi. | `POST /api/customers/{id}/service-packages` |
| Tồn kho mỹ phẩm | Hoàn thành buổi không tự trừ kho; nhân viên/chủ tạo phiếu xuất riêng. Xuất kho chỉ cho mỹ phẩm loại `Dùng cho liệu trình`; bán lẻ chỉ cho loại `Bán lẻ`. | `api/_lib/stockService.js`, `api/_lib/customerService.js` |
| Loại mỹ phẩm | Mỗi mỹ phẩm thuộc đúng một loại: `Bán lẻ` hoặc `Dùng cho liệu trình`. | `MyPham.phanLoai`, Supabase schema |
| Điều chỉnh tồn | Không tạo nghiệp vụ điều chỉnh tồn độc lập; tăng/giảm tồn thông qua phiếu nhập, phiếu xuất và đơn bán lẻ. | API kho |
| Mã lô | Sinh theo `ddMMyy-STT`, ngày lấy từ ngày nhập, STT tăng theo ngày; mã bảng nghiệp vụ phải vừa cột `CHAR(10)`. | `nextLotCode`, `formatLotCode`, `formatEntityCode` |
| Hạn sử dụng | Cảnh báo sắp hết hạn khi còn từ 1 đến 60 ngày; `Hết hạn` khi còn 0 ngày hoặc ít hơn; quét nền sau 00:05 theo giờ Việt Nam. | `api/_lib/stockService.js`, `src/appointmentScheduler.js` |
| Tình trạng trùng lịch | Xét sức chứa theo số giường và số nhân sự có thể thực hiện đồng thời; cấu hình mặc định 3 giường và 1 nhân viên; lấy thời lượng từ buổi trong snapshot liệu trình. | `CauHinhHeThong`, `api/_lib/appointmentService.js` |
| Nhắc hẹn | Lưu job bền vững, mặc định nhắc trước 45 phút; gửi thực tế qua n8n, retry tối đa 5 lần. | `api/_lib/appointmentService.js`, `api/_lib/notificationService.js` |
| PDF mốc giữa/cuối | Mốc giữa lấy `ceil(N/2)`; buổi cuối có ưu tiên loại `Cuối liệu trình`. Với liệu trình một buổi chỉ tạo một tài liệu mốc cuối. PDF gồm khách, liệu trình, tiến độ, kết quả, kỹ thuật, mỹ phẩm, nhân viên và ảnh có thể nhúng. | `api/_lib/customerService.js`, `api/_lib/pdfSummaryService.js` |
| DTO và thời gian | JSON dùng `code/message/data` hoặc `code/message/fieldErrors`; ngày `YYYY-MM-DD`, giờ `HH:mm`, timestamp ISO/SQL; tìm kiếm không phân biệt dấu tiếng Việt; upload ảnh PNG/JPEG/WEBP tối đa 8 MB. | `api/_lib/http.js`, `api/_lib/utils.js` |
| Phạm vi tích hợp ngoài | Không xây cổng thanh toán/công nợ, nhà cung cấp, kế toán, khách tự đặt lịch, đặt hàng tự động, ngân hàng, thuế hoặc máy in. Zalo thật cần cấu hình URL công khai, token OA/ZBS và template đã duyệt. | README, `.env.example`, `n8n/` |
| Tài khoản seed | Tài khoản Chủ Spa và Nhân viên được quản lý trong Supabase hiện có; Backend không tạo hoặc cập nhật tài khoản mẫu. | Supabase project |

## Ghi chú về thông báo

API hiện trả nguyên văn một số thông báo nghiệp vụ mà mã nguồn đang dùng, nhưng toàn bộ sai khác câu chữ giữa bảng Use Case và Activity Diagram chưa được tự động đối chiếu theo từng trang SRS. Những thông báo đã được ghi vào test được liệt kê trong `test/unit/rules.test.js`; các thông báo còn lại cần đối chiếu trước khi cam kết khớp từng dấu câu.
