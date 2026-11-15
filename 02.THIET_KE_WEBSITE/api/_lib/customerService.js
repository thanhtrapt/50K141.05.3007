import { getPool,inTransaction,requestFor,dbTypes } from './database.js';
import { AppError,badRequest,notFound } from './errors.js';
import { insertAudit,nextCode } from './repositories.js';
import { normalizeVietnamese,paginate } from './utils.js';
import { updateStockAlerts } from './stockService.js';
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
  if(errors.length)throw error(400,'VALIDATION_ERROR','Thông tin khách hàng chưa hợp lệ.',errors);
  return result;
}

async function findCustomer(id,transaction) {
  const row=(await requestFor(transaction).input('id',dbTypes.Char(10),id).query(`SELECT maKhachHang AS id,hoTen AS name,ngaySinh AS dateOfBirth,soDienThoai AS phone,
    soLanHuyLich AS cancellationCount FROM dbo.KhachHang WHERE maKhachHang=@id`)).recordset[0];
  if(!row)throw notFound('Không tìm thấy khách hàng phù hợp!');
  return {...row,id:row.id.trim(),dateOfBirth:dateText(row.dateOfBirth),cancellationCount:Number(row.cancellationCount)};
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
    s.maDichVu AS serviceId,s.tenDV AS serviceName,s.tongSoBuoi AS totalSessions
    FROM dbo.DonMuaDV d JOIN dbo.DichVu s ON s.maDichVu=d.maDichVu WHERE d.maKhachHang=@customer ORDER BY d.ngayMua DESC,d.maDonMua DESC`)).recordset;
  return rows.map(row=>({...row,id:row.id.trim(),serviceId:row.serviceId.trim(),purchaseDate:row.purchaseDate,
    sessionsCompleted:Number(row.sessionsCompleted),purchasePrice:Number(row.purchasePrice),totalSessions:Number(row.totalSessions)}));
}

async function retailPurchaseRows(customerId,transaction) {
  return (await requestFor(transaction).input('customer',dbTypes.Char(10),customerId).query(`SELECT o.maDon AS saleId,o.ngayMua AS purchaseDate,p.maMyPham AS cosmeticId,
    p.tenMyPham AS cosmeticName,l.soLuong AS quantity,l.donGia AS unitPrice,l.thanhTien AS lineTotal,l.maLo AS batchId
    FROM dbo.DonGhiNhanBan o JOIN dbo.CT_DonGhiNhanBan l ON l.maDon=o.maDon JOIN dbo.LoHang b ON b.maLo=l.maLo
    JOIN dbo.MyPham p ON p.maMyPham=b.maMyPham WHERE o.maKhachHang=@customer ORDER BY o.ngayMua DESC,o.maDon DESC,l.maCT_Don`)).recordset;
}

export async function getCustomer(id) {
  const customer=await findCustomer(id);const packages=await packageSummaries(id);const purchasedProducts=await retailPurchaseRows(id);
  const threshold=await blacklistLimit();
  const grouped=new Map();
  for(const row of purchasedProducts) {
    const key=`${row.saleId}|${row.cosmeticId}`;const existing=grouped.get(key);
    if(existing){existing.quantity+=Number(row.quantity);existing.lineTotal+=Number(row.lineTotal);}
    else grouped.set(key,{saleId:row.saleId.trim(),purchaseDate:row.purchaseDate,cosmeticId:row.cosmeticId.trim(),cosmeticName:row.cosmeticName,
      quantity:Number(row.quantity),unitPrice:Number(row.unitPrice),lineTotal:Number(row.lineTotal)});
  }
  const productRows=[...grouped.values()];
  return {...customer,isBlacklisted:customer.cancellationCount>=threshold,blacklistThreshold:threshold,
    activeServices:packages.filter(item=>item.completionStatus!=='Đã hoàn thành'),serviceHistory:packages,
    purchasedProducts:productRows,
    emptyLabels:{additionalServices:packages.length?null:'Chưa có dịch vụ phát sinh',purchasedProducts:productRows.length?null:'Chưa có sản phẩm mua thêm',serviceHistory:packages.length?null:'Chưa có lịch sử dịch vụ'},
    actions:{recordRetailSale:true,viewServiceHistory:true}};
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
  const fields=customerFields(body,{partial:true});
  if(!Object.keys(fields).length)throw badRequest('Thông tin khách hàng chưa hợp lệ.');
  return inTransaction(async transaction=>{
    const before=await findCustomer(id,transaction);
    if(fields.soDienThoai)await ensureUniquePhone(fields.soDienThoai,id,transaction);
    const set=[];const request=requestFor(transaction).input('id',dbTypes.Char(10),id);
    if(fields.hoTen!==undefined){set.push('hoTen=@name');request.input('name',dbTypes.NVarChar(50),fields.hoTen);}
    if(fields.ngaySinh!==undefined){set.push('ngaySinh=@dob');request.input('dob',dbTypes.Date,fields.ngaySinh);}
    if(fields.soDienThoai!==undefined){set.push('soDienThoai=@phone');request.input('phone',dbTypes.VarChar(10),fields.soDienThoai);}
    await request.query(`UPDATE dbo.KhachHang SET ${set.join(',')} WHERE maKhachHang=@id`);
    const after=await findCustomer(id,transaction);
    await insertAudit({transaction,user,action:'Cập nhật thông tin khách hàng',entity:'KhachHang',entityId:id,before,after});
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
  const items=await packageSummaries(customerId);
  const keyword=normalizeVietnamese(query.keyword||'');
  const filtered=keyword?items.filter(row=>normalizeVietnamese(`${row.serviceName} ${row.id} ${row.paymentStatus} ${row.completionStatus}`).includes(keyword)):items;
  return paginate(filtered,query.page,query.limit);
}

export async function assignServicePackage(customerId,body,user) {
  if(!body||typeof body!=='object'||Array.isArray(body))body={};
  const serviceId=String(body.serviceId??body.maDichVu??'').trim();
  const paymentStatus=String(body.paymentStatus??body.trangThaiThanhToan??'Chưa thanh toán');
  const purchaseDate=body.purchaseDate??body.ngayMua??new Date();
  const rawPurchasePrice=body.purchasePrice??body.giaMua;
  const requestedPurchasePrice=rawPurchasePrice==null?null:money(rawPurchasePrice);
  const note=body.note??body.ghiChu??null;
  const errors=[];
  if(!serviceId)errors.push({field:'serviceId',message:'Dịch vụ không được bỏ trống'});
  if(!['Đã thanh toán','Chưa thanh toán'].includes(paymentStatus))errors.push({field:'paymentStatus',message:'Trạng thái thanh toán không hợp lệ'});
  if(rawPurchasePrice!=null&&requestedPurchasePrice===null)errors.push({field:'purchasePrice',message:'Giá dịch vụ phải là số nguyên dương'});
  if(note!=null&&String(note).length>255)errors.push({field:'note',message:'Ghi chú tối đa 255 ký tự'});
  if(errors.length)throw badRequest('Thông tin chưa hoàn tất, yêu cầu nhập lại',errors);
  return inTransaction(async transaction=>{
    const customer=await findCustomer(customerId,transaction);
    const service=(await requestFor(transaction).input('id',dbTypes.Char(10),serviceId).query(`SELECT maDichVu AS "maDichVu",tenDV AS "tenDV",giaDV AS "giaDV",tongSoBuoi AS "tongSoBuoi" FROM dbo.DichVu WITH (UPDLOCK,HOLDLOCK)
      WHERE maDichVu=@id`)).recordset[0];
    if(!service)throw notFound('Không tìm thấy dịch vụ phù hợp!');
    const templates=(await requestFor(transaction).input('id',dbTypes.Char(10),serviceId).query(`SELECT maCT_DichVu AS "maCT_DichVu",tenBuoi AS "tenBuoi",kyThuat AS "kyThuat",thoiGianThucHien AS "thoiGianThucHien",myPhamSD AS "myPhamSD"
      FROM dbo.CT_DichVu WITH (HOLDLOCK) WHERE maDichVu=@id ORDER BY maCT_DichVu`)).recordset;
    if(templates.length!==Number(service.tongSoBuoi))throw error(409,'SERVICE_TEMPLATE_MISMATCH','Cấu hình số buổi của dịch vụ chưa khớp chi tiết buổi.');
    const purchasePrice=requestedPurchasePrice??Number(service.giaDV);
    const packageId=await nextCode('LHD',transaction);
    const dateValue=purchaseDate instanceof Date?purchaseDate:new Date(purchaseDate);
    if(Number.isNaN(dateValue.valueOf()))throw badRequest('Ngày mua dịch vụ không hợp lệ.',[{field:'purchaseDate',message:'Ngày mua dịch vụ không hợp lệ'}]);
    await requestFor(transaction).input('id',dbTypes.Char(10),packageId).input('date',dbTypes.DateTime2,dateValue)
      .input('payment',dbTypes.NVarChar(50),paymentStatus).input('note',dbTypes.NVarChar(255),note==null?null:String(note))
      .input('service',dbTypes.Char(10),serviceId).input('customer',dbTypes.Char(10),customerId)
      .input('price',dbTypes.Money,purchasePrice).query(`INSERT INTO dbo.DonMuaDV(maDonMua,ngayMua,trangThaiThanhToan,trangThaiHoanThanh,fileTongHop,soBuoiDaThucHien,ghiChu,maDichVu,maKhachHang)
        VALUES(@id,@date,@payment,N'Chưa thực hiện',NULL,0,@note,@service,@customer)`);
    for(const template of templates) {
      const sessionId=await nextCode('CM',transaction);
      await requestFor(transaction).input('id',dbTypes.Char(10),sessionId).input('name',dbTypes.NVarChar(20),template.tenBuoi)
        .input('servicePackage',dbTypes.Char(10),packageId).input('templateId',dbTypes.Char(10),template.maCT_DichVu)
        .query(`INSERT INTO dbo.CT_DonMua(maCT_DonMua,tenBuoi,trangThaiThucHien,xacNhanKH,maDonMua,maCT_DichVu)
          VALUES(@id,@name,N'Chưa thực hiện',N'Chưa xác nhận',@servicePackage,@templateId)`);
    }
    const after={maDonMua:packageId,maKhachHang:customerId,maDichVu:serviceId,ngayMua:dateValue,trangThaiThanhToan:paymentStatus,
      trangThaiHoanThanh:'Chưa thực hiện',giaMua:purchasePrice,tongSoBuoi:templates.length,sessions:templates};
    await insertAudit({transaction,user,action:'Gán liệu trình cho khách hàng',entity:'DonMuaDV',entityId:packageId,before:null,after});
    return {id:packageId.trim(),customerId:customer.id,serviceId:service.maDichVu.trim(),serviceName:service.tenDV,purchaseDate:dateValue,
      paymentStatus,completionStatus:'Chưa thực hiện',purchasePrice,totalSessions:templates.length,sessionsCompleted:0,message:'Gán dịch vụ cho khách hàng thành công'};
  });
}

export async function getServicePackage(id) {
  const head=(await getPool().request().input('id',dbTypes.Char(10),id).query(`SELECT d.maDonMua AS id,d.maKhachHang AS customerId,k.hoTen AS customerName,
    k.soDienThoai AS customerPhone,d.maDichVu AS serviceId,s.tenDV AS serviceName,d.ngayMua AS purchaseDate,NULL AS endedAt,
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
    s.tenDV AS serviceName,c.maCT_DonMua AS "maCT_DonMua",c.trangThaiThucHien AS "trangThaiThucHien",c.xacNhanKH AS "xacNhanKH",c.ghiChu AS "ghiChu",c.maCT_DichVu AS "maCT_DichVu",
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
    await requestFor(transaction).input('id',dbTypes.Char(10),sessionId).input('package',dbTypes.Char(10),packageId)
      .input('result',dbTypes.NVarChar(255),result).input('image',dbTypes.NVarChar(255),image).input('note',dbTypes.NVarChar(255),note)
      .query(`UPDATE dbo.CT_DonMua SET trangThaiThucHien=N'Chờ xác nhận',xacNhanKH=N'Chưa xác nhận',ketQua=@result,hinhAnh=@image,ghiChu=@note,ngayThucHien=SYSDATETIME()
        WHERE maCT_DonMua=@id AND maDonMua=@package`);
    await insertAudit({transaction,user,action:'Hoàn thành buổi dịch vụ, chờ khách xác nhận',entity:'CT_DonMua',entityId:sessionId,
      before:{trangThaiThucHien:row.trangThaiThucHien},after:{trangThaiThucHien:'Chờ xác nhận',ketQua:result,hinhAnh:image}});
    const confirmationUrl=createConfirmationUrl(packageId,sessionId);
    await enqueueNotification(transaction,{event:'SESSION_CONFIRM_REQUEST',recipient:row.customerPhone,sessionId,
      payload:{packageId:packageId.trim(),sessionId:sessionId.trim(),customerId:row.maKhachHang.trim(),customerName:row.customerName,
        phone:row.customerPhone,serviceName:row.serviceName,sessionName:row.sessionName||'Buổi dịch vụ',result,image,
        imageUrl:image&&image.startsWith('/')?`${config.publicBaseUrl}${image}`:image,confirmationUrl}});
    return {packageId:packageId.trim(),sessionId:sessionId.trim(),status:'Chờ xác nhận',customerConfirmation:'Chưa xác nhận',message:'Cập nhật buổi dịch vụ thành công!'};
  });
}

