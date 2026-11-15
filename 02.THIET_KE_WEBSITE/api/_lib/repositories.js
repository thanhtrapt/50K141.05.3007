import { getPool, requestFor, dbTypes } from './database.js';
import { nowIso } from './utils.js';

const trim = (row) => Object.fromEntries(Object.entries(row || {}).map(([key,value]) => [key, typeof value === 'string' ? value.trimEnd() : value]));

export async function queryOne(sql, bind = {}) {
  const request=getPool().request();
  for(const [key,value] of Object.entries(bind)) request.input(key,value);
  const result=await request.query(sql);
  return result.recordset[0] ? trim(result.recordset[0]) : null;
}

export async function queryMany(sql, bind = {}) {
  const request=getPool().request();
  for(const [key,value] of Object.entries(bind)) request.input(key,value);
  const result=await request.query(sql);
  return result.recordset.map(trim);
}

export async function insertAudit({transaction,user,action,entity,entityId,before,after}) {
  const r=requestFor(transaction);
  r.input('maTK',dbTypes.Char(10),user?.id || null).input('role',dbTypes.NVarChar(20),user?.role || 'SYSTEM')
    .input('action',dbTypes.NVarChar(100),action).input('entity',dbTypes.NVarChar(100),entity)
    .input('entityId',dbTypes.NVarChar(50),entityId == null ? null : String(entityId))
    .input('before',dbTypes.NVarChar(dbTypes.MAX),before == null ? null : JSON.stringify(before))
    .input('after',dbTypes.NVarChar(dbTypes.MAX),after == null ? null : JSON.stringify(after));
  await r.query(`INSERT INTO dbo.NhatKyThaoTac(maTK,vaiTro,hanhDong,doiTuong,maDoiTuong,giaTriTruoc,giaTriSau)
    VALUES(@maTK,@role,@action,@entity,@entityId,@before,@after)`);
}

const codeTables={
  LS:{ table:'LichSuDangNhap', column:'maLichSu' },
  TK:{ table:'TaiKhoan', column:'maTK' }, KH:{ table:'KhachHang', column:'maKhachHang' }, DV:{ table:'DichVu', column:'maDichVu' },
  MP:{ table:'MyPham', column:'maMyPham' }, PN:{ table:'PhieuNhapKho', column:'maPhieuNhap' }, PX:{ table:'PhieuXuatKho', column:'maPhieuXuat' },
  LHD:{ table:'DonMuaDV', column:'maDonMua' }, LH:{ table:'LichHen', column:'maLichHen' }, DG:{ table:'DanhGia', column:'maDanhGia' },
  PNB:{ table:'DonGhiNhanBan', column:'maDon' }, CI:{ table:'CT_PhieuNhapKho', column:'maCT_PhieuNhap' }, CX:{ table:'CT_PhieuXuatKho', column:'maCT_PhieuXuat' },
  CB:{ table:'CT_DonGhiNhanBan', column:'maCT_Don' }, CD:{ table:'CT_DichVu', column:'maCT_DichVu' }, CM:{ table:'CT_DonMua', column:'maCT_DonMua' },
};

export async function nextCode(prefix, transaction) {
  const config=codeTables[prefix];
  if(!config) throw new Error('Mã định danh không được cấu hình.');
  const suffixWidth=10-prefix.length;
  if(suffixWidth<1)throw new Error('Tiền tố mã định danh vượt quá độ dài cột.');
  const r=requestFor(transaction);
  const result=await r.query(`SELECT COALESCE(MAX(NULLIF(regexp_replace(RIGHT(RTRIM(${config.column}),${suffixWidth}), '[^0-9]', '', 'g'), '')::integer),0)+1 AS "nextValue"
    FROM public."${config.table}"`);
  return formatEntityCode(prefix,result.recordset[0].nextValue);
}

export function formatEntityCode(prefix,sequence,width=10) {
  const suffixWidth=width-String(prefix).length;const value=Number(sequence);
  if(!String(prefix)||suffixWidth<1||!Number.isSafeInteger(value)||value<1||value>=10**suffixWidth)
    throw new Error('Tiền tố hoặc số thứ tự mã định danh không hợp lệ.');
  return `${prefix}${String(value).padStart(suffixWidth,'0')}`;
}

export async function nextLotCode(receiptDate, transaction) {
  const day=receiptDate.slice(8,10)+receiptDate.slice(5,7)+receiptDate.slice(2,4);
  const r=requestFor(transaction);
  const result=await r.input('prefix',dbTypes.VarChar(7),`${day}-`).query(`SELECT COALESCE(MAX(NULLIF(regexp_replace(RIGHT(RTRIM(maLo),3), '[^0-9]', '', 'g'), '')::integer),0)+1 AS "nextValue"
    FROM public."LoHang" WHERE maLo LIKE @prefix || '%'`);
  return formatLotCode(receiptDate,result.recordset[0].nextValue);
}

export function formatLotCode(receiptDate,counter) {
  const date=typeof receiptDate==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(receiptDate)?new Date(`${receiptDate}T00:00:00Z`):null;
  if(!date||Number.isNaN(date.valueOf())||date.toISOString().slice(0,10)!==receiptDate||!Number.isSafeInteger(Number(counter))||Number(counter)<1)
    throw new Error('Ngày nhập hoặc số thứ tự lô không hợp lệ.');
  const day=`${receiptDate.slice(8,10)}${receiptDate.slice(5,7)}${receiptDate.slice(2,4)}`;
  return `${day}-${String(Number(counter)).padStart(3,'0')}`;
}

export async function getConfigMap() {
  const rows=await queryMany('SELECT maCauHinh AS [key],giaTri AS value,kieuGiaTri AS valueType,moTa AS description,capNhatLuc AS updatedAt FROM dbo.CauHinhHeThong ORDER BY maCauHinh');
  return Object.fromEntries(rows.map(row=>[row.key,{...row,value:row.valueType==='number'?Number(row.value):row.value}]));
}

export { trim };
