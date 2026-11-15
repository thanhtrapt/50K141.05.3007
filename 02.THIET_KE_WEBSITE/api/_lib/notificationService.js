import { config } from './config.js';
import { getPool,inTransaction,requestFor,dbTypes } from './database.js';
import { insertAudit } from './repositories.js';
import { signActionToken } from './security.js';
import { generateSummaryPdf } from './pdfSummaryService.js';

const endpoints={APPOINTMENT_REMINDER:'zalo/appointment-reminder',SESSION_CONFIRM_REQUEST:'zalo/session-confirm-request',SUMMARY_AND_REVIEW:'zalo/send-summary-and-review'};
let timer;let busy=false;

export function createConfirmationUrl(packageId,sessionId) {
  if(!config.n8nPublicBaseUrl)return null;
  const token=signActionToken('session-confirmation',{packageId,sessionId},7*24*60*60);
  return `${config.n8nPublicBaseUrl}/webhook/zalo/session-confirm?token=${encodeURIComponent(token)}&packageId=${encodeURIComponent(packageId)}&sessionId=${encodeURIComponent(sessionId)}`;
}

export function createReviewUrl(packageId,customerId) {
  if(!config.n8nPublicBaseUrl)return null;
  const token=signActionToken('service-review',{packageId,customerId},30*24*60*60);
  return `${config.n8nPublicBaseUrl}/webhook/zalo/review-form?token=${encodeURIComponent(token)}`;
}

export async function enqueueNotification(transaction,{event,recipient,payload,appointmentId=null,sessionId=null,dueAt=new Date()}) {
  const existing=(await requestFor(transaction).input('session',dbTypes.Char(10),sessionId).input('event',dbTypes.NVarChar(100),event)
    .query(`SELECT TOP(1) maThongBao FROM dbo.NhatKyThongBao WITH (UPDLOCK,HOLDLOCK)
      WHERE maCT_DonMua=@session AND suKien=@event`)).recordset[0];
  if(existing)return {id:existing.maThongBao,alreadyQueued:true};
  const result=await requestFor(transaction).input('channel',dbTypes.NVarChar(30),'ZALO').input('event',dbTypes.NVarChar(100),event)
    .input('recipient',dbTypes.NVarChar(100),recipient).input('request',dbTypes.NVarChar(dbTypes.MAX),JSON.stringify(payload))
    .input('appointment',dbTypes.Char(10),appointmentId).input('session',dbTypes.Char(10),sessionId).input('due',dbTypes.DateTime2,dueAt)
    .query(`INSERT INTO dbo.NhatKyThongBao(kenh,suKien,nguoiNhan,yeuCau,phanHoi,trangThai,soLanThu,maLichHen,maCT_DonMua,thoiGianGuiDuKien)
      VALUES(@channel,@event,@recipient,@request,NULL,'Chờ gửi',0,@appointment,@session,@due) RETURNING maThongBao`);
  return {id:result.recordset[0].maThongBao,alreadyQueued:false};
}

export async function logInboundEvent({event,recipient=null,payload,response}) {
  return inTransaction(async transaction=>{
    const result=await requestFor(transaction).input('channel',dbTypes.NVarChar(30),'ZALO').input('event',dbTypes.NVarChar(100),event)
      .input('recipient',dbTypes.NVarChar(100),recipient).input('request',dbTypes.NVarChar(dbTypes.MAX),JSON.stringify(payload))
      .input('response',dbTypes.NVarChar(dbTypes.MAX),JSON.stringify(response))
      .query(`INSERT INTO dbo.NhatKyThongBao(kenh,suKien,nguoiNhan,yeuCau,phanHoi,trangThai,soLanThu)
        VALUES(@channel,@event,@recipient,@request,@response,'Đã nhận',1) RETURNING maThongBao`);
    return result.recordset[0].maThongBao;
  });
}

async function claimNotification() {
  const result=await getPool().request().query(`WITH candidate AS (
      SELECT "maThongBao" FROM public."NhatKyThongBao"
      WHERE "trangThai" IN('Chờ gửi','Đến hạn') AND ("thoiGianGuiDuKien" IS NULL OR "thoiGianGuiDuKien"<=CURRENT_TIMESTAMP)
        AND "suKien" IN('APPOINTMENT_REMINDER','SESSION_CONFIRM_REQUEST','SUMMARY_AND_REVIEW')
      ORDER BY COALESCE("thoiGianGuiDuKien","taoLuc"),"maThongBao"
      FOR UPDATE SKIP LOCKED LIMIT 1
    )
    UPDATE public."NhatKyThongBao" AS n SET "trangThai"='Đang gửi',"soLanThu"=n."soLanThu"+1,"capNhatLuc"=CURRENT_TIMESTAMP
    FROM candidate WHERE n."maThongBao"=candidate."maThongBao"
    RETURNING n."maThongBao",n."suKien",n."nguoiNhan",n."yeuCau",n."phanHoi",n."soLanThu",n."maLichHen",n."maCT_DonMua"`);
  return result.recordset[0]||null;
}

async function skipCancelledAppointment(row) {
  if(!row.maLichHen)return false;
  const found=(await getPool().request().input('id',dbTypes.Char(10),row.maLichHen).query('SELECT trangThai FROM dbo.LichHen WHERE maLichHen=@id')).recordset[0];
  if(found&&found.trangThai!=='Đã hủy')return false;
  await getPool().request().input('id',dbTypes.BigInt,row.maThongBao).query("UPDATE dbo.NhatKyThongBao SET trangThai=N'Đã hủy',capNhatLuc=SYSDATETIME() WHERE maThongBao=@id");
  return true;
}

