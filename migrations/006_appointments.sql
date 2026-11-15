IF OBJECT_ID(N'dbo.LichSuHuyLich',N'U') IS NULL
BEGIN
  CREATE TABLE dbo.LichSuHuyLich(
    maHuy BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_LichSuHuyLich PRIMARY KEY,
    maLichHen CHAR(10) NOT NULL,
    maKhachHang CHAR(10) NOT NULL,
    maTK CHAR(10) NOT NULL,
    thoiGianHuy DATETIME2(0) NOT NULL CONSTRAINT DF_LichSuHuyLich_thoiGian DEFAULT(SYSDATETIME()),
    lyDo NVARCHAR(200) NULL,
    duLieuTruoc NVARCHAR(MAX) NOT NULL,
    CONSTRAINT FK_LichSuHuyLich_LichHen FOREIGN KEY(maLichHen) REFERENCES dbo.LichHen(maLichHen),
    CONSTRAINT FK_LichSuHuyLich_KhachHang FOREIGN KEY(maKhachHang) REFERENCES dbo.KhachHang(maKhachHang),
    CONSTRAINT FK_LichSuHuyLich_TaiKhoan FOREIGN KEY(maTK) REFERENCES dbo.TaiKhoan(maTK)
  );
END;
IF COL_LENGTH(N'dbo.NhatKyThongBao',N'maLichHen') IS NULL
  ALTER TABLE dbo.NhatKyThongBao ADD maLichHen CHAR(10) NULL;
IF COL_LENGTH(N'dbo.NhatKyThongBao',N'thoiGianGuiDuKien') IS NULL
  ALTER TABLE dbo.NhatKyThongBao ADD thoiGianGuiDuKien DATETIME2(0) NULL;
IF NOT EXISTS(SELECT 1 FROM sys.foreign_keys WHERE name=N'FK_NhatKyThongBao_LichHen')
  ALTER TABLE dbo.NhatKyThongBao ADD CONSTRAINT FK_NhatKyThongBao_LichHen FOREIGN KEY(maLichHen) REFERENCES dbo.LichHen(maLichHen);
IF NOT EXISTS(SELECT 1 FROM sys.indexes WHERE name=N'UX_NhatKyThongBao_LichHenPending' AND object_id=OBJECT_ID(N'dbo.NhatKyThongBao'))
  EXEC sys.sp_executesql N'CREATE UNIQUE INDEX UX_NhatKyThongBao_LichHenPending ON dbo.NhatKyThongBao(maLichHen,suKien)
    WHERE maLichHen IS NOT NULL AND trangThai=N''Chờ gửi''';
IF NOT EXISTS(SELECT 1 FROM sys.indexes WHERE name=N'IX_LichHen_KhachNgay' AND object_id=OBJECT_ID(N'dbo.LichHen'))
  CREATE INDEX IX_LichHen_KhachNgay ON dbo.LichHen(maKhachHang,ngayHen,trangThai);
