import { getPool,inTransaction,requestFor,dbTypes } from './database.js';
import { AppError,badRequest,notFound } from './errors.js';
import { insertAudit,nextCode } from './repositories.js';
import { normalizeVietnamese,paginate,parseDate } from './utils.js';
import { enqueueNotification,createConfirmationUrl } from './notificationService.js';
import { config } from './config.js';

const phonePattern=/^0[0-9]{9}$/;
const phoneMessage='Số điện thoại không hợp lệ';
const positiveInteger=value=>typeof value!=='boolean'&&String(value??'').trim()!==''&&/^\d+$/.test(String(value).trim())&&Number.isSafeInteger(Number(value))&&Number(value)>0?Number(value):null;
const money=positiveInteger;
const quantity=positiveInteger;
const dateText=value=>value instanceof Date?new Intl.DateTimeFormat('sv-SE',{timeZone:'UTC'}).format(value):String(value).slice(0,10);
const todayVn=()=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Ho_Chi_Minh'}).format(new Date());
const error=(status,code,message,fieldErrors=[])=>new AppError(status,code,message,fieldErrors);

export function customerFields(body,{partial=false}={}) {
  if(!body||typeof body!=='object'||Array.isArray(body))body={};
  const result={};const errors=[];
  const name=body.name??body.hoTen;
  const dob=body.dateOfBirth??body.ngaySinh;
  const phone=body.phone??body.soDienThoai;
  const cancellationCount=body.cancellationCount??body.soLanHuyLich;
  if(!partial||name!==undefined) {
    const value=String(name??'').trim();
    if(!value)errors.push({field:'name',message:'Họ và tên không được bỏ trống'});
    else if(value.length>50)errors.push({field:'name',message:'Họ và tên không được vượt quá 50 ký tự'});
    result.hoTen=value;
  }
  if(!partial||dob!==undefined) {
    const value=String(dob??'');
    const parsed=/^\d{4}-\d{2}-\d{2}$/.test(value)?new Date(`${value}T00:00:00Z`):null;
    if(!value)errors.push({field:'dateOfBirth',message:'Ngày sinh không được bỏ trống'});
    else if(!parsed||Number.isNaN(parsed.valueOf())||parsed.toISOString().slice(0,10)!==value||value>=todayVn())errors.push({field:'dateOfBirth',message:'Ngày sinh không hợp lệ'});
    else result.ngaySinh=value;
  }
  if(!partial||phone!==undefined) {
    const value=String(phone??'').trim();
    if(!value)errors.push({field:'phone',message:'Số điện thoại không được bỏ trống'});
    else if(!phonePattern.test(value))errors.push({field:'phone',message:phoneMessage});
    else result.soDienThoai=value;
  }
  if(partial&&cancellationCount!==undefined) {
    const value=String(cancellationCount).trim();
    if(!/^\d+$/.test(value)||!Number.isSafeInteger(Number(value)))errors.push({field:'cancellationCount',message:'Số lần hủy lịch phải là số nguyên không âm'});
    else result.soLanHuyLich=Number(value);
  }
  if(errors.length)throw error(400,'VALIDATION_ERROR','Thông tin khách hàng chưa hợp lệ.',errors);
  return result;
}

async function findCustomer(id,transaction) {
  const row=(await requestFor(transaction).input('id',dbTypes.Char(10),id).query(`SELECT maKhachHang AS id,hoTen AS name,ngaySinh AS dateOfBirth,soDienThoai AS phone,
    soLanHuyLich AS cancellationCount FROM dbo.KhachHang WHERE maKhachHang=@id`)).recordset[0];
  if(!row)throw notFound('Không tìm thấy khách hàng phù hợp!');
  return {...row,id:row.id.trim(),dateOfBirth:dateText(row.dateOfBirth),cancellationCount:Number(row.cancellationCount)};
}

async function setSupabaseAuthContext(transaction,user) {
  const identity=(await requestFor(transaction).input('accountId',dbTypes.Char(10),user.id)
    .query('SELECT auth_user_id AS authUserId FROM public.taikhoan WHERE matk=@accountId LIMIT 1')).recordset[0];
  const authUserId=String(identity?.authUserId??'').trim();
  if(!authUserId)throw error(403,'SUPABASE_IDENTITY_MISSING','Tài khoản chưa được liên kết với Supabase Auth.');
  const claims=JSON.stringify({sub:authUserId,role:'authenticated'});
  await requestFor(transaction).input('authUserId',dbTypes.VarChar(64),authUserId).input('claims',dbTypes.VarChar(2000),claims)
    .query("SELECT set_config('request.jwt.claim.sub',@authUserId,true),set_config('request.jwt.claims',@claims,true)");
}

async function blacklistLimit() {
  // CauHinhHeThong không tồn tại trong schema thật; dùng ngưỡng mặc định.
  return 3;
}

export async function listCustomers(query={}) {
  const rows=(await getPool().request().query(`SELECT maKhachHang AS id,hoTen AS name,ngaySinh AS dateOfBirth,soDienThoai AS phone,soLanHuyLich AS cancellationCount
    FROM dbo.KhachHang ORDER BY hoTen,maKhachHang`)).recordset.map(row=>({...row,id:row.id.trim(),dateOfBirth:dateText(row.dateOfBirth),cancellationCount:Number(row.cancellationCount)}));
  const keyword=normalizeVietnamese(query.keyword||'');
  const data=keyword?rows.filter(row=>normalizeVietnamese(`${row.id} ${row.name} ${row.phone}`).includes(keyword)):rows;
  return paginate(data,query.page,query.limit);
}

async function packageSummaries(customerId,transaction) {
  const rows=(await requestFor(transaction).input('customer',dbTypes.Char(10),customerId).query(`SELECT d.maDonMua AS id,d.ngayMua AS purchaseDate,d.trangThaiThanhToan AS paymentStatus,
    d.trangThaiHoanThanh AS completionStatus,d.soBuoiDaThucHien AS sessionsCompleted,s.giaDV AS purchasePrice,NULL AS endedAt,
    s.maDichVu AS serviceId,s.tenDV AS serviceName,s.tongSoBuoi AS totalSessions,d.ghiChu AS note,d.fileTongHop AS summaryFile
    FROM dbo.DonMuaDV d JOIN dbo.DichVu s ON s.maDichVu=d.maDichVu WHERE d.maKhachHang=@customer ORDER BY d.ngayMua DESC,d.maDonMua DESC`)).recordset;
  return rows.map(row=>({...row,id:row.id.trim(),serviceId:row.serviceId.trim(),purchaseDate:row.purchaseDate,
    sessionsCompleted:Number(row.sessionsCompleted),purchasePrice:Number(row.purchasePrice),totalSessions:Number(row.totalSessions)}));
}