async function preparePayload(row) {
  let payload=JSON.parse(row.yeuCau||'{}');
  if(row.suKien==='SUMMARY_AND_REVIEW') {
    const document=await generateSummaryPdf({packageId:payload.packageId,sessionId:payload.sessionId,milestone:payload.milestone});
    const summaryUrl=`${config.publicBaseUrl}${document.path}`;
    const reviewUrl=createReviewUrl(payload.packageId,payload.customerId);
    await inTransaction(async transaction=>{
      await requestFor(transaction).input('package',dbTypes.Char(10),payload.packageId).input('path',dbTypes.NVarChar(255),document.path)
        .query('UPDATE dbo.DonMuaDV SET fileTongHop=@path WHERE maDonMua=@package');
      const documentRequest=requestFor(transaction).input('package',dbTypes.Char(10),payload.packageId).input('session',dbTypes.Char(10),payload.sessionId)
        .input('type',dbTypes.NVarChar(20),document.milestone).input('name',dbTypes.NVarChar(255),document.fileName).input('path',dbTypes.NVarChar(500),document.path)
      await documentRequest.query("SELECT pg_advisory_xact_lock(hashtext(@session || ':' || @type))");
      const existing=await documentRequest.query(`UPDATE dbo.TaiLieuTongHop SET tenTep=@name,duongDan=@path,thoiGianTao=SYSDATETIME()
        WHERE maCT_DonMua=@session AND loaiTaiLieu=@type`);
      if(!existing.rowCount) await documentRequest.query(`INSERT INTO dbo.TaiLieuTongHop(maDonMua,maCT_DonMua,loaiTaiLieu,tenTep,duongDan)
        VALUES(@package,@session,@type,@name,@path)`);
      await insertAudit({transaction,user:null,action:'Tạo PDF tổng hợp liệu trình',entity:'TaiLieuTongHop',entityId:document.fileName,before:null,
        after:{maDonMua:payload.packageId,maCT_DonMua:payload.sessionId,duongDan:document.path,loaiTaiLieu:document.milestone}});
    });
    payload={...payload,pdfFileName:document.fileName,pdfPath:document.path,pdfPublicUrl:summaryUrl,reviewUrl};
  }
  return payload;
}

async function sendToN8n(row,payload) {
  const endpoint=endpoints[row.suKien];
  if(!endpoint)throw new Error(`Sự kiện n8n chưa được ánh xạ: ${row.suKien}`);
  const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),20_000);
  try {
    const response=await fetch(`${config.n8nWebhookBaseUrl}/${endpoint}`,{
      method:'POST',headers:{'content-type':'application/json','authorization':`Bearer ${config.n8nWebhookSecret}`},
      body:JSON.stringify({...payload,trackingId:String(row.maThongBao)}),signal:controller.signal,
    });
    const body=(await response.text()).slice(0,8000);
    if(!response.ok)throw new Error(`n8n trả HTTP ${response.status}: ${body}`);
    return {status:response.status,body};
  } finally {clearTimeout(timeout);}
}

async function updateAfterSend(row,{response,error}) {
  const attempts=Number(row.soLanThu);const max=config.n8nMaxRetries;
  const nextStatus=error?(attempts>=max?'Thất bại':'Chờ gửi'):'Đã gửi';
  const delay=Math.min(3600,30*(2**Math.max(0,attempts-1)));
  const payload=error?{error:String(error.message||error),attempt:attempts,nextRetrySeconds:attempts>=max?null:delay}:{httpStatus:response.status,body:response.body};
  await getPool().request().input('id',dbTypes.BigInt,row.maThongBao).input('status',dbTypes.NVarChar(30),nextStatus)
    .input('response',dbTypes.NVarChar(dbTypes.MAX),JSON.stringify(payload)).input('delay',dbTypes.Int,delay)
    .query(`UPDATE dbo.NhatKyThongBao SET trangThai=@status,phanHoi=@response,
      thoiGianGuiDuKien=CASE WHEN @status=N'Chờ gửi' THEN DATEADD(SECOND,@delay,SYSDATETIME()) ELSE thoiGianGuiDuKien END,
      capNhatLuc=SYSDATETIME() WHERE maThongBao=@id`);
  if(error)console.error(`Thông báo ${row.maThongBao} gửi lỗi (lần ${attempts}/${max}):`,error.message);
}

async function dispatchOne() {
  if(!config.n8nWebhookBaseUrl||!config.n8nWebhookSecret)return;
  const row=await claimNotification();if(!row)return;
  if(await skipCancelledAppointment(row))return;
  try {
    const payload=await preparePayload(row);const response=await sendToN8n(row,payload);await updateAfterSend(row,{response});
  } catch(error) { await updateAfterSend(row,{error}); }
}

export async function tick() {
  if(busy||!config.n8nWebhookBaseUrl||!config.n8nWebhookSecret)return;
  busy=true;
  try { for(let i=0;i<5;i++){await dispatchOne();} } catch(error) { console.error('Lỗi hàng đợi thông báo:',error.message); }
  finally {busy=false;}
}

export function startNotificationWorker() {
  if(timer)return;
  timer=setInterval(()=>void tick(),5_000);timer.unref();void tick();
}

export function stopNotificationWorker() {
  if(timer)clearInterval(timer);timer=undefined;
}
