import { getPool,inTransaction,requestFor,dbTypes } from './database.js';
import { AppError,badRequest,notFound } from './errors.js';
import { insertAudit,nextCode } from './repositories.js';
import { normalizeVietnamese,paginate } from './utils.js';

const err=(status,code,message,fieldErrors=[])=>new AppError(status,code,message,fieldErrors);
const datePattern=/^\d{4}-\d{2}-\d{2}$/;
const timePattern=/^(?:[01]\d|2[0-3]):[0-5]\d$/;
const dayText=value=>value instanceof Date?new Intl.DateTimeFormat('sv-SE',{timeZone:'UTC'}).format(value):String(value).slice(0,10);
const clockText=value=>value instanceof Date?`${String(value.getUTCHours()).padStart(2,'0')}:${String(value.getUTCMinutes()).padStart(2,'0')}`:String(value).slice(0,5);
const mins=value=>{const [h,m]=String(value).split(':').map(Number);return h*60+m;};
const clock=value=>`${String(Math.floor(value/60)).padStart(2,'0')}:${String(value%60).padStart(2,'0')}`;
const isDate=value=>datePattern.test(String(value))&&!Number.isNaN(Date.parse(`${value}T00:00:00Z`))&&new Date(`${value}T00:00:00Z`).toISOString().slice(0,10)===value;
const nowLocal=()=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Ho_Chi_Minh',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date()).replace(',','');

async function settings() {
  // CauHinhHeThong không tồn tại trong schema thật; dùng giá trị mặc định.
  return {};
}

async function appointmentSession(customerId,sessionId,transaction) {
  const row=(await requestFor(transaction).input('customer',dbTypes.Char(10),customerId).input('session',dbTypes.Char(10),sessionId)
    .query(`SELECT c.maCT_DonMua AS sessionId,c.maDonMua AS packageId,d.maKhachHang AS customerId,d.trangThaiHoanThanh AS packageStatus,
      t.thoiGianThucHien AS durationMinutes,COALESCE(c.tenBuoi,t.tenBuoi) AS sessionName,
      k.hoTen AS customerName,k.soDienThoai AS customerPhone,c.trangThaiThucHien AS sessionStatus
      FROM dbo.CT_DonMua c WITH (UPDLOCK,HOLDLOCK) JOIN dbo.DonMuaDV d ON d.maDonMua=c.maDonMua
      JOIN dbo.KhachHang k ON k.maKhachHang=d.maKhachHang LEFT JOIN dbo.CT_DichVu t ON t.maCT_DichVu=c.maCT_DichVu
      WHERE c.maCT_DonMua=@session AND d.maKhachHang=@customer`)).recordset[0];
  if(!row)throw notFound('Không tìm thấy khách hàng hoặc buổi dịch vụ phù hợp!');
  if(row.packageStatus==='Đã hoàn thành'||row.sessionStatus==='Đã hoàn thành')throw err(409,'SERVICE_ALREADY_COMPLETED','Không thể đặt lịch cho dịch vụ đã hoàn thành.');
  if(!Number(row.durationMinutes))throw err(409,'SERVICE_DURATION_MISSING','Không xác định được thời lượng buổi dịch vụ.');
  return {...row,sessionId:row.sessionId.trim(),packageId:row.packageId.trim(),customerId:row.customerId.trim(),durationMinutes:Number(row.durationMinutes)};
}

async function busyAppointments(date,excludeId,transaction) {
  const result=await requestFor(transaction).input('date',dbTypes.Date,date).input('exclude',dbTypes.Char(10),excludeId||'').query(`SELECT l.maLichHen AS id,
    CONVERT(varchar(5),l.gioBatDau,108) AS startTime,CONVERT(varchar(5),l.gioKetThuc,108) AS endTime,l.trangThai AS status,k.hoTen AS customerName
    FROM dbo.LichHen AS l WITH (UPDLOCK,HOLDLOCK) LEFT JOIN dbo.KhachHang AS k ON k.maKhachHang=l.maKhachHang
    WHERE l.ngayHen=@date AND l.trangThai NOT IN (N'Đã hủy',N'Hoàn thành') AND l.maLichHen<>@exclude`);
  return result.recordset.map(row=>({...row,id:row.id.trim(),customerName:row.customerName||'lịch hẹn khác',startMinutes:mins(row.startTime),endMinutes:mins(row.endTime)}));
}