async function retailPurchaseRows(customerId,transaction) {
  return (await requestFor(transaction).input('customer',dbTypes.Char(10),customerId).query(`SELECT o.maDon AS saleId,o.ngayMua AS purchaseDate,p.maMyPham AS cosmeticId,
    o.tongTien AS saleTotal,l.maCT_Don AS lineId,p.tenMyPham AS cosmeticName,l.soLuong AS quantity,l.donGia AS unitPrice,l.thanhTien AS lineTotal,l.maLo AS batchId
    FROM dbo.DonGhiNhanBan o JOIN dbo.CT_DonGhiNhanBan l ON l.maDon=o.maDon JOIN dbo.LoHang b ON b.maLo=l.maLo
    JOIN dbo.MyPham p ON p.maMyPham=b.maMyPham WHERE o.maKhachHang=@customer ORDER BY o.ngayMua DESC,o.maDon DESC,l.maCT_Don`)).recordset;
}

export async function getCustomer(id) {
  const customer=await findCustomer(id);const packages=await packageSummaries(id);const purchasedProducts=await retailPurchaseRows(id);
  const threshold=await blacklistLimit();
  const grouped=new Map();
  for(const row of purchasedProducts) {
    const key=row.saleId.trim();
    let sale=grouped.get(key);
    if(!sale){sale={saleId:key,purchaseDate:row.purchaseDate,total:Number(row.saleTotal)||0,items:[]};grouped.set(key,sale);}
    sale.items.push({id:row.lineId.trim(),cosmeticId:row.cosmeticId.trim(),cosmeticName:row.cosmeticName,
      quantity:Number(row.quantity),unitPrice:Number(row.unitPrice),lineTotal:Number(row.lineTotal),batchId:row.batchId?.trim()||null});
  }
  const sales=[...grouped.values()];
  const productRows=sales.flatMap(sale=>sale.items.map(item=>({...item,saleId:sale.saleId,purchaseDate:sale.purchaseDate})));
  const { activeServices, serviceHistory } = partitionCustomerServicePackages(packages);
  return {...customer,isBlacklisted:customer.cancellationCount>=threshold,blacklistThreshold:threshold,
    activeServices,serviceHistory,
    purchasedProducts:productRows,purchasedSales:sales,
    emptyLabels:{purchasedProducts:sales.length?null:'Chưa có sản phẩm mua thêm',serviceHistory:serviceHistory.length?null:'Chưa có lịch sử dịch vụ'},
    actions:{recordRetailSale:true,viewServiceHistory:true}};
}

export function partitionCustomerServicePackages(packages=[]) {
  return {
    activeServices:packages.filter(item=>item.completionStatus!=='Đã hoàn thành'),
    serviceHistory:packages.filter(item=>item.completionStatus==='Đã hoàn thành'),
  };
}

async function ensureUniquePhone(phone,excludeId,transaction) {
  const found=(await requestFor(transaction).input('phone',dbTypes.VarChar(10),phone).input('exclude',dbTypes.Char(10),excludeId||'').query(`SELECT TOP(1) maKhachHang FROM dbo.KhachHang WITH (UPDLOCK,HOLDLOCK)
    WHERE soDienThoai=@phone AND maKhachHang<>@exclude`)).recordset[0];
  if(found)throw error(409,'CUSTOMER_PHONE_EXISTS','Số điện thoại đã tồn tại.',[{field:'phone',message:phoneMessage}]);
}

export async function createCustomer(body,user) {
  const fields=customerFields(body);
  return inTransaction(async transaction=>{
    await ensureUniquePhone(fields.soDienThoai,null,transaction);
    const id=await nextCode('KH',transaction);
    await requestFor(transaction).input('id',dbTypes.Char(10),id).input('name',dbTypes.NVarChar(50),fields.hoTen)
      .input('dob',dbTypes.Date,fields.ngaySinh).input('phone',dbTypes.VarChar(10),fields.soDienThoai)
      .query('INSERT INTO dbo.KhachHang(maKhachHang,hoTen,ngaySinh,soDienThoai,soLanHuyLich) VALUES(@id,@name,@dob,@phone,0)');
    const after={maKhachHang:id,...fields,soLanHuyLich:0};
    await insertAudit({transaction,user,action:'Tạo hồ sơ khách hàng',entity:'KhachHang',entityId:id,before:null,after});
    return {...await findCustomer(id,transaction),isBlacklisted:false,message:'Tạo hồ sơ khách hàng thành công'};
  });
}

export async function updateCustomer(id,body,user) {
  const allowed=new Set(['name','hoTen','dateOfBirth','ngaySinh','phone','soDienThoai','cancellationCount','soLanHuyLich']);
  const forbidden=Object.keys(body??{}).filter(field=>!allowed.has(field));
  if(forbidden.length)throw badRequest('Không được phép cập nhật dữ liệu lịch sử hoặc giao dịch đã ghi nhận.',forbidden.map(field=>({field,message:'Trường này không được phép chỉnh sửa.'})));
  const fields=customerFields(body,{partial:true});
  if(!Object.keys(fields).length)throw badRequest('Thông tin khách hàng chưa hợp lệ.');
  return inTransaction(async transaction=>{
    const before=await findCustomer(id,transaction);
    if(fields.soDienThoai)await ensureUniquePhone(fields.soDienThoai,id,transaction);
    if(Object.keys(fields).length){
      const set=[];const request=requestFor(transaction).input('id',dbTypes.Char(10),id);
      if(fields.hoTen!==undefined){set.push('hoTen=@name');request.input('name',dbTypes.NVarChar(50),fields.hoTen);}
      if(fields.ngaySinh!==undefined){set.push('ngaySinh=@dob');request.input('dob',dbTypes.Date,fields.ngaySinh);}
      if(fields.soDienThoai!==undefined){set.push('soDienThoai=@phone');request.input('phone',dbTypes.VarChar(10),fields.soDienThoai);}
      if(fields.soLanHuyLich!==undefined){set.push('soLanHuyLich=@cancellationCount');request.input('cancellationCount',dbTypes.Int,fields.soLanHuyLich);}
      await request.query(`UPDATE dbo.KhachHang SET ${set.join(',')} WHERE maKhachHang=@id`);
    }
    const after=await findCustomer(id,transaction);
    if(Object.keys(fields).length)await insertAudit({transaction,user,action:'Cập nhật thông tin khách hàng',entity:'KhachHang',entityId:id,before,after});
    return {...after,message:'Cập nhật thông tin khách hàng thành công'};
  });
}