export async function confirmPackageSession(packageId,sessionId,user=null) {
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

export async function listRetailCosmetics(query={}) {
  const result=await getPool().request().query(`SELECT maMyPham AS id,tenMyPham AS name,donViTinh AS unit,giaBan AS price,soLuongTonKho AS stock
    FROM dbo.MyPham WHERE phanLoai=N'Bán lẻ' ORDER BY tenMyPham`);
  const rows=result.recordset.map(x=>({...x,id:x.id.trim(),price:Number(x.price),stock:Number(x.stock)}));
  const keyword=normalizeVietnamese(query.keyword||'');
  return paginate(keyword?rows.filter(x=>normalizeVietnamese(`${x.id} ${x.name}`).includes(keyword)):rows,query.page,query.limit);
}

export async function createRetailSale(customerId,body,user) {
  if(!body||typeof body!=='object'||Array.isArray(body))body={};
  const items=body.items;
  const errors=[];const prepared=[];const seen=new Set();
  if(!Array.isArray(items)||!items.length)errors.push({field:'items',message:'Vui lòng chọn ít nhất một sản phẩm'});
  for(const [index,item] of (items||[]).entries()) {
    if(!item||typeof item!=='object'||Array.isArray(item)) {
      errors.push({field:`items.${index}`,message:'Dòng sản phẩm không hợp lệ'});
      continue;
    }
    const productId=String(item.cosmeticId??item.maMyPham??'').trim();const count=quantity(item.quantity??item.soLuong);
    if(!productId)errors.push({field:`items.${index}.cosmeticId`,message:'Vui lòng chọn sản phẩm'});
    if(count===null)errors.push({field:`items.${index}.quantity`,message:'Giá trị nhập không hợp lệ.'});
    if(seen.has(productId))errors.push({field:`items.${index}.cosmeticId`,message:'Sản phẩm đã được chọn!'});
    seen.add(productId);prepared.push({productId,count});
  }
  if(errors.length)throw badRequest('Thông tin bán lẻ chưa hợp lệ.',errors);
  return inTransaction(async transaction=>{
    await findCustomer(customerId,transaction);
    const plans=[];let total=0;
    for(const item of prepared) {
      const product=(await requestFor(transaction).input('id',dbTypes.Char(10),item.productId).query(`SELECT maMyPham AS "maMyPham",tenMyPham AS "tenMyPham",donViTinh AS "donViTinh",giaBan AS "giaBan",soLuongTonKho AS "soLuongTonKho" FROM dbo.MyPham WITH (UPDLOCK,HOLDLOCK)
        WHERE maMyPham=@id AND phanLoai=N'Bán lẻ'`)).recordset[0];
      if(!product)throw notFound('Không tìm thấy sản phẩm phù hợp!');
      if(item.count>Number(product.soLuongTonKho))throw badRequest('Giá trị nhập không hợp lệ.',[{field:'items.quantity',message:'Giá trị nhập không hợp lệ.'}]);
      const price=Number(product.giaBan);const lineTotal=price*item.count;total+=lineTotal;
      const batches=(await requestFor(transaction).input('product',dbTypes.Char(10),item.productId).query(`SELECT maLo AS "maLo",soLuongTonLo AS "soLuongTonLo",hanSuDung AS "hanSuDung" FROM dbo.LoHang WITH (UPDLOCK,HOLDLOCK)
        WHERE maMyPham=@product AND soLuongTonLo>0 AND hanSuDung>=CONVERT(date,GETDATE()) ORDER BY hanSuDung ASC,maLo ASC`)).recordset;
      const available=batches.reduce((sum,row)=>sum+Number(row.soLuongTonLo),0);
      if(available<item.count)throw badRequest('Giá trị nhập không hợp lệ.',[{field:'items.quantity',message:'Giá trị nhập không hợp lệ.'}]);
      let remaining=item.count;const allocation=[];
      for(const batch of batches) {
        if(!remaining)break;
        const take=Math.min(remaining,Number(batch.soLuongTonLo));allocation.push({batchId:batch.maLo.trim(),quantity:take});remaining-=take;
      }
      plans.push({productId:item.productId,productName:product.tenMyPham,unit:product.donViTinh,price,quantity:item.count,lineTotal,allocation});
    }
    const saleId=await nextCode('PNB',transaction);const soldAt=new Date();
    await requestFor(transaction).input('id',dbTypes.Char(10),saleId).input('date',dbTypes.DateTime2,soldAt).input('total',dbTypes.Money,total)
      .input('account',dbTypes.Char(10),user.id).input('customer',dbTypes.Char(10),customerId)
      .query('INSERT INTO dbo.DonGhiNhanBan(maDon,ngayMua,tongTien,maTK,maKhachHang) VALUES(@id,@date,@total,@account,@customer)');
    for(const plan of plans) {
      for(const allocation of plan.allocation) {
        const lineId=await nextCode('CB',transaction);const amount=plan.price*allocation.quantity;
        const update=await requestFor(transaction).input('lot',dbTypes.Char(10),allocation.batchId).input('quantity',dbTypes.Int,allocation.quantity)
          .query('UPDATE dbo.LoHang SET soLuongTonLo=soLuongTonLo-@quantity WHERE maLo=@lot AND soLuongTonLo>=@quantity');
        if(update.rowsAffected?.[0]!==1)throw error(409,'STOCK_CHANGED','Số lượng tồn kho vừa thay đổi, vui lòng tải lại.');
        await requestFor(transaction).input('line',dbTypes.Char(10),lineId).input('quantity',dbTypes.Int,allocation.quantity).input('price',dbTypes.Money,plan.price)
          .input('amount',dbTypes.Money,amount).input('sale',dbTypes.Char(10),saleId).input('lot',dbTypes.Char(10),allocation.batchId)
          .query('INSERT INTO dbo.CT_DonGhiNhanBan(maCT_Don,soLuong,donGia,thanhTien,maDon,maLo) VALUES(@line,@quantity,@price,@amount,@sale,@lot)');
      }
      const stock=(await requestFor(transaction).input('id',dbTypes.Char(10),plan.productId).input('quantity',dbTypes.Int,plan.quantity)
        .query('UPDATE dbo.MyPham SET soLuongTonKho=soLuongTonKho-@quantity WHERE maMyPham=@id AND soLuongTonKho>=@quantity RETURNING soLuongTonKho AS stock')).recordset[0];
      if(!stock)throw error(409,'STOCK_CHANGED','Số lượng tồn kho vừa thay đổi, vui lòng tải lại.');
      await updateStockAlerts(transaction,user,plan.productId,Number(stock.stock));
    }
    await insertAudit({transaction,user,action:'Ghi nhận sản phẩm mua thêm',entity:'DonGhiNhanBan',entityId:saleId,before:null,
      after:{maKhachHang:customerId,ngayMua:soldAt,tongTien:total,items:plans}});
    return {id:saleId.trim(),customerId:customerId.trim(),soldAt,total,items:plans,message:'Ghi nhận thành công!'};
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