function freeAt(start,duration,busy,capacity) {
  const end=start+duration;if(busy.length===0)return end;
  const events=[];
  for(const row of busy) {
    const left=Math.max(start,row.startMinutes),right=Math.min(end,row.endMinutes);
    if(left<right){events.push({minute:left,delta:1},{minute:right,delta:-1});}
  }
  events.sort((a,b)=>a.minute-b.minute||a.delta-b.delta);
  let active=0,peak=0;
  for(const event of events){active+=event.delta;peak=Math.max(peak,active);}
  return peak+1<=capacity;
}

export function availableSlots({date,duration,busy,config,limit=3}) {
  const opening=mins(String(config.SPA_OPEN_TIME||'08:00').slice(0,5));
  const closing=mins(String(config.SPA_CLOSE_TIME||'20:00').slice(0,5));
  const step=Math.max(1,Number(config.APPOINTMENT_SLOT_MINUTES||30));
  const capacity=Math.max(1,Math.min(Number(config.SERVICE_BED_COUNT||3),Number(config.SERVICE_PROVIDER_COUNT||1)));
  const result=[];
  for(let start=opening;start+duration<=closing&&result.length<limit;start+=step) {
    if(freeAt(start,duration,busy,capacity))result.push({date,startTime:clock(start),endTime:clock(start+duration)});
  }
  return result;
}

async function checkSlot({date,startTime,duration,excludeId,transaction}) {
  const config=await settings(transaction);const start=mins(startTime);const end=start+duration;
  const opening=mins(String(config.SPA_OPEN_TIME||'08:00').slice(0,5));const closing=mins(String(config.SPA_CLOSE_TIME||'20:00').slice(0,5));
  if(start<opening||end>closing)throw badRequest('Lịch hẹn phải nằm trong giờ hoạt động của Spa.',[{field:'startTime',message:`Khung giờ hoạt động: ${clock(opening)}–${clock(closing)}`}]);
  const now=nowLocal();
  if(`${date} ${startTime}`<now)throw badRequest('Không thể tạo lịch hẹn trong quá khứ.',[{field:'startTime',message:'Chọn thời gian hiện tại hoặc tương lai'}]);
  const busy=await busyAppointments(date,excludeId,transaction);
  const capacity=Math.max(1,Math.min(Number(config.SERVICE_BED_COUNT||3),Number(config.SERVICE_PROVIDER_COUNT||1)));
  if(!freeAt(start,duration,busy,capacity)) {
    const end=start+duration;
    const conflict=busy.find(row=>start<row.endMinutes&&row.startMinutes<end);
    const detail=conflict?`${clock(start)}–${clock(end)} trùng lịch ${conflict.customerName} (${conflict.startTime}–${conflict.endTime}).`:'Giờ hẹn bị trùng lịch với lịch khác.';
    throw err(409,'APPOINTMENT_CONFLICT','Giờ hẹn bị trùng lịch với lịch khác',[{field:'startTime',message:detail,suggestions:availableSlots({date,duration,busy,config})}]);
  }
  return {endTime:clock(end),config};
}

// NhatKyThongBao không có trong schema thật: không xếp hàng nhắc lịch.
async function queueReminder() {
  return;
}

async function cancelReminder() {
  return;
}

function display(row) {
  return {...row,id:row.id.trim(),customerId:row.customerId?.trim()||null,sessionId:row.sessionId?.trim()||null,packageId:row.packageId?.trim()||null,
    date:dayText(row.date),startTime:clockText(row.startTime),endTime:clockText(row.endTime)};
}

export async function listAppointments(query={}) {
  let from=query.startDate||query.from||query.date||null;let to=query.endDate||query.to||query.date||null;
  if(from&&!isDate(from))throw badRequest('Ngày bắt đầu không hợp lệ.',[{field:'from',message:'Ngày phải có định dạng YYYY-MM-DD'}]);
  if(to&&!isDate(to))throw badRequest('Ngày kết thúc không hợp lệ.',[{field:'to',message:'Ngày phải có định dạng YYYY-MM-DD'}]);
  if(from&&to&&from>to)throw badRequest('Khoảng ngày không hợp lệ.',[{field:'to',message:'Ngày kết thúc phải sau ngày bắt đầu'}]);
  const request=getPool().request();
  if(from)request.input('fromDate',dbTypes.Date,from);if(to)request.input('toDate',dbTypes.Date,to);
  const result=await request.query(`SELECT h.maLichHen AS id,h.ngayHen AS date,h.gioBatDau AS startTime,h.gioKetThuc AS endTime,h.trangThai AS status,h.ghiChu AS note,
    h.maKhachHang AS customerId,k.hoTen AS customerName,k.soDienThoai AS customerPhone,h.maCT_DonMua AS sessionId,d.maDonMua AS packageId,
    COALESCE(c.tenBuoi,t.tenBuoi) AS sessionName
    FROM dbo.LichHen h LEFT JOIN dbo.KhachHang k ON k.maKhachHang=h.maKhachHang LEFT JOIN dbo.CT_DonMua c ON c.maCT_DonMua=h.maCT_DonMua
    LEFT JOIN dbo.DonMuaDV d ON d.maDonMua=c.maDonMua LEFT JOIN dbo.CT_DichVu t ON t.maCT_DichVu=c.maCT_DichVu
    WHERE h.trangThai<>N'Đã hủy' ${from?'AND h.ngayHen>=@fromDate':''} ${to?'AND h.ngayHen<=@toDate':''}
    ORDER BY h.ngayHen,h.gioBatDau,h.maLichHen`);
  let rows=result.recordset.map(display);
  const keyword=normalizeVietnamese(query.keyword||'');
  if(keyword)rows=rows.filter(x=>normalizeVietnamese(`${x.customerName||''} ${x.customerPhone||''}`).includes(keyword));
  return paginate(rows,query.page,query.limit);
}