export async function deleteCustomer(id,user) {
  return inTransaction(async transaction=>{
    const before=await findCustomer(id,transaction);
    const usage=(await requestFor(transaction).input('id',dbTypes.Char(10),id).query(`SELECT
      (SELECT COUNT_BIG(*) FROM dbo.DonMuaDV WHERE maKhachHang=@id) AS packageCount,
      (SELECT COUNT_BIG(*) FROM dbo.LichHen WHERE maKhachHang=@id) AS appointmentCount,
      (SELECT COUNT_BIG(*) FROM dbo.DonGhiNhanBan WHERE maKhachHang=@id) AS saleCount,
      (SELECT COUNT_BIG(*) FROM dbo.DanhGia WHERE maKhachHang=@id) AS reviewCount`)).recordset[0];
    if(Object.values(usage).some(value=>Number(value)>0))throw error(409,'CUSTOMER_HAS_RELATED_DATA','Không thể xóa hồ sơ khách hàng vì hồ sơ đang có liên quan đến các dữ liệu khác');
    await requestFor(transaction).input('id',dbTypes.Char(10),id).query('DELETE FROM dbo.KhachHang WHERE maKhachHang=@id');
    await insertAudit({transaction,user,action:'Xóa hồ sơ khách hàng',entity:'KhachHang',entityId:id,before,after:null});
    return {id:id.trim(),message:'Xóa khách hàng thành công'};
  });
}

export async function listCustomerServiceHistory(customerId,query={}) {
  await findCustomer(customerId);
  const items=(await packageSummaries(customerId)).filter(item=>item.completionStatus==='Đã hoàn thành');
  const keyword=normalizeVietnamese(query.keyword||'');
  const filtered=keyword?items.filter(row=>normalizeVietnamese(`${row.serviceName} ${row.id} ${row.paymentStatus} ${row.completionStatus}`).includes(keyword)):items;
  return paginate(filtered,query.page,query.limit);
}

export async function assignServicePackage(customerId,body,user) {
  if(!body||typeof body!=='object'||Array.isArray(body))body={};
  const serviceId=String(body.serviceId??body.maDichVu??'').trim();
  const paid=body.paid===true||body.paymentStatus==='Đã thanh toán'||body.trangThaiThanhToan==='Đã thanh toán';
  const note=body.note??body.ghiChu??null;
  const errors=[];
  if(!serviceId)errors.push({field:'serviceId',message:'Dịch vụ không được bỏ trống'});
  if(note!=null&&String(note).length>255)errors.push({field:'note',message:'Ghi chú tối đa 255 ký tự'});
  if(errors.length)throw badRequest('Thông tin chưa hoàn tất, yêu cầu nhập lại',errors);
  try {
    return await inTransaction(async transaction=>{
      const customer=await findCustomer(customerId,transaction);
      const service=(await requestFor(transaction).input('id',dbTypes.Char(10),serviceId).query(`SELECT maDichVu AS "maDichVu",tenDV AS "tenDV",giaDV AS "giaDV",tongSoBuoi AS "tongSoBuoi" FROM dbo.DichVu WHERE maDichVu=@id`)).recordset[0];
      if(!service)throw notFound('Không tìm thấy dịch vụ phù hợp!');
      await setSupabaseAuthContext(transaction,user);
      let packageId;
      try {
        packageId=(await requestFor(transaction).input('customer',dbTypes.VarChar(10),customerId).input('service',dbTypes.VarChar(10),serviceId)
          .input('paid',dbTypes.Bit,paid).input('note',dbTypes.VarChar(255),note==null?null:String(note))
          .query('SELECT public.fn_tao_don_mua_dich_vu(@customer,@service,@paid,@note) AS id')).recordset[0]?.id;
      } catch(rpcError) {
        console.error('[service-package] RPC fn_tao_don_mua_dich_vu thất bại; hàm này INSERT đơn mua và các buổi trong cùng transaction.',{
          message:rpcError?.message,
          details:rpcError?.details??rpcError?.detail,
          detail:rpcError?.detail,
          hint:rpcError?.hint,
          code:rpcError?.code,
          expectedRows:{donmuadv:1,ct_donmua:Number(service.tongSoBuoi)},
          receivedRows:{donmuadv:null,ct_donmua:null},
        });
        throw error(422,'SERVICE_PACKAGE_RPC_FAILED',rpcError.message);
      }
      if(!packageId)throw error(500,'SERVICE_PACKAGE_RPC_EMPTY','Hàm tạo dịch vụ không trả về mã đơn mua.');
      const expectedSessions=Number(service.tongSoBuoi);
      let persisted;
      try {
        persisted=(await requestFor(transaction)
          .input('package',dbTypes.Char(10),packageId)
          .input('customer',dbTypes.Char(10),customerId)
          .input('service',dbTypes.Char(10),serviceId)
          .query(`SELECT d.maDonMua AS id,d.maKhachHang AS customerId,d.maDichVu AS serviceId,
          d.trangThaiThanhToan AS paymentStatus,d.trangThaiHoanThanh AS completionStatus,
          d.soBuoiDaThucHien AS sessionsCompleted,s.giaDV AS purchasePrice,s.tongSoBuoi AS totalSessions,
          (SELECT COUNT(*) FROM dbo.CT_DonMua c WHERE c.maDonMua=d.maDonMua) AS sessionCount,
          (SELECT COUNT(*) FROM dbo.CT_DonMua c JOIN dbo.CT_DichVu t ON t.maCT_DichVu=c.maCT_DichVu
            WHERE c.maDonMua=d.maDonMua AND t.maDichVu=d.maDichVu) AS linkedSessionCount
          FROM dbo.DonMuaDV d JOIN dbo.DichVu s ON s.maDichVu=d.maDichVu
          WHERE d.maDonMua=@package AND d.maKhachHang=@customer AND d.maDichVu=@service`)).recordset[0];
      } catch(selectError) {
        console.error('[service-package] SELECT xác minh đơn mua/buổi thất bại.',{
          message:selectError?.message,
          details:selectError?.details??selectError?.detail,
          detail:selectError?.detail,
          hint:selectError?.hint,
          code:selectError?.code,
          expectedRows:{donmuadv:1,ct_donmua:expectedSessions},
          receivedRows:{donmuadv:null,ct_donmua:null},
        });
        throw selectError;
      }
      const receivedRows={donmuadv:persisted?1:0,ct_donmua:Number(persisted?.sessionCount)||0};
      if(!persisted
        || Number(persisted.sessionCount)!==expectedSessions
        || Number(persisted.linkedSessionCount)!==expectedSessions
        || Number(persisted.sessionsCompleted)!==0
        || Number(persisted.totalSessions)!==expectedSessions
        || Number(persisted.purchasePrice)!==Number(service.giaDV)
        || String(persisted.completionStatus??'').trim()!=='Chưa thực hiện'
        || String(persisted.paymentStatus??'').trim()!==(paid?'Đã thanh toán':'Chưa thanh toán')) {
        const verificationError=error(500,'SERVICE_PACKAGE_PERSISTENCE_CHECK_FAILED','Cơ sở dữ liệu chưa xác nhận đã lưu đầy đủ đơn mua và các buổi dịch vụ.');
        console.error('[service-package] SELECT xác minh không khớp số dòng hoặc dữ liệu đơn/buổi.',{
          message:verificationError.message,
          details:verificationError.details,
          hint:verificationError.hint,
          code:verificationError.code,
          expectedRows:{donmuadv:1,ct_donmua:expectedSessions},
          receivedRows,
          linkedSessionRows:Number(persisted?.linkedSessionCount)||0,
        });
        throw verificationError;
      }
      return {id:String(packageId).trim(),customerId:customer.id,serviceId:service.maDichVu.trim(),serviceName:service.tenDV,
        purchasePrice:Number(service.giaDV),paymentStatus:paid?'Đã thanh toán':'Chưa thanh toán',completionStatus:'Chưa thực hiện',
        totalSessions:expectedSessions,sessionsCompleted:0,persisted:true,sessionRows:Number(persisted.sessionCount),
        note:note??null,message:'Thêm dịch vụ thành công'};
    });
  } catch (cause) {
    if (cause instanceof AppError) throw cause;
    console.error('Không thể thêm dịch vụ cho hồ sơ khách hàng:',cause);
    throw error(500,'SERVICE_PACKAGE_CREATE_FAILED',`Không thể thêm dịch vụ: ${cause?.message || 'Lỗi cơ sở dữ liệu không xác định.'}`);
  }
}

function isValidPackageDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(value + 'T00:00:00Z');
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}

export async function updateServicePackageDetails(id, body, user) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) body = {};
  const allowedFields = new Set(['paymentStatus', 'note', 'summaryFile']);
  const errors = [];
  for (const field of Object.keys(body)) {
    if (!allowedFields.has(field)) errors.push({ field, message: 'Trường này không được phép chỉnh sửa.' });
  }
  if (!Object.keys(body).length) errors.push({ field: 'body', message: 'Chọn ít nhất một thông tin cần cập nhật.' });
  const paymentStatus = body.paymentStatus === undefined ? undefined : String(body.paymentStatus).trim();
  const note = body.note === undefined ? undefined : body.note == null ? null : String(body.note);
  const summaryFile = body.summaryFile === undefined ? undefined : body.summaryFile == null ? null : String(body.summaryFile).trim();
  if (paymentStatus !== undefined && !['Chưa thanh toán', 'Đã thanh toán'].includes(paymentStatus)) errors.push({ field: 'paymentStatus', message: 'Trạng thái thanh toán không hợp lệ.' });
  if (note != null && note.length > 255) errors.push({ field: 'note', message: 'Ghi chú tối đa 255 ký tự.' });
  if (summaryFile != null && summaryFile.length > 255) errors.push({ field: 'summaryFile', message: 'Tệp tổng hợp tối đa 255 ký tự.' });
  if (errors.length) throw error(400, 'VALIDATION_ERROR', 'Thông tin liệu trình chưa hợp lệ.', errors);

  return inTransaction(async transaction => {
    const current=(await requestFor(transaction).input('id',dbTypes.Char(10),id).query(`SELECT trangThaiHoanThanh AS status FROM dbo.DonMuaDV WITH (UPDLOCK,HOLDLOCK) WHERE maDonMua=@id`)).recordset[0];
    if(!current)throw notFound('Không tìm thấy liệu trình phù hợp!');
    if(current.status==='Đã hoàn thành')throw error(409,'SERVICE_HISTORY_READ_ONLY','Không thể chỉnh sửa dịch vụ đã hoàn thành.');
    const request=requestFor(transaction).input('id',dbTypes.Char(10),id);
    const updates=[];
    if(paymentStatus!==undefined){request.input('payment',dbTypes.NVarChar(50),paymentStatus);updates.push('trangThaiThanhToan=@payment');}
    if(note!==undefined){request.input('note',dbTypes.NVarChar(255),note);updates.push('ghiChu=@note');}
    if(summaryFile!==undefined){request.input('file',dbTypes.NVarChar(255),summaryFile||null);updates.push('fileTongHop=@file');}
    const row=(await request.query(`UPDATE dbo.DonMuaDV SET ${updates.join(',')} WHERE maDonMua=@id RETURNING maDonMua AS id,ngayMua AS purchaseDate,trangThaiThanhToan AS paymentStatus,ghiChu AS note,fileTongHop AS summaryFile`)).recordset[0];
    if(!row)throw notFound('Không tìm thấy liệu trình phù hợp!');
    await insertAudit({ transaction, user, action: 'Cập nhật thông tin liệu trình', entity: 'DonMuaDV', entityId: id, before:null, after:row });
    return {...row,id:String(row.id).trim(),message:'Cập nhật thành công'};
  });
}

