IF COL_LENGTH(N'dbo.DonMuaDV',N'ngayKetThuc') IS NULL
  ALTER TABLE dbo.DonMuaDV ADD ngayKetThuc DATETIME2(0) NULL;
IF COL_LENGTH(N'dbo.DanhGia',N'maDonMua') IS NULL
  ALTER TABLE dbo.DanhGia ADD maDonMua CHAR(10) NULL;
IF COL_LENGTH(N'dbo.DanhGia',N'maTK') IS NULL
  ALTER TABLE dbo.DanhGia ADD maTK CHAR(10) NULL;
IF NOT EXISTS(SELECT 1 FROM sys.foreign_keys WHERE name=N'FK_DanhGia_DonMuaDV')
  ALTER TABLE dbo.DanhGia ADD CONSTRAINT FK_DanhGia_DonMuaDV FOREIGN KEY(maDonMua) REFERENCES dbo.DonMuaDV(maDonMua);
IF NOT EXISTS(SELECT 1 FROM sys.foreign_keys WHERE name=N'FK_DanhGia_TaiKhoan')
  ALTER TABLE dbo.DanhGia ADD CONSTRAINT FK_DanhGia_TaiKhoan FOREIGN KEY(maTK) REFERENCES dbo.TaiKhoan(maTK);
/* Apply the approved non-negative sale totals/prices to databases created from the group's original schema. */
DECLARE @saleChecks NVARCHAR(MAX)=N'';
SELECT @saleChecks=@saleChecks+N'ALTER TABLE dbo.DonGhiNhanBan DROP CONSTRAINT '+QUOTENAME(cc.name)+N';'
FROM sys.check_constraints cc WHERE cc.parent_object_id=OBJECT_ID(N'dbo.DonGhiNhanBan') AND cc.definition LIKE N'%tongTien%';
IF LEN(@saleChecks)>0 EXEC sys.sp_executesql @saleChecks;
ALTER TABLE dbo.DonGhiNhanBan ADD CONSTRAINT CK_DonGhiNhanBan_tongTien_004 CHECK(tongTien>=0);

DECLARE @saleLineChecks NVARCHAR(MAX)=N'';
SELECT @saleLineChecks=@saleLineChecks+N'ALTER TABLE dbo.CT_DonGhiNhanBan DROP CONSTRAINT '+QUOTENAME(cc.name)+N';'
FROM sys.check_constraints cc WHERE cc.parent_object_id=OBJECT_ID(N'dbo.CT_DonGhiNhanBan') AND (cc.definition LIKE N'%donGia%' OR cc.definition LIKE N'%thanhTien%');
IF LEN(@saleLineChecks)>0 EXEC sys.sp_executesql @saleLineChecks;
ALTER TABLE dbo.CT_DonGhiNhanBan ADD CONSTRAINT CK_CT_DonGhiNhanBan_donGia_004 CHECK(donGia>=0);
ALTER TABLE dbo.CT_DonGhiNhanBan ADD CONSTRAINT CK_CT_DonGhiNhanBan_thanhTien_004 CHECK(thanhTien>=0 AND thanhTien=soLuong*donGia);
