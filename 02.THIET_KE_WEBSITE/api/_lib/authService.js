import { getPool, dbTypes, inTransaction, requestFor } from './database.js';
import { verifyPassword, signToken, verifyToken } from './security.js';
import { nextCode, trim } from './repositories.js';
import { nowIso } from './utils.js';
import { AppError, badRequest, unauthorized } from './errors.js';

const phonePattern=/^0(?:3|5|7|8|9)\d{8}$/;

async function recordLogin({user,phone,success,req}) {
  await inTransaction(async(transaction)=>{
    const maLichSu=await nextCode('LS',transaction);
    await requestFor(transaction).input('id',dbTypes.Char(10),maLichSu).input('time',dbTypes.DateTime2,nowIso())
      .input('status',dbTypes.NVarChar(20),success?'Thành công':'Thất bại')
      .input('userId',dbTypes.Char(10),user?.maTK || null).input('phone',dbTypes.VarChar(10),phone)
      .input('ip',dbTypes.VarChar(45),req.socket?.remoteAddress || null).input('agent',dbTypes.NVarChar(500),req.headers['user-agent'] || null)
      .query(`INSERT INTO dbo.LichSuDangNhap(maLichSu,thoiGianDangNhap,trangThaiDangNhap,maTK,tenDangNhap,diaChiIP,userAgent)
        VALUES(@id,@time,@status,@userId,@phone,@ip,@agent)`);
  });
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
  const result=await getPool().request().input('phone',dbTypes.VarChar(10),phone).query(`SELECT TOP(1) maTK,tenDangNhap,matKhau,vaiTro,trangThai,hoTen
    FROM dbo.TaiKhoan WHERE tenDangNhap=@phone`);
  const row=result.recordset[0];
  const valid=Boolean(row && row.trangThai && await verifyPassword(password,row.matKhau));
  await recordLogin({user:valid?row:null,phone,success:valid,req});
  if(!valid) throw new AppError(401,'AUTH_INVALID','Tên đăng nhập hoặc mật khẩu không chính xác');
  const user={id:row.maTK.trim(),phone:row.tenDangNhap,name:row.hoTen,role:row.vaiTro==='Chủ Spa'?'OWNER':'STAFF',roleName:row.vaiTro};
  return {message:'Đăng nhập thành công',accessToken:signToken(user),tokenType:'Bearer',expiresIn:process.env.JWT_EXPIRES_IN||'8h',user};
}

export async function authenticate(req) {
  const header=req.headers.authorization || '';
  const token=header.startsWith('Bearer ')?header.slice(7):'';
  const payload=verifyToken(token);
  if(!payload) throw unauthorized();
  const result=await getPool().request().input('id',dbTypes.Char(10),payload.sub)
    .query('SELECT maTK,tenDangNhap,vaiTro,trangThai,hoTen FROM dbo.TaiKhoan WHERE maTK=@id');
  const row=result.recordset[0];
  if(!row||!row.trangThai) throw unauthorized();
  req.user={id:row.maTK.trim(),phone:row.tenDangNhap,role:row.vaiTro==='Chủ Spa'?'OWNER':'STAFF',roleName:row.vaiTro,full_name:row.hoTen};
  return req.user;
}
