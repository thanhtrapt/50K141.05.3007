IF OBJECT_ID(N'dbo.TaiKhoan', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.TaiKhoan (
    maTK CHAR(10) NOT NULL CONSTRAINT PK_TaiKhoan PRIMARY KEY,
    tenDangNhap VARCHAR(10) NOT NULL CONSTRAINT UQ_TaiKhoan_tenDangNhap UNIQUE,
    matKhau VARCHAR(255) NOT NULL,
    vaiTro NVARCHAR(20) NOT NULL CONSTRAINT CK_TaiKhoan_vaiTro CHECK(vaiTro IN (N'Chủ Spa',N'Nhân viên')),
    trangThai BIT NOT NULL CONSTRAINT DF_TaiKhoan_trangThai DEFAULT(1),
    hoTen NVARCHAR(100) NOT NULL,
    ngayTao DATETIME2(0) NOT NULL CONSTRAINT DF_TaiKhoan_ngayTao DEFAULT(SYSDATETIME())
  );
END;
IF OBJECT_ID(N'dbo.KhachHang', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.KhachHang (
    maKhachHang CHAR(10) NOT NULL CONSTRAINT PK_KhachHang PRIMARY KEY,
    hoTen NVARCHAR(50) NOT NULL,
    ngaySinh DATE NOT NULL,
    soDienThoai VARCHAR(10) NOT NULL CONSTRAINT UQ_KhachHang_soDienThoai UNIQUE,
    soLanHuyLich INT NOT NULL CONSTRAINT DF_KhachHang_soLanHuyLich DEFAULT(0),
    ngayTao DATETIME2(0) NOT NULL CONSTRAINT DF_KhachHang_ngayTao DEFAULT(SYSDATETIME()),
    CONSTRAINT CK_KhachHang_ngaySinh CHECK(ngaySinh < CONVERT(date,GETDATE())),
    CONSTRAINT CK_KhachHang_soDienThoai CHECK(soDienThoai NOT LIKE '%[^0-9]%' AND LEN(soDienThoai)=10)
  );
END;
IF OBJECT_ID(N'dbo.DichVu', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.DichVu (
    maDichVu CHAR(10) NOT NULL CONSTRAINT PK_DichVu PRIMARY KEY,
    tenDV NVARCHAR(100) NOT NULL CONSTRAINT UQ_DichVu_tenDV UNIQUE,
    giaDV MONEY NOT NULL CONSTRAINT CK_DichVu_giaDV CHECK(giaDV>0),
    tongSoBuoi INT NOT NULL CONSTRAINT CK_DichVu_tongSoBuoi CHECK(tongSoBuoi>0),
    trangThai BIT NOT NULL CONSTRAINT DF_DichVu_trangThai DEFAULT(1)
  );
END;
IF OBJECT_ID(N'dbo.MyPham', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.MyPham (
    maMyPham CHAR(10) NOT NULL CONSTRAINT PK_MyPham PRIMARY KEY,
    tenMyPham NVARCHAR(100) NOT NULL CONSTRAINT UQ_MyPham_tenMyPham UNIQUE,
    hinhAnh VARCHAR(255) NULL,
    phanLoai NVARCHAR(30) NOT NULL CONSTRAINT CK_MyPham_phanLoai CHECK(phanLoai IN (N'Bán lẻ',N'Dùng cho liệu trình')),
    soLuongTonKho INT NOT NULL CONSTRAINT DF_MyPham_soLuongTonKho DEFAULT(0) CONSTRAINT CK_MyPham_soLuongTonKho CHECK(soLuongTonKho>=0),
    donViTinh NVARCHAR(20) NOT NULL,
    giaBan MONEY NOT NULL CONSTRAINT CK_MyPham_giaBan CHECK(giaBan>=0),
    moTa NVARCHAR(200) NULL,
    trangThai BIT NOT NULL CONSTRAINT DF_MyPham_trangThai DEFAULT(1)
  );
END;
IF OBJECT_ID(N'dbo.LichSuDangNhap', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.LichSuDangNhap (
    maLichSu CHAR(10) NOT NULL CONSTRAINT PK_LichSuDangNhap PRIMARY KEY,
    thoiGianDangNhap DATETIME2(0) NOT NULL,
    trangThaiDangNhap NVARCHAR(20) NOT NULL CONSTRAINT CK_LichSuDangNhap_trangThai CHECK(trangThaiDangNhap IN (N'Thành công',N'Thất bại')),
    maTK CHAR(10) NULL,
    tenDangNhap VARCHAR(10) NOT NULL,
    diaChiIP VARCHAR(45) NULL,
    userAgent NVARCHAR(500) NULL,
    CONSTRAINT FK_LichSuDangNhap_TaiKhoan FOREIGN KEY(maTK) REFERENCES dbo.TaiKhoan(maTK)
  );
END;
IF OBJECT_ID(N'dbo.PhieuNhapKho', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.PhieuNhapKho (
    maPhieuNhap CHAR(10) NOT NULL CONSTRAINT PK_PhieuNhapKho PRIMARY KEY,
    ngayNhap DATE NOT NULL,
    nguoiTao NVARCHAR(50) NOT NULL,
    trangThaiThanhToan NVARCHAR(20) NOT NULL CONSTRAINT CK_PhieuNhapKho_trangThai CHECK(trangThaiThanhToan IN (N'Đã thanh toán',N'Chưa thanh toán')),
    tongTien MONEY NOT NULL CONSTRAINT CK_PhieuNhapKho_tongTien CHECK(tongTien>=0),
    maTK CHAR(10) NULL,
    CONSTRAINT FK_PhieuNhapKho_TaiKhoan FOREIGN KEY(maTK) REFERENCES dbo.TaiKhoan(maTK)
  );
END;
IF OBJECT_ID(N'dbo.PhieuXuatKho', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.PhieuXuatKho (
    maPhieuXuat CHAR(10) NOT NULL CONSTRAINT PK_PhieuXuatKho PRIMARY KEY,
    ngayXuat DATE NOT NULL,
    nguoiTao NVARCHAR(50) NOT NULL,
    ghiChu NVARCHAR(200) NULL,
    maTK CHAR(10) NULL,
    CONSTRAINT FK_PhieuXuatKho_TaiKhoan FOREIGN KEY(maTK) REFERENCES dbo.TaiKhoan(maTK)
  );
END;
IF OBJECT_ID(N'dbo.LoHang', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.LoHang (
    maLo CHAR(10) NOT NULL CONSTRAINT PK_LoHang PRIMARY KEY,
    soLuongTonLo INT NOT NULL CONSTRAINT CK_LoHang_soLuong CHECK(soLuongTonLo>=0),
    ngaySanXuat DATE NOT NULL,
    hanSuDung DATE NOT NULL,
    maMyPham CHAR(10) NULL,
    ngayNhap DATE NOT NULL,
    CONSTRAINT FK_LoHang_MyPham FOREIGN KEY(maMyPham) REFERENCES dbo.MyPham(maMyPham),
    CONSTRAINT CK_LoHang_han CHECK(hanSuDung>ngaySanXuat)
  );
END;
IF OBJECT_ID(N'dbo.CT_DichVu', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.CT_DichVu (
    maCT_DichVu CHAR(10) NOT NULL CONSTRAINT PK_CT_DichVu PRIMARY KEY,
    tenBuoi NVARCHAR(20) NOT NULL,
    kyThuat NVARCHAR(255) NOT NULL,
    thoiGianThucHien INT NOT NULL CONSTRAINT CK_CT_DichVu_thoiGian CHECK(thoiGianThucHien>0),
    myPhamSD NVARCHAR(200) NOT NULL,
    maDichVu CHAR(10) NULL,
    CONSTRAINT FK_CT_DichVu_DichVu FOREIGN KEY(maDichVu) REFERENCES dbo.DichVu(maDichVu)
  );
END;
IF OBJECT_ID(N'dbo.DonMuaDV', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.DonMuaDV (
    maDonMua CHAR(10) NOT NULL CONSTRAINT PK_DonMuaDV PRIMARY KEY,
    ngayMua DATETIME2(0) NOT NULL,
    trangThaiThanhToan NVARCHAR(50) NOT NULL CONSTRAINT CK_DonMuaDV_thanhToan CHECK(trangThaiThanhToan IN (N'Đã thanh toán',N'Chưa thanh toán')),
    trangThaiHoanThanh NVARCHAR(50) NOT NULL CONSTRAINT CK_DonMuaDV_hoanThanh CHECK(trangThaiHoanThanh IN (N'Chưa thực hiện',N'Đang thực hiện',N'Đã hoàn thành')),
    fileTongHop NVARCHAR(255) NULL,
    soBuoiDaThucHien INT NOT NULL CONSTRAINT DF_DonMuaDV_soBuoi DEFAULT(0),
    ghiChu NVARCHAR(255) NULL,
    maDichVu CHAR(10) NULL,
    maKhachHang CHAR(10) NULL,
    giaMua MONEY NOT NULL CONSTRAINT DF_DonMuaDV_giaMua DEFAULT(0),
    CONSTRAINT FK_DonMuaDV_DichVu FOREIGN KEY(maDichVu) REFERENCES dbo.DichVu(maDichVu),
    CONSTRAINT FK_DonMuaDV_KhachHang FOREIGN KEY(maKhachHang) REFERENCES dbo.KhachHang(maKhachHang)
  );
END;
IF OBJECT_ID(N'dbo.CT_DonMua', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.CT_DonMua (
    maCT_DonMua CHAR(10) NOT NULL CONSTRAINT PK_CT_DonMua PRIMARY KEY,
    tenBuoi NVARCHAR(20) NULL,
    ngayThucHien DATETIME2(0) NULL,
    ketQua NVARCHAR(255) NULL,
    trangThaiThucHien NVARCHAR(50) NOT NULL CONSTRAINT DF_CT_DonMua_trangThai DEFAULT(N'Chưa thực hiện') CONSTRAINT CK_CT_DonMua_trangThai CHECK(trangThaiThucHien IN (N'Chưa thực hiện',N'Đang thực hiện',N'Chờ xác nhận',N'Đã hoàn thành')),
    xacNhanKH NVARCHAR(50) NOT NULL CONSTRAINT DF_CT_DonMua_xacNhan DEFAULT(N'Chưa xác nhận') CONSTRAINT CK_CT_DonMua_xacNhan CHECK(xacNhanKH IN (N'Chưa xác nhận',N'Đã xác nhận')),
    hinhAnh NVARCHAR(255) NULL,
    ghiChu NVARCHAR(255) NULL,
    maDonMua CHAR(10) NULL,
    maCT_DichVu CHAR(10) NULL,
    CONSTRAINT FK_CT_DonMua_DonMuaDV FOREIGN KEY(maDonMua) REFERENCES dbo.DonMuaDV(maDonMua),
    CONSTRAINT FK_CT_DonMua_CT_DichVu FOREIGN KEY(maCT_DichVu) REFERENCES dbo.CT_DichVu(maCT_DichVu)
  );
END;
IF OBJECT_ID(N'dbo.LichHen', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.LichHen (
    maLichHen CHAR(10) NOT NULL CONSTRAINT PK_LichHen PRIMARY KEY,
    ngayHen DATE NOT NULL,
    gioBatDau TIME(0) NOT NULL,
    gioKetThuc TIME(0) NULL,
    trangThai NVARCHAR(50) NOT NULL CONSTRAINT DF_LichHen_trangThai DEFAULT(N'Chờ xác nhận') CONSTRAINT CK_LichHen_trangThai CHECK(trangThai IN (N'Chờ xác nhận',N'Đã xác nhận',N'Hoàn thành',N'Đã hủy')),
    ghiChu NVARCHAR(200) NULL,
    maCT_DonMua CHAR(10) NULL,
    maTK CHAR(10) NULL,
    maKhachHang CHAR(10) NULL,
    CONSTRAINT FK_LichHen_CT_DonMua FOREIGN KEY(maCT_DonMua) REFERENCES dbo.CT_DonMua(maCT_DonMua),
    CONSTRAINT FK_LichHen_TaiKhoan FOREIGN KEY(maTK) REFERENCES dbo.TaiKhoan(maTK),
    CONSTRAINT FK_LichHen_KhachHang FOREIGN KEY(maKhachHang) REFERENCES dbo.KhachHang(maKhachHang),
    CONSTRAINT CK_LichHen_gio CHECK(gioKetThuc IS NULL OR gioKetThuc>gioBatDau)
  );
END;
IF OBJECT_ID(N'dbo.DanhGia', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.DanhGia (
    maDanhGia CHAR(10) NOT NULL CONSTRAINT PK_DanhGia PRIMARY KEY,
    noiDung NVARCHAR(200) NOT NULL,
    mucDanhGia INT NOT NULL CONSTRAINT CK_DanhGia_muc CHECK(mucDanhGia BETWEEN 1 AND 5),
    hinhAnh VARCHAR(255) NULL,
    thoiGianDanhGia DATETIME2(0) NOT NULL,
    maKhachHang CHAR(10) NULL,
    CONSTRAINT FK_DanhGia_KhachHang FOREIGN KEY(maKhachHang) REFERENCES dbo.KhachHang(maKhachHang)
  );
END;
IF OBJECT_ID(N'dbo.CT_PhieuNhapKho', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.CT_PhieuNhapKho (
    maCT_PhieuNhap CHAR(10) NOT NULL CONSTRAINT PK_CT_PhieuNhapKho PRIMARY KEY,
    soLuong INT NOT NULL CONSTRAINT CK_CT_PhieuNhap_soLuong CHECK(soLuong>0),
    giaNhap MONEY NOT NULL CONSTRAINT CK_CT_PhieuNhap_gia CHECK(giaNhap>=0),
    thanhTien MONEY NOT NULL,
    maPhieuNhap CHAR(10) NULL,
    maLo CHAR(10) NULL,
    CONSTRAINT FK_CT_PhieuNhapKho_PhieuNhap FOREIGN KEY(maPhieuNhap) REFERENCES dbo.PhieuNhapKho(maPhieuNhap),
    CONSTRAINT FK_CT_PhieuNhapKho_LoHang FOREIGN KEY(maLo) REFERENCES dbo.LoHang(maLo),
    CONSTRAINT CK_CT_PhieuNhap_thanhTien CHECK(thanhTien>=0 AND thanhTien=soLuong*giaNhap)
  );
END;
IF OBJECT_ID(N'dbo.CT_PhieuXuatKho', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.CT_PhieuXuatKho (
    maCT_PhieuXuat CHAR(10) NOT NULL CONSTRAINT PK_CT_PhieuXuatKho PRIMARY KEY,
    soLuong INT NOT NULL CONSTRAINT CK_CT_PhieuXuat_soLuong CHECK(soLuong>0),
    maPhieuXuat CHAR(10) NULL,
    maLo CHAR(10) NULL,
    CONSTRAINT FK_CT_PhieuXuatKho_PhieuXuat FOREIGN KEY(maPhieuXuat) REFERENCES dbo.PhieuXuatKho(maPhieuXuat),
    CONSTRAINT FK_CT_PhieuXuatKho_LoHang FOREIGN KEY(maLo) REFERENCES dbo.LoHang(maLo)
  );
END;
IF OBJECT_ID(N'dbo.DonGhiNhanBan', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.DonGhiNhanBan (
    maDon CHAR(10) NOT NULL CONSTRAINT PK_DonGhiNhanBan PRIMARY KEY,
    ngayMua DATETIME2(0) NOT NULL,
    tongTien MONEY NOT NULL CONSTRAINT CK_DonGhiNhanBan_tong CHECK(tongTien>=0),
    maTK CHAR(10) NULL,
    maKhachHang CHAR(10) NULL,
    CONSTRAINT FK_DonGhiNhanBan_TaiKhoan FOREIGN KEY(maTK) REFERENCES dbo.TaiKhoan(maTK),
    CONSTRAINT FK_DonGhiNhanBan_KhachHang FOREIGN KEY(maKhachHang) REFERENCES dbo.KhachHang(maKhachHang)
  );
END;
IF OBJECT_ID(N'dbo.CT_DonGhiNhanBan', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.CT_DonGhiNhanBan (
    maCT_Don CHAR(10) NOT NULL CONSTRAINT PK_CT_DonGhiNhanBan PRIMARY KEY,
    soLuong INT NOT NULL CONSTRAINT CK_CT_DonGhiNhanBan_soLuong CHECK(soLuong>0),
    donGia MONEY NOT NULL CONSTRAINT CK_CT_DonGhiNhanBan_donGia CHECK(donGia>=0),
    thanhTien MONEY NOT NULL,
    maDon CHAR(10) NULL,
    maLo CHAR(10) NULL,
    CONSTRAINT CHK_ThanhTien_Ban CHECK(thanhTien>=0 AND thanhTien=soLuong*donGia),
    CONSTRAINT FK_CT_DonGhiNhanBan_DonGhiNhanBan FOREIGN KEY(maDon) REFERENCES dbo.DonGhiNhanBan(maDon),
    CONSTRAINT FK_CT_DonGhiNhanBan_LoHang FOREIGN KEY(maLo) REFERENCES dbo.LoHang(maLo)
  );
END;
IF OBJECT_ID(N'dbo.NhatKyThaoTac', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.NhatKyThaoTac (
    maNhatKy BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_NhatKyThaoTac PRIMARY KEY,
    maTK CHAR(10) NULL,
    vaiTro NVARCHAR(20) NOT NULL,
    hanhDong NVARCHAR(100) NOT NULL,
    doiTuong NVARCHAR(100) NOT NULL,
    maDoiTuong NVARCHAR(50) NULL,
    giaTriTruoc NVARCHAR(MAX) NULL,
    giaTriSau NVARCHAR(MAX) NULL,
    thoiGian DATETIME2(0) NOT NULL CONSTRAINT DF_NhatKyThaoTac_thoiGian DEFAULT(SYSDATETIME()),
    CONSTRAINT FK_NhatKyThaoTac_TaiKhoan FOREIGN KEY(maTK) REFERENCES dbo.TaiKhoan(maTK)
  );
END;
IF OBJECT_ID(N'dbo.CauHinhHeThong', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.CauHinhHeThong (
    maCauHinh NVARCHAR(100) NOT NULL CONSTRAINT PK_CauHinhHeThong PRIMARY KEY,
    giaTri NVARCHAR(4000) NOT NULL,
    kieuGiaTri VARCHAR(20) NOT NULL,
    moTa NVARCHAR(255) NOT NULL,
    capNhatLuc DATETIME2(0) NOT NULL CONSTRAINT DF_CauHinh_capNhat DEFAULT(SYSDATETIME()),
    capNhatBoi CHAR(10) NULL,
    CONSTRAINT FK_CauHinh_TaiKhoan FOREIGN KEY(capNhatBoi) REFERENCES dbo.TaiKhoan(maTK)
  );
END;
IF OBJECT_ID(N'dbo.CanhBao', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.CanhBao (
    maCanhBao BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_CanhBao PRIMARY KEY,
    loaiCanhBao VARCHAR(20) NOT NULL,
    maMyPham CHAR(10) NULL,
    maLo CHAR(10) NULL,
    trangThai NVARCHAR(50) NOT NULL,
    thoiGianPhatSinh DATETIME2(0) NOT NULL,
    CONSTRAINT FK_CanhBao_MyPham FOREIGN KEY(maMyPham) REFERENCES dbo.MyPham(maMyPham),
    CONSTRAINT FK_CanhBao_LoHang FOREIGN KEY(maLo) REFERENCES dbo.LoHang(maLo)
  );
END;
IF OBJECT_ID(N'dbo.NhatKyThongBao', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.NhatKyThongBao (
    maThongBao BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_NhatKyThongBao PRIMARY KEY,
    kenh NVARCHAR(30) NOT NULL,
    suKien NVARCHAR(100) NOT NULL,
    nguoiNhan NVARCHAR(100) NULL,
    yeuCau NVARCHAR(MAX) NULL,
    phanHoi NVARCHAR(MAX) NULL,
    trangThai NVARCHAR(30) NOT NULL,
    soLanThu INT NOT NULL CONSTRAINT DF_NhatKyThongBao_soLan DEFAULT(0),
    taoLuc DATETIME2(0) NOT NULL CONSTRAINT DF_NhatKyThongBao_tao DEFAULT(SYSDATETIME()),
    capNhatLuc DATETIME2(0) NOT NULL CONSTRAINT DF_NhatKyThongBao_capNhat DEFAULT(SYSDATETIME())
  );
END;
IF OBJECT_ID(N'dbo.LichSuMigration', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.LichSuMigration (
    tenMigration NVARCHAR(255) NOT NULL CONSTRAINT PK_LichSuMigration PRIMARY KEY,
    thoiGian DATETIME2(0) NOT NULL CONSTRAINT DF_LichSuMigration_thoiGian DEFAULT(SYSDATETIME())
  );
END;
IF NOT EXISTS(SELECT 1 FROM sys.indexes WHERE name=N'IX_LoHang_MyPham_HSD' AND object_id=OBJECT_ID(N'dbo.LoHang'))
  CREATE INDEX IX_LoHang_MyPham_HSD ON dbo.LoHang(maMyPham,hanSuDung,ngayNhap);
IF NOT EXISTS(SELECT 1 FROM sys.indexes WHERE name=N'IX_LichHen_Ngay_Gio' AND object_id=OBJECT_ID(N'dbo.LichHen'))
  CREATE INDEX IX_LichHen_Ngay_Gio ON dbo.LichHen(ngayHen,gioBatDau,gioKetThuc,trangThai);
