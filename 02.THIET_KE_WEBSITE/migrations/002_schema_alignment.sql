/* Keep the group's table and column names. Expand only columns needed by the approved auth/audit/config rules. */
DECLARE @dropCheck NVARCHAR(MAX)=N'';
SELECT @dropCheck=@dropCheck+N'ALTER TABLE dbo.TaiKhoan DROP CONSTRAINT '+QUOTENAME(cc.name)+N';'
FROM sys.check_constraints cc WHERE cc.parent_object_id=OBJECT_ID(N'dbo.TaiKhoan') AND cc.definition LIKE N'%matKhau%';
IF LEN(@dropCheck)>0 EXEC sys.sp_executesql @dropCheck;
IF COL_LENGTH(N'dbo.TaiKhoan',N'trangThai') IS NULL ALTER TABLE dbo.TaiKhoan ADD trangThai BIT NOT NULL CONSTRAINT DF_TaiKhoan_trangThai_002 DEFAULT(1);
IF COL_LENGTH(N'dbo.TaiKhoan',N'hoTen') IS NULL ALTER TABLE dbo.TaiKhoan ADD hoTen NVARCHAR(100) NOT NULL CONSTRAINT DF_TaiKhoan_hoTen_002 DEFAULT(N'');
IF COL_LENGTH(N'dbo.TaiKhoan',N'ngayTao') IS NULL ALTER TABLE dbo.TaiKhoan ADD ngayTao DATETIME2(0) NOT NULL CONSTRAINT DF_TaiKhoan_ngayTao_002 DEFAULT(SYSDATETIME());
ALTER TABLE dbo.TaiKhoan ALTER COLUMN matKhau VARCHAR(255) NOT NULL;

IF COL_LENGTH(N'dbo.LichSuDangNhap',N'tenDangNhap') IS NULL ALTER TABLE dbo.LichSuDangNhap ADD tenDangNhap VARCHAR(10) NOT NULL CONSTRAINT DF_LichSuDangNhap_ten_002 DEFAULT('');
IF COL_LENGTH(N'dbo.LichSuDangNhap',N'diaChiIP') IS NULL ALTER TABLE dbo.LichSuDangNhap ADD diaChiIP VARCHAR(45) NULL;
IF COL_LENGTH(N'dbo.LichSuDangNhap',N'userAgent') IS NULL ALTER TABLE dbo.LichSuDangNhap ADD userAgent NVARCHAR(500) NULL;
IF COL_LENGTH(N'dbo.MyPham',N'trangThai') IS NULL ALTER TABLE dbo.MyPham ADD trangThai BIT NOT NULL CONSTRAINT DF_MyPham_trangThai_002 DEFAULT(1);
DECLARE @dropPriceCheck NVARCHAR(MAX)=N'';
SELECT @dropPriceCheck=@dropPriceCheck+N'ALTER TABLE dbo.MyPham DROP CONSTRAINT '+QUOTENAME(cc.name)+N';'
FROM sys.check_constraints cc WHERE cc.parent_object_id=OBJECT_ID(N'dbo.MyPham') AND cc.definition LIKE N'%giaBan%';
IF LEN(@dropPriceCheck)>0 EXEC sys.sp_executesql @dropPriceCheck;
ALTER TABLE dbo.MyPham ALTER COLUMN giaBan MONEY NOT NULL;
ALTER TABLE dbo.MyPham ADD CONSTRAINT CK_MyPham_giaBan_002 CHECK(giaBan>=0);
IF COL_LENGTH(N'dbo.LoHang',N'ngayNhap') IS NULL ALTER TABLE dbo.LoHang ADD ngayNhap DATE NOT NULL CONSTRAINT DF_LoHang_ngayNhap_002 DEFAULT(CONVERT(date,GETDATE()));
IF COL_LENGTH(N'dbo.DonMuaDV',N'giaMua') IS NULL ALTER TABLE dbo.DonMuaDV ADD giaMua MONEY NOT NULL CONSTRAINT DF_DonMuaDV_giaMua_002 DEFAULT(0);
IF COL_LENGTH(N'dbo.DichVu',N'trangThai') IS NULL ALTER TABLE dbo.DichVu ADD trangThai BIT NOT NULL CONSTRAINT DF_DichVu_trangThai_002 DEFAULT(1);
IF COL_LENGTH(N'dbo.KhachHang',N'ngayTao') IS NULL ALTER TABLE dbo.KhachHang ADD ngayTao DATETIME2(0) NOT NULL CONSTRAINT DF_KhachHang_ngayTao_002 DEFAULT(SYSDATETIME());
IF NOT EXISTS(SELECT 1 FROM sys.indexes WHERE name=N'UQ_KhachHang_soDienThoai' AND object_id=OBJECT_ID(N'dbo.KhachHang'))
  CREATE UNIQUE INDEX UQ_KhachHang_soDienThoai ON dbo.KhachHang(soDienThoai);
