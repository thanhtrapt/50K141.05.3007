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

// Schema thật (Supabase) không có bảng NhatKyThaoTac. Giữ nguyên chữ ký hàm để
// các call-site hiện tại không phải sửa, nhưng không ghi audit để tránh 42P01.
export async function insertAudit() {
  return { skipped: true, reason: 'NhatKyThaoTac is not part of the current schema' };
}

const codeTables={
  LS:{ table:'LichSuDangNhap', column:'maLichSu' },
  TK:{ table:'TaiKhoan', column:'maTK' }, KH:{ table:'KhachHang', column:'maKhachHang' }, DV:{ table:'DichVu', column:'maDichVu' },
  MP:{ table:'MyPham', column:'maMyPham' }, PN:{ table:'PhieuNhapKho', column:'maPhieuNhap' }, PX:{ table:'PhieuXuatKho', column:'maPhieuXuat' },
  LHD:{ table:'DonMuaDV', column:'maDonMua' }, LH:{ table:'LichHen', column:'maLichHen' }, DG:{ table:'DanhGia', column:'maDanhGia' },
  PNB:{ table:'DonGhiNhanBan', column:'maDon' }, CI:{ table:'CT_PhieuNhapKho', column:'maCT_PhieuNhap' }, CX:{ table:'CT_PhieuXuatKho', column:'maCT_PhieuXuat' },
  CB:{ table:'CT_DonGhiNhanBan', column:'maCT_Don' }, CD:{ table:'CT_DichVu', column:'maCT_DichVu' }, CM:{ table:'CT_DonMua', column:'maCT_DonMua' },
};

// Khóa tư vấn theo phạm vi sinh mã. Khóa tự giải phóng khi transaction kết thúc
// (COMMIT/ROLLBACK), nên không bị treo nếu giao dịch thất bại.
async function lockCodeScope(request, scope) {
  await request.input('lockName',dbTypes.VarChar(64),scope)
    .query("SELECT pg_advisory_xact_lock(hashtext(@lockName)::bigint) AS \"locked\"");
}

export async function nextCode(prefix, transaction) {
  const config=codeTables[prefix];
  if(!config) throw new Error('Mã định danh không được cấu hình.');
  const suffixWidth=10-prefix.length;
  if(suffixWidth<1)throw new Error('Tiền tố mã định danh vượt quá độ dài cột.');
  const r=requestFor(transaction);
  // Tên bảng/cột để nguyên dạng viết hoa trong cấu hình; lớp PostgreSQL sẽ
  // chuyển thành identifier không quote (lowercase) đúng như schema Supabase.
  // Khóa + đọc MAX trong cùng transaction bảo đảm hai lần tạo đồng thời không
  // nhận cùng một số thứ tự; nếu vẫn xảy ra xung đột tuần tự hóa, inTransaction
  // sẽ tự chạy lại giao dịch.
  if(transaction) await lockCodeScope(r,`code:${config.table}`);
  const result=await r.query(`SELECT COALESCE(MAX(NULLIF(regexp_replace(RIGHT(RTRIM(${config.column}),${suffixWidth}), '[^0-9]', '', 'g'), '')::integer),0)+1 AS "nextValue"
    FROM public.${config.table}`);
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
  if(transaction) await lockCodeScope(r,'code:LoHang');
  const result=await r.input('prefix',dbTypes.VarChar(7),`${day}-`).query(`SELECT COALESCE(MAX(NULLIF(regexp_replace(RIGHT(RTRIM(maLo),3), '[^0-9]', '', 'g'), '')::integer),0)+1 AS "nextValue"
    FROM public.LoHang WHERE maLo LIKE @prefix || '%'`);
  return formatLotCode(receiptDate,result.recordset[0].nextValue);
}

export function formatLotCode(receiptDate,counter) {
  const date=typeof receiptDate==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(receiptDate)?new Date(`${receiptDate}T00:00:00Z`):null;
  if(!date||Number.isNaN(date.valueOf())||date.toISOString().slice(0,10)!==receiptDate||!Number.isSafeInteger(Number(counter))||Number(counter)<1)
    throw new Error('Ngày nhập hoặc số thứ tự lô không hợp lệ.');
  const day=`${receiptDate.slice(8,10)}${receiptDate.slice(5,7)}${receiptDate.slice(2,4)}`;
  return `${day}-${String(Number(counter)).padStart(3,'0')}`;
}

// Bảng CauHinhHeThong không có trong schema thật; trả về rỗng để nơi gọi dùng
// giá trị mặc định thay vì phát sinh lỗi 42P01.
export async function getConfigMap() {
  return {};
}

export { trim };
