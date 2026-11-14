IF OBJECT_ID(N'dbo.TaiLieuTongHop',N'U') IS NULL
BEGIN
  CREATE TABLE dbo.TaiLieuTongHop(
    maTaiLieu BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_TaiLieuTongHop PRIMARY KEY,
    maDonMua CHAR(10) NOT NULL,
    maCT_DonMua CHAR(10) NOT NULL,
    loaiTaiLieu NVARCHAR(20) NOT NULL CONSTRAINT CK_TaiLieuTongHop_loai CHECK(loaiTaiLieu IN(N'Giữa liệu trình',N'Cuối liệu trình')),
    tenTep NVARCHAR(255) NOT NULL,
    duongDan NVARCHAR(500) NOT NULL,
    thoiGianTao DATETIME2(0) NOT NULL CONSTRAINT DF_TaiLieuTongHop_tao DEFAULT(SYSDATETIME()),
    CONSTRAINT FK_TaiLieuTongHop_DonMua FOREIGN KEY(maDonMua) REFERENCES dbo.DonMuaDV(maDonMua),
    CONSTRAINT FK_TaiLieuTongHop_CTDonMua FOREIGN KEY(maCT_DonMua) REFERENCES dbo.CT_DonMua(maCT_DonMua)
  );
END;
IF COL_LENGTH(N'dbo.NhatKyThongBao',N'maCT_DonMua') IS NULL
  ALTER TABLE dbo.NhatKyThongBao ADD maCT_DonMua CHAR(10) NULL;
IF NOT EXISTS(SELECT 1 FROM sys.foreign_keys WHERE name=N'FK_NhatKyThongBao_CTDonMua')
  ALTER TABLE dbo.NhatKyThongBao ADD CONSTRAINT FK_NhatKyThongBao_CTDonMua FOREIGN KEY(maCT_DonMua) REFERENCES dbo.CT_DonMua(maCT_DonMua);
IF NOT EXISTS(SELECT 1 FROM sys.indexes WHERE name=N'UX_TaiLieuTongHop_SessionType' AND object_id=OBJECT_ID(N'dbo.TaiLieuTongHop'))
  CREATE UNIQUE INDEX UX_TaiLieuTongHop_SessionType ON dbo.TaiLieuTongHop(maCT_DonMua,loaiTaiLieu);
IF NOT EXISTS(SELECT 1 FROM sys.indexes WHERE name=N'UX_NhatKyThongBao_SessionEvent' AND object_id=OBJECT_ID(N'dbo.NhatKyThongBao'))
  EXEC sys.sp_executesql N'CREATE UNIQUE INDEX UX_NhatKyThongBao_SessionEvent ON dbo.NhatKyThongBao(maCT_DonMua,suKien) WHERE maCT_DonMua IS NOT NULL';
IF NOT EXISTS(SELECT 1 FROM sys.indexes WHERE name=N'IX_NhatKyThongBao_Queue' AND object_id=OBJECT_ID(N'dbo.NhatKyThongBao'))
  CREATE INDEX IX_NhatKyThongBao_Queue ON dbo.NhatKyThongBao(trangThai,thoiGianGuiDuKien,maThongBao);

IF NOT EXISTS(SELECT 1 FROM dbo.CauHinhHeThong WHERE maCauHinh=N'LAST_EXPIRY_SCAN_DATE')
  INSERT dbo.CauHinhHeThong(maCauHinh,giaTri,kieuGiaTri,moTa)
  VALUES(N'LAST_EXPIRY_SCAN_DATE',N'','date',N'Ngày chạy quét hạn sử dụng gần nhất');