export async function getServicePackage(id) {
  const head=(await getPool().request().input('id',dbTypes.Char(10),id).query(`SELECT d.maDonMua AS id,d.maKhachHang AS customerId,k.hoTen AS customerName,
    k.soDienThoai AS customerPhone,d.maDichVu AS serviceId,s.tenDV AS serviceName,d.ngayMua AS purchaseDate,
    s.giaDV AS purchasePrice,d.trangThaiThanhToan AS paymentStatus,d.trangThaiHoanThanh AS completionStatus,d.soBuoiDaThucHien AS sessionsCompleted,
    s.tongSoBuoi AS totalSessions,d.fileTongHop AS summaryFile,d.ghiChu AS note
    FROM dbo.DonMuaDV d JOIN dbo.KhachHang k ON k.maKhachHang=d.maKhachHang JOIN dbo.DichVu s ON s.maDichVu=d.maDichVu WHERE d.maDonMua=@id`)).recordset[0];
  if(!head)throw notFound('Không tìm thấy liệu trình phù hợp!');
  const sessions=(await getPool().request().input('id',dbTypes.Char(10),id).query(`SELECT c.maCT_DonMua AS id,c.maCT_DichVu AS templateId,
    COALESCE(c.tenBuoi,t.tenBuoi) AS name,t.kyThuat AS technique,t.thoiGianThucHien AS durationMinutes,t.myPhamSD AS cosmeticsUsage,
    c.ngayThucHien AS performedAt,c.ketQua AS result,c.trangThaiThucHien AS status,c.xacNhanKH AS customerConfirmation,c.hinhAnh AS image,c.ghiChu AS note,NULL AS staffName
    FROM dbo.CT_DonMua c LEFT JOIN dbo.CT_DichVu t ON t.maCT_DichVu=c.maCT_DichVu
    WHERE c.maDonMua=@id ORDER BY c.maCT_DonMua`)).recordset;
  // TaiLieuTongHop không có trong schema thật; không còn tệp tổng hợp để trả về.
  const summaryFiles=[];
  return {...head,id:head.id.trim(),customerId:head.customerId.trim(),serviceId:head.serviceId.trim(),purchasePrice:Number(head.purchasePrice),
    sessionsCompleted:Number(head.sessionsCompleted),totalSessions:Number(head.totalSessions),sessions:sessions.map(x=>({...x,id:x.id.trim(),durationMinutes:Number(x.durationMinutes)})),
    summaryFiles:summaryFiles.map(x=>({...x,sessionId:x.sessionId.trim(),url:`${config.publicBaseUrl}${x.path}`}))};
}

async function packageAndSession(transaction,packageId,sessionId) {
  const result=await requestFor(transaction).input('package',dbTypes.Char(10),packageId).input('session',dbTypes.Char(10),sessionId).query(`SELECT d.maDonMua AS "maDonMua",d.trangThaiHoanThanh AS "trangThaiHoanThanh",d.maKhachHang AS "maKhachHang",
    k.hoTen AS customerName,k.soDienThoai AS customerPhone,
    s.tenDV AS serviceName,c.maCT_DonMua AS "maCT_DonMua",c.trangThaiThucHien AS "trangThaiThucHien",c.xacNhanKH AS "xacNhanKH",c.ketQua AS "ketQua",c.hinhAnh AS "image",c.ghiChu AS "ghiChu",c.maCT_DichVu AS "maCT_DichVu",
    COALESCE(c.tenBuoi,t.tenBuoi) AS sessionName,t.thoiGianThucHien AS durationMinutes
    FROM dbo.DonMuaDV d WITH (UPDLOCK,HOLDLOCK) JOIN dbo.CT_DonMua c WITH (UPDLOCK,HOLDLOCK) ON c.maDonMua=d.maDonMua
    JOIN dbo.KhachHang k ON k.maKhachHang=d.maKhachHang JOIN dbo.DichVu s ON s.maDichVu=d.maDichVu LEFT JOIN dbo.CT_DichVu t ON t.maCT_DichVu=c.maCT_DichVu
    WHERE d.maDonMua=@package AND c.maCT_DonMua=@session`);
  if(!result.recordset[0])throw notFound('Không tìm thấy buổi dịch vụ phù hợp!');
  return result.recordset[0];
}

async function allPackageSessions(transaction,packageId) {
  return (await requestFor(transaction).input('id',dbTypes.Char(10),packageId).query(`SELECT maCT_DonMua AS "maCT_DonMua",trangThaiThucHien AS "trangThaiThucHien" FROM dbo.CT_DonMua WITH (UPDLOCK,HOLDLOCK)
    WHERE maDonMua=@id ORDER BY maCT_DonMua`)).recordset;
}

export async function startPackageSession(packageId,sessionId,user) {
  return inTransaction(async transaction=>{
    const row=await packageAndSession(transaction,packageId,sessionId);
    if(row.trangThaiThucHien!=='Chưa thực hiện')throw error(409,'SESSION_STATE_INVALID','Buổi dịch vụ không ở trạng thái có thể bắt đầu.');
    const sessions=await allPackageSessions(transaction,packageId);const index=sessions.findIndex(x=>x.maCT_DonMua===row.maCT_DonMua);
    if(sessions.slice(0,index).some(x=>x.trangThaiThucHien!=='Đã hoàn thành'))throw error(409,'SESSION_ORDER_INVALID','Vui lòng hoàn thành buổi trước theo đúng thứ tự!');
    await requestFor(transaction).input('id',dbTypes.Char(10),sessionId).input('package',dbTypes.Char(10),packageId)
      .query(`UPDATE dbo.CT_DonMua SET trangThaiThucHien=N'Đang thực hiện',ngayThucHien=SYSDATETIME() WHERE maCT_DonMua=@id AND maDonMua=@package;
        UPDATE dbo.DonMuaDV SET trangThaiHoanThanh=N'Đang thực hiện' WHERE maDonMua=@package AND trangThaiHoanThanh=N'Chưa thực hiện'`);
    await insertAudit({transaction,user,action:'Bắt đầu buổi dịch vụ',entity:'CT_DonMua',entityId:sessionId,before:{trangThaiThucHien:row.trangThaiThucHien},after:{trangThaiThucHien:'Đang thực hiện'}});
    return {packageId:packageId.trim(),sessionId:sessionId.trim(),status:'Đang thực hiện',message:'Bắt đầu buổi dịch vụ thành công'};
  });
}