export async function getAppointment(id,transaction) {
  const rows=(await requestFor(transaction).input('id',dbTypes.Char(10),id).query(`SELECT h.maLichHen AS id,h.ngayHen AS date,h.gioBatDau AS startTime,h.gioKetThuc AS endTime,h.trangThai AS status,h.ghiChu AS note,
    h.maKhachHang AS customerId,k.hoTen AS customerName,k.soDienThoai AS customerPhone,h.maCT_DonMua AS sessionId,d.maDonMua AS packageId,
    COALESCE(c.tenBuoi,t.tenBuoi) AS sessionName,t.thoiGianThucHien AS durationMinutes
    FROM dbo.LichHen h LEFT JOIN dbo.KhachHang k ON k.maKhachHang=h.maKhachHang LEFT JOIN dbo.CT_DonMua c ON c.maCT_DonMua=h.maCT_DonMua
    LEFT JOIN dbo.DonMuaDV d ON d.maDonMua=c.maDonMua LEFT JOIN dbo.CT_DichVu t ON t.maCT_DichVu=c.maCT_DichVu WHERE h.maLichHen=@id`)).recordset;
  if(!rows.length)throw notFound('Không tìm thấy lịch hẹn phù hợp!');
  return {...display(rows[0]),durationMinutes:Number(rows[0].durationMinutes)};
}

export async function getAvailability(query={}) {
  const date=String(query.date||'');
  if(!isDate(date))throw badRequest('Ngày hẹn không hợp lệ.',[{field:'date',message:'Ngày phải có định dạng YYYY-MM-DD'}]);
  let duration=Number(query.durationMinutes||0);let session=null;
  if(query.sessionId&&query.customerId) {
    session=await appointmentSession(query.customerId,query.sessionId);
    duration=session.durationMinutes;
  }
  if(!Number.isInteger(duration)||duration<=0)throw badRequest('Thời lượng dịch vụ không hợp lệ.',[{field:'durationMinutes',message:'Thời lượng phải là số nguyên dương'}]);
  const config=await settings();const busy=await busyAppointments(date,null);
  return {date,durationMinutes:duration,availableSlots:availableSlots({date,duration,busy,config,limit:12}),
    workingHours:{open:String(config.SPA_OPEN_TIME||'08:00').slice(0,5),close:String(config.SPA_CLOSE_TIME||'20:00').slice(0,5)},
    slotMinutes:Number(config.APPOINTMENT_SLOT_MINUTES||30)};
}

export function validateDateAndTime(body) {
  const date=String(body.date??body.ngayHen??'');const startTime=String(body.startTime??body.gioBatDau??'');
  const errors=[];
  if(!isDate(date))errors.push({field:'date',message:'Ngày hẹn không hợp lệ'});
  if(!timePattern.test(startTime))errors.push({field:'startTime',message:'Giờ bắt đầu phải có định dạng HH:mm'});
  if(errors.length)throw badRequest('Thông tin lịch hẹn chưa hợp lệ.',errors);
  return {date,startTime};
}

