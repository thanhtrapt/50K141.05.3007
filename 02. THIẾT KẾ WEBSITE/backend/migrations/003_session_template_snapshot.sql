/* Keep historical package sessions stable when a service template changes. */
IF COL_LENGTH(N'dbo.CT_DonMua',N'tenBuoiSnapshot') IS NULL
  ALTER TABLE dbo.CT_DonMua ADD tenBuoiSnapshot NVARCHAR(20) NULL;
IF COL_LENGTH(N'dbo.CT_DonMua',N'kyThuatSnapshot') IS NULL
  ALTER TABLE dbo.CT_DonMua ADD kyThuatSnapshot NVARCHAR(255) NULL;
IF COL_LENGTH(N'dbo.CT_DonMua',N'thoiGianThucHienSnapshot') IS NULL
  ALTER TABLE dbo.CT_DonMua ADD thoiGianThucHienSnapshot INT NULL;
IF COL_LENGTH(N'dbo.CT_DonMua',N'myPhamSDSnapshot') IS NULL
  ALTER TABLE dbo.CT_DonMua ADD myPhamSDSnapshot NVARCHAR(200) NULL;

EXEC sys.sp_executesql N'UPDATE purchaseSession SET
  tenBuoiSnapshot=COALESCE(purchaseSession.tenBuoiSnapshot,serviceSession.tenBuoi),
  kyThuatSnapshot=COALESCE(purchaseSession.kyThuatSnapshot,serviceSession.kyThuat),
  thoiGianThucHienSnapshot=COALESCE(purchaseSession.thoiGianThucHienSnapshot,serviceSession.thoiGianThucHien),
  myPhamSDSnapshot=COALESCE(purchaseSession.myPhamSDSnapshot,serviceSession.myPhamSD)
FROM dbo.CT_DonMua purchaseSession
JOIN dbo.CT_DichVu serviceSession ON serviceSession.maCT_DichVu=purchaseSession.maCT_DichVu';