export async function completePackageSession(packageId,sessionId,body,user) {
  if(!body||typeof body!=='object'||Array.isArray(body))body={};
  const result=String(body.result??body.ketQua??'').trim();
  if(!result)throw badRequest('Vui lòng nhập kết quả buổi!',[{field:'result',message:'Vui lòng nhập kết quả buổi!'}]);
  if(result.length>255)throw badRequest('Kết quả buổi không được vượt quá 255 ký tự.',[{field:'result',message:'Tối đa 255 ký tự'}]);
  const image=body.image??body.hinhAnh??null;
  const note=body.note??body.ghiChu??null;
  if(image!=null&&(typeof image!=='string'||image.length>255))throw badRequest('Hình ảnh không hợp lệ.',[{field:'image',message:'Đường dẫn ảnh tối đa 255 ký tự'}]);
  if(note!=null&&(typeof note!=='string'||note.length>255))throw badRequest('Ghi chú không hợp lệ.',[{field:'note',message:'Ghi chú tối đa 255 ký tự'}]);
  return inTransaction(async transaction=>{
    const row=await packageAndSession(transaction,packageId,sessionId);
    if(row.trangThaiThucHien!=='Đang thực hiện')throw error(409,'SESSION_STATE_INVALID','Buổi dịch vụ không ở trạng thái có thể hoàn thành.');
    const storedImage=image??row.image??null;
    await requestFor(transaction).input('id',dbTypes.Char(10),sessionId).input('package',dbTypes.Char(10),packageId)
      .input('result',dbTypes.NVarChar(255),result).input('image',dbTypes.NVarChar(255),storedImage).input('note',dbTypes.NVarChar(255),note)
      .query(`UPDATE dbo.CT_DonMua SET trangThaiThucHien=N'Chờ xác nhận',xacNhanKH=N'Chưa xác nhận',ketQua=@result,hinhAnh=@image,ghiChu=@note,ngayThucHien=SYSDATETIME()
        WHERE maCT_DonMua=@id AND maDonMua=@package`);
    await insertAudit({transaction,user,action:'Hoàn thành buổi dịch vụ, chờ khách xác nhận',entity:'CT_DonMua',entityId:sessionId,
      before:{trangThaiThucHien:row.trangThaiThucHien},after:{trangThaiThucHien:'Chờ xác nhận',ketQua:result,hinhAnh:storedImage}});
    const confirmationUrl=createConfirmationUrl(packageId,sessionId);
    await enqueueNotification(transaction,{event:'SESSION_CONFIRM_REQUEST',recipient:row.customerPhone,sessionId,
      payload:{packageId:packageId.trim(),sessionId:sessionId.trim(),customerId:row.maKhachHang.trim(),customerName:row.customerName,
        phone:row.customerPhone,serviceName:row.serviceName,sessionName:row.sessionName||'Buổi dịch vụ',result,image:storedImage,
        imageUrl:storedImage&&storedImage.startsWith('/')?`${config.publicBaseUrl}${storedImage}`:storedImage,confirmationUrl}});
    return {packageId:packageId.trim(),sessionId:sessionId.trim(),status:'Chờ xác nhận',customerConfirmation:'Chưa xác nhận',message:'Cập nhật buổi dịch vụ thành công!'};
  });
}

export async function updatePackageSessionResult(packageId,sessionId,body,user) {
  if(!body||typeof body!=='object'||Array.isArray(body))body={};
  const aliases={performedAt:['performedAt','ngayThucHien'],result:['result','ketQua'],status:['status','trangThaiThucHien'],customerConfirmation:['customerConfirmation','xacNhanKH'],image:['image','hinhAnh'],note:['note','ghiChu']};
  const allowed=new Set(Object.values(aliases).flat());
  const errors=[];
  for(const field of Object.keys(body))if(!allowed.has(field))errors.push({field,message:'Trường này không được phép chỉnh sửa.'});
  const has=(key)=>aliases[key].some(field=>Object.hasOwn(body,field));
  const value=(key)=>{const field=aliases[key].find(name=>Object.hasOwn(body,name));return field?body[field]:undefined;};
  if(!Object.keys(body).length)errors.push({field:'body',message:'Chọn ít nhất một thông tin cần cập nhật.'});
  const performedAt=value('performedAt');
  if(has('performedAt')&&performedAt!=null&&(!String(performedAt).trim()||Number.isNaN(new Date(performedAt).valueOf())))errors.push({field:'performedAt',message:'Ngày thực hiện không hợp lệ.'});
  const result=has('result')&&value('result')!=null?String(value('result')).trim():null;
  if(has('result')&&result?.length>255)errors.push({field:'result',message:'Kết quả tối đa 255 ký tự.'});
  const status=value('status');
  if(has('status')&&!['Chưa thực hiện','Đang thực hiện','Chờ xác nhận','Đã hoàn thành'].includes(status))errors.push({field:'status',message:'Trạng thái thực hiện không hợp lệ.'});
  const customerConfirmation=value('customerConfirmation');
  if(has('customerConfirmation')&&!['Chưa xác nhận','Đã xác nhận'].includes(customerConfirmation))errors.push({field:'customerConfirmation',message:'Trạng thái xác nhận khách hàng không hợp lệ.'});
  const image=value('image');
  if(has('image')&&image!=null&&(typeof image!=='string'||image.length>255))errors.push({field:'image',message:'Đường dẫn ảnh tối đa 255 ký tự.'});
  const note=value('note');
  if(has('note')&&note!=null&&(typeof note!=='string'||note.length>255))errors.push({field:'note',message:'Ghi chú tối đa 255 ký tự.'});
  if(errors.length)throw badRequest('Thông tin buổi dịch vụ chưa hợp lệ.',errors);
  return inTransaction(async transaction=>{
    const row=await packageAndSession(transaction,packageId,sessionId);
    if(row.trangThaiHoanThanh==='Đã hoàn thành'||row.trangThaiThucHien==='Đã hoàn thành')throw error(409,'SERVICE_HISTORY_READ_ONLY','Không thể chỉnh sửa buổi dịch vụ đã hoàn thành.');
    const request=requestFor(transaction).input('id',dbTypes.Char(10),sessionId).input('package',dbTypes.Char(10),packageId);
    const assignments=[];
    if(has('performedAt')){request.input('performedAt',dbTypes.DateTime2,performedAt);assignments.push('ngayThucHien=@performedAt');}
    if(has('result')){request.input('result',dbTypes.NVarChar(255),result);assignments.push('ketQua=@result');}
    if(has('status')){request.input('status',dbTypes.NVarChar(50),status);assignments.push('trangThaiThucHien=@status');}
    if(has('customerConfirmation')){request.input('confirmation',dbTypes.NVarChar(50),customerConfirmation);assignments.push('xacNhanKH=@confirmation');}
    if(has('image')){request.input('image',dbTypes.NVarChar(255),image);assignments.push('hinhAnh=@image');}
    if(has('note')){request.input('note',dbTypes.NVarChar(255),note);assignments.push('ghiChu=@note');}
    const updated=(await request.query(`UPDATE dbo.CT_DonMua SET ${assignments.join(',')} WHERE maCT_DonMua=@id AND maDonMua=@package RETURNING maCT_DonMua AS id,ngayThucHien AS performedAt,ketQua AS result,trangThaiThucHien AS status,xacNhanKH AS customerConfirmation,hinhAnh AS image,ghiChu AS note`)).recordset[0];
    if(!updated)throw notFound('Không tìm thấy buổi dịch vụ phù hợp!');
    await insertAudit({transaction,user,action:'Cập nhật kết quả buổi dịch vụ',entity:'CT_DonMua',entityId:sessionId,
      before:row,after:updated});
    return {packageId:packageId.trim(),...updated,id:updated.id.trim(),message:'Cập nhật buổi dịch vụ thành công'};
  });
}