export async function createAppointment(body,user) {
  body=body&&typeof body==='object'&&!Array.isArray(body)?body:{};
  const {date,startTime}=validateDateAndTime(body);let customerId=String(body.customerId??body.maKhachHang??'').trim();
  let sessionId=String(body.sessionId??body.maCT_DonMua??'').trim();const customerPhone=String(body.customerPhone??body.soDienThoai??'').trim();
  const serviceName=String(body.serviceName??body.tenDV??'').trim();const note=body.note??body.ghiChu??null;
  const errors=[];
  if(!customerId&&!customerPhone)errors.push({field:'customerId',message:'Khách hàng không được bỏ trống'});
  if(!sessionId&&(!customerPhone||!serviceName))errors.push({field:'sessionId',message:'Buổi dịch vụ không được bỏ trống'});
  if(note!=null&&(typeof note!=='string'||note.length>200))errors.push({field:'note',message:'Ghi chú tối đa 200 ký tự'});
  if(errors.length)throw badRequest('Thông tin lịch hẹn chưa hoàn tất, yêu cầu nhập lại',errors);
  return inTransaction(async transaction=>{
    const config=await settings(transaction);const threshold=Number(config.BLACKLIST_CANCEL_LIMIT||3);
    if(!customerId) {
      const match=(await requestFor(transaction).input('phone',dbTypes.VarChar(10),customerPhone).query('SELECT TOP(1) maKhachHang AS "maKhachHang" FROM dbo.KhachHang WITH (UPDLOCK,HOLDLOCK) WHERE soDienThoai=@phone')).recordset[0];
      if(!match)throw notFound('Không tìm thấy khách hàng phù hợp!');
      customerId=match.maKhachHang.trim();
    }
    if(!sessionId) {
      const match=(await requestFor(transaction).input('customer',dbTypes.Char(10),customerId).input('serviceName',dbTypes.NVarChar(100),serviceName).query(`SELECT TOP(1) c.maCT_DonMua AS "maCT_DonMua"
        FROM dbo.CT_DonMua c WITH (UPDLOCK,HOLDLOCK) JOIN dbo.DonMuaDV d ON d.maDonMua=c.maDonMua
        JOIN dbo.DichVu v ON v.maDichVu=d.maDichVu
        WHERE d.maKhachHang=@customer AND v.tenDV=@serviceName AND c.trangThaiThucHien=N'Chưa thực hiện'
        ORDER BY d.ngayMua,c.maCT_DonMua`)).recordset[0];
      if(!match)throw notFound('Không tìm thấy buổi dịch vụ phù hợp!');
      sessionId=match.maCT_DonMua.trim();
    }
    const customer=(await requestFor(transaction).input('id',dbTypes.Char(10),customerId).query('SELECT maKhachHang AS "maKhachHang",hoTen AS "hoTen",soDienThoai AS "soDienThoai",soLanHuyLich AS "soLanHuyLich" FROM dbo.KhachHang WITH (UPDLOCK,HOLDLOCK) WHERE maKhachHang=@id')).recordset[0];
    if(!customer)throw notFound('Không tìm thấy khách hàng phù hợp!');
    if(Number(customer.soLanHuyLich)>=threshold)throw err(409,'CUSTOMER_BLACKLISTED','Khách hàng thuộc danh sách đen!',[{field:'customerPhone',message:`${customer.hoTen} đã hủy lịch ${customer.soLanHuyLich} lần. Vui lòng cân nhắc trước khi lưu; bạn vẫn có thể tạo lịch hẹn.`}]);
    const session=await appointmentSession(customerId,sessionId,transaction);
    const slot=await checkSlot({date,startTime,duration:session.durationMinutes,transaction});
    const duplicate=(await requestFor(transaction).input('session',dbTypes.Char(10),sessionId).query(`SELECT TOP(1) maLichHen FROM dbo.LichHen WITH (UPDLOCK,HOLDLOCK)
      WHERE maCT_DonMua=@session AND trangThai NOT IN(N'Đã hủy',N'Hoàn thành')`)).recordset[0];
    if(duplicate)throw err(409,'SESSION_ALREADY_SCHEDULED','Buổi dịch vụ đã có lịch hẹn.');
    const id=await nextCode('LH',transaction);
    await requestFor(transaction).input('id',dbTypes.Char(10),id).input('date',dbTypes.Date,date).input('start',dbTypes.VarChar(8),`${startTime}:00`)
      .input('end',dbTypes.VarChar(8),`${slot.endTime}:00`).input('status',dbTypes.NVarChar(50),'Chờ xác nhận')
      .input('note',dbTypes.NVarChar(200),note).input('session',dbTypes.Char(10),sessionId).input('user',dbTypes.Char(10),user.id).input('customer',dbTypes.Char(10),customerId)
      .query(`INSERT INTO dbo.LichHen(maLichHen,ngayHen,gioBatDau,gioKetThuc,trangThai,ghiChu,maCT_DonMua,maTK,maKhachHang)
        VALUES(@id,@date,CONVERT(time(0),@start),CONVERT(time(0),@end),@status,@note,@session,@user,@customer)`);
    const appointment={id,date,startTime,endTime:slot.endTime,status:'Chờ xác nhận',note,customerId,sessionId};
    await queueReminder({...appointment,config},session,transaction);
    await insertAudit({transaction,user,action:'Tạo lịch hẹn',entity:'LichHen',entityId:id,before:null,after:appointment});
    return {...appointment,id:id.trim(),customerName:session.customerName,customerPhone:session.customerPhone,
      message:'Tạo lịch hẹn thành công'};
  });
}

