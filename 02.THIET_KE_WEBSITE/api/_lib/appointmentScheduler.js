// Schema thật không có NhatKyThongBao hay CauHinhHeThong. Các tác vụ quét nhắc
// hẹn và quét hạn sử dụng hằng ngày tạm thời không chạy; cảnh báo tồn kho/hạn
// dùng được tính trực tiếp khi đọc dữ liệu (xem listAlerts trong stockService).
let timer;
let expiryTimer;

export async function markDueReminders() {
  return 0;
}

export function startAppointmentScheduler() {
  if(timer)return;
  timer=undefined;
}

export function stopAppointmentScheduler() {
  if(timer)clearInterval(timer);
  timer=undefined;
}

export async function dailyExpiryScan() {
  return 0;
}

export function startDailyExpiryScheduler() {
  if(expiryTimer)return;
  expiryTimer=undefined;
}

export function stopDailyExpiryScheduler() {
  if(expiryTimer)clearInterval(expiryTimer);
  expiryTimer=undefined;
}