export async function markCustomerConfirmed(packageId,sessionId,user=null) {
  return inTransaction(async transaction=>{
    const row=await packageAndSession(transaction,packageId,sessionId);
    if(row.trangThaiThucHien==='Đã hoàn thành'&&row.xacNhanKH==='Đã xác nhận') {
      const count=Number((await requestFor(transaction).input('id',dbTypes.Char(10),packageId).query("SELECT COUNT(*) AS total FROM dbo.CT_DonMua WHERE maDonMua=@id AND trangThaiThucHien=N'Đã hoàn thành'")).recordset[0].total);
      const total=Number((await requestFor(transaction).input('id',dbTypes.Char(10),packageId).query('SELECT COUNT(*) AS total FROM dbo.CT_DonMua WHERE maDonMua=@id')).recordset[0].total);
      return {packageId:packageId.trim(),sessionId:sessionId.trim(),status:'Đã hoàn thành',customerConfirmation:'Đã xác nhận',
        sessionsCompleted:count,totalSessions:total,packageCompleted:count===total,alreadyConfirmed:true,createSummary:false,message:'Buổi dịch vụ đã được xác nhận trước đó'};
    }
    if(row.trangThaiThucHien!=='Chờ xác nhận'||row.xacNhanKH!=='Chưa xác nhận')throw error(409,'SESSION_CONFIRMATION_INVALID','Buổi dịch vụ không chờ khách xác nhận.');
    await requestFor(transaction).input('id',dbTypes.Char(10),sessionId).input('package',dbTypes.Char(10),packageId)
      .query(`UPDATE dbo.CT_DonMua SET trangThaiThucHien=N'Đã hoàn thành',xacNhanKH=N'Đã xác nhận' WHERE maCT_DonMua=@id AND maDonMua=@package`);
    const count=Number((await requestFor(transaction).input('id',dbTypes.Char(10),packageId)
      .query("SELECT COUNT(*) AS total FROM dbo.CT_DonMua WHERE maDonMua=@id AND trangThaiThucHien=N'Đã hoàn thành'")).recordset[0].total);
    const total=Number((await requestFor(transaction).input('id',dbTypes.Char(10),packageId)
      .query('SELECT COUNT(*) AS total FROM dbo.CT_DonMua WHERE maDonMua=@id')).recordset[0].total);
    const isFinished=count===total;
    // Tính trạng thái trong JS thay vì lặp @id/@count trong CASE: PostgreSQL suy
    // luận kiểu tham số không nhất quán khi cùng tham số dùng cho int và bigint.
    await requestFor(transaction).input('id',dbTypes.Char(10),packageId).input('count',dbTypes.Int,count)
      .input('status',dbTypes.NVarChar(50),isFinished?'Đã hoàn thành':'Đang thực hiện')
      .query('UPDATE dbo.DonMuaDV SET soBuoiDaThucHien=@count,trangThaiHoanThanh=@status WHERE maDonMua=@id');
    const sessions=await allPackageSessions(transaction,packageId);const sessionIndex=sessions.findIndex(x=>x.maCT_DonMua===row.maCT_DonMua)+1;
    const middleSession=Math.ceil(total/2);
    const createSummary=sessionIndex===middleSession||sessionIndex===total;
    const milestone=sessionIndex===total?'final':'midpoint';
    await insertAudit({transaction,user,action:'Khách xác nhận hoàn thành buổi dịch vụ',entity:'CT_DonMua',entityId:sessionId,
      before:{trangThaiThucHien:'Chờ xác nhận',xacNhanKH:'Chưa xác nhận'},after:{trangThaiThucHien:'Đã hoàn thành',xacNhanKH:'Đã xác nhận',soBuoiDaThucHien:count}});
    if(createSummary)await enqueueNotification(transaction,{event:'SUMMARY_AND_REVIEW',recipient:row.customerPhone,sessionId,
      payload:{packageId:packageId.trim(),sessionId:sessionId.trim(),customerId:row.maKhachHang.trim(),customerName:row.customerName,
        phone:row.customerPhone,serviceName:row.serviceName,milestone}});
    return {packageId:packageId.trim(),sessionId:sessionId.trim(),status:'Đã hoàn thành',customerConfirmation:'Đã xác nhận',
      sessionsCompleted:count,totalSessions:total,packageCompleted:isFinished,createSummary,milestone:createSummary?milestone:null,message:'Xác nhận hoàn thành buổi dịch vụ thành công'};
  });
}

export const confirmPackageSession = markCustomerConfirmed;

export async function listRetailCosmetics(query={}) {
  const result=await getPool().request().query(`SELECT maMyPham AS id,tenMyPham AS name,donViTinh AS unit,giaBan AS price,soLuongTonKho AS stock
    FROM dbo.MyPham WHERE phanLoai=N'Bán lẻ' AND soLuongTonKho>0 ORDER BY tenMyPham`);
  const rows=result.recordset.map(x=>({...x,id:x.id.trim(),price:Number(x.price),stock:Number(x.stock)}));
  const keyword=normalizeVietnamese(query.keyword||'');
  return paginate(keyword?rows.filter(x=>normalizeVietnamese(`${x.id} ${x.name}`).includes(keyword)):rows,query.page,query.limit);
}

