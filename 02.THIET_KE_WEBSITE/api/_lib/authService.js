import { getPool, dbTypes, inTransaction, requestFor } from './database.js';
import { verifyPassword, signToken, verifyToken } from './security.js';
import { nextCode } from './repositories.js';
import { nowIso } from './utils.js';
import { AppError, badRequest, unauthorized } from './errors.js';

const phonePattern=/^0(?:3|5|7|8|9)\d{8}$/;
const OWNER_ROLE='Chủ Spa';

// Cấu trúc thực tế trên Supabase PostgreSQL:
//   taikhoan(matk, tendangnhap, matkhau, vaitro)
//   lichsudangnhap(malichsu, thoigiandangnhap, trangthaidangnhap, matk)
// Không có trangthai/hoTen nên không kiểm tra hay truy vấn các cột đó.
function toUser(row) {
  const phone=String(row.tendangnhap ?? '').trim();
  const roleName=String(row.vaitro ?? '').trim();
  const name=phone;
  return {
    id:String(row.matk ?? '').trim(),
    phone,
    name,
    full_name:name,
    role:roleName===OWNER_ROLE?'OWNER':'STAFF',
    roleName,
  };
}

async function recordLogin({accountId,phone,success}) {
  try {
    await inTransaction(async(transaction)=>{
      const maLichSu=await nextCode('LS',transaction);
      await requestFor(transaction)
        .input('id',dbTypes.Char(10),maLichSu)
        .input('time',dbTypes.DateTime2,nowIso())
        .input('status',dbTypes.NVarChar(20),success?'Thành công':'Thất bại')
        .input('accountId',dbTypes.Char(10),success?accountId:null)
        .query(`INSERT INTO public.lichsudangnhap(malichsu,thoigiandangnhap,trangthaidangnhap,matk)
          VALUES(@id,@time,@status,@accountId)`);
    });
  } catch (error) {
    // Lỗi ghi lịch sử không được che khuất kết quả xác thực và không làm hỏng
    // phản hồi đăng nhập (đặc biệt là trường hợp sai thông tin đăng nhập).
    console.error(`Không ghi được lịch sử đăng nhập cho "${phone}":`, error.message);
  }
}

export async function login(body,req) {
  const phone=String(body?.phone ?? body?.tenDangNhap ?? '').trim();
  const password=String(body?.password ?? body?.matKhau ?? '');
  const fieldErrors=[];
  if(!phone) fieldErrors.push({field:'phone',message:'Tên đăng nhập không được bỏ trống'});
  if(!password) fieldErrors.push({field:'password',message:'Mật khẩu không được bỏ trống'});
  if(fieldErrors.length) throw badRequest('Thông tin đăng nhập chưa hợp lệ.',fieldErrors);
  if(!phonePattern.test(phone)) throw badRequest('Thông tin đăng nhập chưa hợp lệ.',[{field:'phone',message:'Số điện thoại không hợp lệ'}]);
  if(password.length<8||password.length>20) throw badRequest('Thông tin đăng nhập chưa hợp lệ.',[{field:'password',message:'Mật khẩu phải dài từ 8 đến 20 ký tự'}]);
  const result=await getPool().request().input('phone',dbTypes.VarChar(10),phone)
    .query(`SELECT matk,tendangnhap,matkhau,vaitro FROM public.taikhoan
      WHERE tendangnhap=@phone LIMIT 1`);
  const row=result.recordset[0];
  let valid=false;
  if(row?.matkhau){
    try { valid=await verifyPassword(password,row.matkhau); }
    catch { valid=false; } // Hash lưu trữ hỏng/không đúng định dạng → coi như sai mật khẩu.
  }
  await recordLogin({accountId:valid?String(row.matk).trim():null,phone,success:valid});
  if(!valid) throw new AppError(401,'AUTH_INVALID','Sai số điện thoại hoặc mật khẩu.');
  const user=toUser(row);
  return {message:'Đăng nhập thành công',accessToken:signToken(user),tokenType:'Bearer',expiresIn:process.env.JWT_EXPIRES_IN||'8h',user};
}

export async function authenticate(req) {
  const header=req.headers.authorization || '';
  const token=header.startsWith('Bearer ')?header.slice(7):'';
  const payload=verifyToken(token);
  if(!payload) throw unauthorized();
  const result=await getPool().request().input('id',dbTypes.Char(10),payload.sub)
    .query('SELECT matk,tendangnhap,vaitro FROM public.taikhoan WHERE matk=@id');
  const row=result.recordset[0];
  if(!row) throw unauthorized();
  req.user=toUser(row);
  return req.user;
}
