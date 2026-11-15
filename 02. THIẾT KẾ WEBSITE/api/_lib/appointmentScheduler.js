import { getPool,inTransaction,requestFor,sqlTypes } from './database.js';
import { refreshExpiryAlerts } from './stockService.js';

let timer;
let busy=false;
let expiryTimer;
let expiryBusy=false;

export async function markDueReminders() {
  if(busy)return;
  busy=true;
  try {
    const result=await getPool().request().query(`UPDATE dbo.NhatKyThongBao SET trangThai=N'Đến hạn',capNhatLuc=SYSDATETIME()
      OUTPUT inserted.maThongBao
      WHERE trangThai=N'Chờ gửi' AND suKien=N'APPOINTMENT_REMINDER' AND thoiGianGuiDuKien<=SYSDATETIME()`);
    if(result.recordset.length)process.stdout.write(`Có ${result.recordset.length} lời nhắc lịch hẹn đến hạn, chờ bộ gửi n8n.\n`);
  } catch(error) {
    console.error('Không thể quét lịch nhắc hẹn:',error.message);
  } finally {
    busy=false;
  }
}

export function startAppointmentScheduler() {
  if(timer)return;
  timer=setInterval(markDueReminders,30_000);
  timer.unref();
  void markDueReminders();
}

export function stopAppointmentScheduler() {
  if(timer)clearInterval(timer);
  timer=undefined;
}

function vietnameseDateAndTime() {
  const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Ho_Chi_Minh',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date());
  const values=Object.fromEntries(parts.map(part=>[part.type,part.value]));
  return {date:`${values.year}-${values.month}-${values.day}`,time:`${values.hour}:${values.minute}`};
}

export async function dailyExpiryScan() {
  if(expiryBusy)return;expiryBusy=true;
  try {
    const {date,time}=vietnameseDateAndTime();if(time<'00:05')return;
    const count=await inTransaction(async transaction=>{
      const row=(await requestFor(transaction).query(`SELECT giaTri FROM dbo.CauHinhHeThong WITH (UPDLOCK,HOLDLOCK)
        WHERE maCauHinh=N'LAST_EXPIRY_SCAN_DATE'`)).recordset[0];
      if(row?.giaTri>=date)return null;
      const total=await refreshExpiryAlerts(transaction);
      await requestFor(transaction).input('date',sqlTypes.NVarChar(4000),date).query(`UPDATE dbo.CauHinhHeThong SET giaTri=@date,capNhatLuc=SYSDATETIME()
        WHERE maCauHinh=N'LAST_EXPIRY_SCAN_DATE'`);
      return total;
    });
    if(count!==null)process.stdout.write(`Đã quét hạn sử dụng hằng ngày: ${count} lô.\n`);
  } catch(error) { console.error('Không thể quét hạn sử dụng hằng ngày:',error.message); }
  finally { expiryBusy=false; }
}

export function startDailyExpiryScheduler() {
  if(expiryTimer)return;
  expiryTimer=setInterval(()=>void dailyExpiryScan(),30_000);expiryTimer.unref();void dailyExpiryScan();
}

export function stopDailyExpiryScheduler() {
  if(expiryTimer)clearInterval(expiryTimer);expiryTimer=undefined;
}