export async function createRetailSale(customerId,body,user) {
  if(!body||typeof body!=='object'||Array.isArray(body))body={};
  const dateErrors=[];
  const saleDate=parseDate(body.soldAt??body.ngayMua??todayVn(),'soldAt',dateErrors,'Ngày mua');
  if(dateErrors.length)throw badRequest('Ngày mua không hợp lệ.',dateErrors);
  const source=body.items;
  const errors=[];const items=[];const seen=new Set();
  if(!Array.isArray(source)||!source.length)errors.push({field:'items',message:'Vui lòng chọn ít nhất một sản phẩm'});
  for(const [index,item] of (source||[]).entries()) {
    const productId=String(item?.mamypham??item?.cosmeticId??item?.maMyPham??'').trim();
    const count=positiveInteger(item?.soluong??item?.quantity??item?.soLuong);
    if(!productId)errors.push({field:`items.${index}.mamypham`,message:'Vui lòng chọn sản phẩm'});
    if(count===null)errors.push({field:`items.${index}.soluong`,message:'Số lượng phải là số nguyên từ 1 trở lên.'});
    if(seen.has(productId))errors.push({field:`items.${index}.mamypham`,message:'Sản phẩm đã được chọn!'});
    seen.add(productId);items.push({mamypham:productId,soluong:count});
  }
  if(errors.length)throw badRequest('Thông tin bán lẻ chưa hợp lệ.',errors);
  return inTransaction(async transaction=>{
    const customer=await findCustomer(customerId,transaction);
    await setSupabaseAuthContext(transaction,user);
    let saleId;
    try {
      saleId=(await requestFor(transaction).input('customer',dbTypes.VarChar(10),customerId).input('items',dbTypes.VarChar,JSON.stringify(items))
        .query('SELECT public.fn_ghi_nhan_ban(@customer,@items::jsonb) AS id')).recordset[0]?.id;
    } catch(rpcError) {
      console.error('Lỗi fn_ghi_nhan_ban:',rpcError);
      throw error(422,'RETAIL_SALE_RPC_FAILED',rpcError.message);
    }
    if(!saleId)throw error(500,'RETAIL_SALE_RPC_EMPTY','Hàm ghi nhận bán không trả về mã đơn.');
    await requestFor(transaction).input('saleId',dbTypes.Char(10),saleId).input('saleDate',dbTypes.Date,saleDate)
      .query('UPDATE dbo.DonGhiNhanBan SET ngayMua=@saleDate WHERE maDon=@saleId');
    return {id:String(saleId).trim(),customerId:customer.id,message:'Ghi nhận bán lẻ thành công'};
  });
}

export async function listReviews(query={}) {
  // DanhGia không có maDonMua/maTK trong schema thật, nên không thể nối liệu
  // trình/dịch vụ; giữ nguyên hình dạng phản hồi với giá trị null.
  const rows=(await getPool().request().query(`SELECT r.maDanhGia AS id,r.thoiGianDanhGia AS reviewedAt,k.hoTen AS customerName,NULL AS serviceName,
    r.mucDanhGia AS rating,r.noiDung AS content,k.maKhachHang AS customerId,NULL AS servicePackageId
    FROM dbo.DanhGia r JOIN dbo.KhachHang k ON k.maKhachHang=r.maKhachHang ORDER BY r.thoiGianDanhGia DESC,r.maDanhGia DESC`)).recordset;
  const keyword=normalizeVietnamese(query.keyword||'');
  const filtered=keyword?rows.filter(x=>normalizeVietnamese(`${x.customerName} ${x.serviceName||''} ${x.rating} ${x.content}`).includes(keyword)):rows;
  return paginate(filtered,query.page,query.limit);
}

export async function getReview(id) {
  const row=(await getPool().request().input('id',dbTypes.Char(10),id).query(`SELECT r.maDanhGia AS id,r.noiDung AS content,r.mucDanhGia AS rating,r.hinhAnh AS image,
    r.thoiGianDanhGia AS reviewedAt,k.maKhachHang AS customerId,k.hoTen AS customerName,k.soDienThoai AS customerPhone,
    NULL AS serviceName,NULL AS staffName,NULL AS servicePackageId FROM dbo.DanhGia r
    JOIN dbo.KhachHang k ON k.maKhachHang=r.maKhachHang WHERE r.maDanhGia=@id`)).recordset[0];
  if(!row)throw notFound('Không tìm thấy đánh giá phù hợp!');
  return {...row,id:row.id.trim(),customerId:row.customerId.trim(),servicePackageId:row.servicePackageId?.trim()||null,rating:Number(row.rating)};
}

export async function createReview(body,user=null) {
  if(!body||typeof body!=='object'||Array.isArray(body))body={};
  const customerId=String(body.customerId??body.maKhachHang??'').trim();
  const packageId=String(body.servicePackageId??body.maDonMua??'').trim();
  const content=String(body.content??body.noiDung??'').trim();
  const rating=Number(body.rating??body.mucDanhGia);const image=body.image??body.hinhAnh??null;
  const errors=[];
  if(!customerId)errors.push({field:'customerId',message:'Khách hàng không được bỏ trống'});
  if(!packageId)errors.push({field:'servicePackageId',message:'Liệu trình không được bỏ trống'});
  if(!content)errors.push({field:'content',message:'Nội dung đánh giá không được bỏ trống'});
  if(content.length>200)errors.push({field:'content',message:'Nội dung tối đa 200 ký tự'});
  if(!Number.isInteger(rating)||rating<1||rating>5)errors.push({field:'rating',message:'Mức đánh giá phải từ 1 đến 5 sao'});
  if(image!=null&&(typeof image!=='string'||image.length>255))errors.push({field:'image',message:'Đường dẫn ảnh tối đa 255 ký tự'});
  if(errors.length)throw badRequest('Thông tin đánh giá chưa hợp lệ.',errors);
  return inTransaction(async transaction=>{
    await findCustomer(customerId,transaction);
    const pkg=(await requestFor(transaction).input('id',dbTypes.Char(10),packageId).input('customer',dbTypes.Char(10),customerId).query(`SELECT maDonMua AS "maDonMua",trangThaiHoanThanh AS "trangThaiHoanThanh" FROM dbo.DonMuaDV WITH (UPDLOCK,HOLDLOCK)
      WHERE maDonMua=@id AND maKhachHang=@customer`)).recordset[0];
    if(!pkg)throw notFound('Không tìm thấy liệu trình phù hợp!');
    if(pkg.trangThaiHoanThanh!=='Đã hoàn thành')throw error(409,'SERVICE_NOT_COMPLETED','Chỉ đánh giá được dịch vụ đã hoàn thành.');
    const id=await nextCode('DG',transaction);const date=new Date();
    await requestFor(transaction).input('id',dbTypes.Char(10),id).input('content',dbTypes.NVarChar(200),content).input('rating',dbTypes.Int,rating)
      .input('image',dbTypes.VarChar(255),image).input('date',dbTypes.DateTime2,date).input('customer',dbTypes.Char(10),customerId)
      .query('INSERT INTO dbo.DanhGia(maDanhGia,noiDung,mucDanhGia,hinhAnh,thoiGianDanhGia,maKhachHang) VALUES(@id,@content,@rating,@image,@date,@customer)');
    await insertAudit({transaction,user,action:'Ghi nhận đánh giá khách hàng',entity:'DanhGia',entityId:id,before:null,
      after:{maKhachHang:customerId,maDonMua:packageId,mucDanhGia:rating,noiDung:content,hinhAnh:image}});
    return {id:id.trim(),customerId:customerId.trim(),servicePackageId:packageId.trim(),rating,content,image,reviewedAt:date,message:'Ghi nhận đánh giá thành công'};
  });
}