export async function updateAppointment(id,body,user) {
  body=body&&typeof body==='object'&&!Array.isArray(body)?body:{};
  return inTransaction(async transaction=>{
    const before=await getAppointment(id,transaction);
    if(before.status==='Đã hủy'||before.status==='Hoàn thành')throw err(409,'APPOINTMENT_NOT_EDITABLE','Không thể điều chỉnh lịch hẹn đã hủy hoặc hoàn thành.');
    const {date,startTime}=validateDateAndTime({date:body.date??body.ngayHen??before.date,startTime:body.startTime??body.gioBatDau??before.startTime});
    const note=body.note??body.ghiChu??before.note;
    if(note!=null&&(typeof note!=='string'||note.length>200))throw badRequest('Thông tin lịch hẹn chưa hợp lệ.',[{field:'note',message:'Ghi chú tối đa 200 ký tự'}]);
    const session=await appointmentSession(before.customerId,before.sessionId,transaction);
    const slot=await checkSlot({date,startTime,duration:session.durationMinutes,excludeId:id,transaction});
    await requestFor(transaction).input('id',dbTypes.Char(10),id).input('date',dbTypes.Date,date).input('start',dbTypes.VarChar(8),`${startTime}:00`)
      .input('end',dbTypes.VarChar(8),`${slot.endTime}:00`).input('note',dbTypes.NVarChar(200),note)
      .query(`UPDATE dbo.LichHen SET ngayHen=@date,gioBatDau=CONVERT(time(0),@start),gioKetThuc=CONVERT(time(0),@end),ghiChu=@note WHERE maLichHen=@id`);
    await cancelReminder(id,transaction);
    const after={...before,date,startTime,endTime:slot.endTime,note};
    await queueReminder({...after,id,config:slot.config},session,transaction);
    await insertAudit({transaction,user,action:'Điều chỉnh lịch hẹn',entity:'LichHen',entityId:id,before,after});
    return {...after,message:'Cập nhật thông tin thành công!'};
  });
}

export async function cancelAppointment(id,body,user) {
  body=body&&typeof body==='object'&&!Array.isArray(body)?body:{};
  const reason=body.reason??body.lyDo??null;
  if(reason!=null&&(typeof reason!=='string'||reason.length>200))throw badRequest('Lý do hủy không hợp lệ.',[{field:'reason',message:'Lý do tối đa 200 ký tự'}]);
  return inTransaction(async transaction=>{
    const before=await getAppointment(id,transaction);
    if(before.status==='Đã hủy')throw err(409,'APPOINTMENT_ALREADY_CANCELLED','Lịch hẹn đã bị hủy.');
    if(before.status==='Hoàn thành')throw err(409,'APPOINTMENT_ALREADY_COMPLETED','Không thể hủy lịch hẹn đã hoàn thành.');
    const old={...before};
    await requestFor(transaction).input('id',dbTypes.Char(10),id).query("UPDATE dbo.LichHen SET trangThai=N'Đã hủy' WHERE maLichHen=@id");
    // LichSuHuyLich không có trong schema thật; lý do hủy chỉ được ghi trong audit
    // (hiện là no-op) và phản hồi API.
    const customer=(await requestFor(transaction).input('id',dbTypes.Char(10),before.customerId).query('UPDATE dbo.KhachHang SET soLanHuyLich=soLanHuyLich+1 WHERE maKhachHang=@id RETURNING soLanHuyLich AS count')).recordset[0];
    await cancelReminder(id,transaction);
    const threshold=Number((await settings(transaction)).BLACKLIST_CANCEL_LIMIT||3);
    const isBlacklisted=Number(customer.count)>=threshold;
    const after={...before,status:'Đã hủy',cancelledBy:user.id,cancellationCount:Number(customer.count),isBlacklisted,reason};
    await insertAudit({transaction,user,action:'Hủy lịch hẹn',entity:'LichHen',entityId:id,before:old,after});
    return {id:id.trim(),status:'Đã hủy',cancellationCount:Number(customer.count),isBlacklisted,
      message:'Hủy lịch hẹn thành công!'};
  });
}

export async function listCancellations(customerId,query={}) {
  // LichSuHuyLich không có trong schema thật; trả về danh sách rỗng đúng hình dạng.
  return paginate([],query.page,query.limit);
}
