# ERD dạng văn bản — schema Supabase PostgreSQL Hương Spa

## Tài khoản và kiểm soát

- `TaiKhoan (maTK)` cấp tài khoản cho OWNER/STAFF; được tham chiếu bởi `LichSuDangNhap`, `PhieuNhapKho`, `PhieuXuatKho`, `LichHen`, `DonGhiNhanBan`, `NhatKyThaoTac`, `CauHinhHeThong`.
- `LichSuDangNhap (maLichSu)` lưu lần đăng nhập thành công/thất bại, tên đăng nhập, thời gian, địa chỉ IP và user agent.
- `NhatKyThaoTac (maNhatKy)` lưu vai trò, hành động, đối tượng cùng JSON trước/sau.
- `CauHinhHeThong (maCauHinh)` lưu ngưỡng kho/hạn, giờ mở cửa và cấu hình lịch.
- `NhatKyThongBao (maThongBao)` lưu trạng thái gửi/nhận thông báo tích hợp.

## Khách hàng, dịch vụ và lịch hẹn

- `KhachHang (maKhachHang)` 1–n `DonMuaDV`, `LichHen`, `DanhGia`, `DonGhiNhanBan`.
- `DichVu (maDichVu)` 1–n `CT_DichVu`; `DichVu` 1–n `DonMuaDV`.
- `DonMuaDV (maDonMua)` tham chiếu `KhachHang` và `DichVu`; 1–n `CT_DonMua`.
- `CT_DonMua (maCT_DonMua)` tham chiếu mẫu buổi `CT_DichVu`; có thể được liên kết với `LichHen`.
- `LichHen (maLichHen)` tham chiếu `KhachHang`, người tạo `TaiKhoan` và buổi của đơn dịch vụ.
- `DanhGia (maDanhGia)` tham chiếu `KhachHang`.

## Mỹ phẩm và kho

- `MyPham (maMyPham)` phân loại `Bán lẻ` hoặc `Dùng cho liệu trình`; tồn tổng được giữ đồng bộ với tổng tồn các lô `LoHang`.
- `LoHang (maLo)` tham chiếu `MyPham`, chứa ngày sản xuất/hạn dùng/ngày nhập/tồn.
- `PhieuNhapKho (maPhieuNhap)` 1–n `CT_PhieuNhapKho`; mỗi dòng tham chiếu một `LoHang`.
- `PhieuXuatKho (maPhieuXuat)` 1–n `CT_PhieuXuatKho`; mỗi dòng tham chiếu một `LoHang`.
- `DonGhiNhanBan (maDon)` 1–n `CT_DonGhiNhanBan`; dòng bán tham chiếu lô hàng.
- `CanhBao (maCanhBao)` tham chiếu mỹ phẩm và/hoặc lô cho cảnh báo tồn thấp/hạn sử dụng.

Schema hiện hữu trên Supabase được dùng trực tiếp; ứng dụng không tạo hay sửa schema khi chạy.
