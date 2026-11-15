import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const databaseName=`HuongSpaTest_${process.pid}_${crypto.randomBytes(4).toString('hex')}`;
const uploadDirectory=path.join(os.tmpdir(),databaseName);
process.env.SQL_DATABASE=databaseName;
process.env.UPLOAD_DIR=uploadDirectory;
process.env.N8N_WEBHOOK_BASE_URL='';
process.env.N8N_PUBLIC_BASE_URL='';

const [{config},{runSeed},{connectDatabase,closeDatabase,getPool,sqlTypes},{login},{createService,updateService,deleteService,listServices,getService},{createCustomer,updateCustomer,deleteCustomer,getCustomer,listCustomers,
  assignServicePackage,startPackageSession,completePackageSession,confirmPackageSession,createRetailSale,createReview,listReviews},{createCosmetic,updateCosmetic,deleteCosmetic,getCosmetic,listCosmetics,createReceipt,getReceipt,listReceipts,listLots,
  createIssue,getIssue,listIssues,listAlerts,refreshExpiryAlerts},{createAppointment,updateAppointment,cancelAppointment,listAppointments,listCancellations}]=await Promise.all([
  import('../../api/_lib/config.js'),import('../../api/_lib/seed.js'),import('../../api/_lib/database.js'),import('../../api/_lib/authService.js'),import('../../api/_lib/serviceService.js'),
  import('../../api/_lib/customerService.js'),import('../../api/_lib/stockService.js'),import('../../api/_lib/appointmentService.js'),
]);

let sql,adminPool,createdDatabase=false,owner,staff;
function connectionOptions(database) {
  return {server:config.sqlServer,driver:'ODBC Driver 18 for SQL Server',...(config.sqlPort?{port:config.sqlPort}:{}),
    ...(config.sqlAuth==='sql'?{user:config.sqlUser,password:config.sqlPassword}:{}),database,
    options:{encrypt:config.sqlEncrypt,trustServerCertificate:config.sqlTrustServerCertificate,trustedConnection:config.sqlAuth==='windows',enableArithAbort:true},
    connectionTimeout:15000,requestTimeout:30000};
}

before(async()=>{
  if(config.sqlAuth==='sql'&&(!config.sqlUser||!config.sqlPassword))throw new Error('Integration test cần SQL_USER và SQL_PASSWORD hoặc SQL_AUTH=windows trong .env ở thư mục gốc.');
  sql=(await import(config.sqlAuth==='windows'?'mssql/msnodesqlv8.js':'mssql')).default;
  adminPool=await new sql.ConnectionPool(connectionOptions('master')).connect();
  const exists=(await adminPool.request().input('name',sqlTypes.NVarChar(128),databaseName).query('SELECT DB_ID(@name) AS id')).recordset[0].id;
  if(exists!==null)throw new Error(`Từ chối dùng lại CSDL kiểm thử đã tồn tại: ${databaseName}`);
  createdDatabase=true;
  await runSeed();
  await connectDatabase();
  const accounts=(await getPool().request().query("SELECT maTK,tenDangNhap,vaiTro,hoTen FROM dbo.TaiKhoan WHERE tenDangNhap IN('0912345678','0901234567')")).recordset;
  const ownerRow=accounts.find(x=>x.vaiTro==='Chủ Spa');const staffRow=accounts.find(x=>x.vaiTro==='Nhân viên');
  owner={id:ownerRow.maTK.trim(),phone:ownerRow.tenDangNhap,role:'OWNER',roleName:ownerRow.vaiTro,full_name:ownerRow.hoTen};
  staff={id:staffRow.maTK.trim(),phone:staffRow.tenDangNhap,role:'STAFF',roleName:staffRow.vaiTro,full_name:staffRow.hoTen};
});

after(async()=>{
  await closeDatabase().catch(()=>{});
  if(createdDatabase&&adminPool) {
    const sqlText=`IF DB_ID(@name) IS NOT NULL BEGIN
      DECLARE @dropSql NVARCHAR(MAX)=N'ALTER DATABASE '+QUOTENAME(@name)+N' SET SINGLE_USER WITH ROLLBACK IMMEDIATE; DROP DATABASE '+QUOTENAME(@name);
      EXEC sys.sp_executesql @dropSql;
    END`;
    await adminPool.request().input('name',sqlTypes.NVarChar(128),databaseName).query(sqlText);
    const remains=(await adminPool.request().input('name',sqlTypes.NVarChar(128),databaseName).query('SELECT DB_ID(@name) AS id')).recordset[0].id;
    if(remains!==null)throw new Error(`CSDL kiểm thử chưa được dọn sau khi chạy: ${databaseName}`);
  }
  await adminPool?.close().catch(()=>{});
  if(uploadDirectory.startsWith(os.tmpdir()))await fs.rm(uploadDirectory,{recursive:true,force:true}).catch(()=>{});
});

test('IT-UC0-6.2 exercises auth, CRUD, inventory, appointments, sessions, reviews and PDF',async()=>{
  const req={headers:{'user-agent':'HuongSpa integration test'},socket:{remoteAddress:'127.0.0.1'}};
  const authenticated=await login({phone:'0912345678',password:process.env.SEED_OWNER_PASSWORD||'chuspa123'},req);
  assert.equal(authenticated.user.role,'OWNER');
  await assert.rejects(login({phone:'0912345678',password:'incorrect1'},req),error=>error.code==='AUTH_INVALID');

  const stamp=String(Date.now()).slice(-8);
  const service=await createService({name:`Gói kiểm thử ${stamp}`,price:300000,totalSessions:3,sessions:[1,2,3].map(n=>({name:`Buổi ${n}`,technique:'Chăm sóc da',durationMinutes:30,cosmeticsUsage:'Serum 2ml'}))},owner);
  await assert.rejects(createService({name:'',price:0,sessions:[]},owner),error=>error.code==='VALIDATION_ERROR');
  assert.equal((await getService(service.id)).sessions.length,3);
  await updateService(service.id,{name:`Gói đã sửa ${stamp}`},owner);
  assert.ok((await listServices({keyword:'goi da sua'})).data.some(x=>x.id===service.id));
  const customer=await createCustomer({name:`Khách kiểm thử ${stamp}`,phone:`09${stamp.padStart(8,'0')}`.slice(0,10),dateOfBirth:'1990-01-01'},staff);
  assert.equal(customer.id.length,10);
  assert.equal(customer.cancellationCount,0);
  const emptyProfile=await getCustomer(customer.id);
  assert.equal(emptyProfile.actions.recordRetailSale,true);
  assert.equal(emptyProfile.actions.viewServiceHistory,true);
  assert.equal(emptyProfile.emptyLabels.serviceHistory,'Chưa có lịch sử dịch vụ');
  await assert.rejects(createCustomer({name:'Trùng SĐT',phone:customer.phone,dateOfBirth:'1990-01-01'},staff),error=>error.code==='CUSTOMER_PHONE_EXISTS');
  assert.equal((await getCustomer(customer.id)).actions.recordRetailSale,true);
  assert.ok((await listCustomers({keyword:'khach kiem thu'})).data.some(x=>x.id===customer.id));
  const updatedCustomer=await updateCustomer(customer.id,{name:`Đã sửa ${stamp}`},staff);
  assert.equal(updatedCustomer.name,`Đã sửa ${stamp}`);
  const pkg=await assignServicePackage(customer.id,{serviceId:service.id,paymentStatus:'Đã thanh toán'},staff);
  assert.equal(pkg.totalSessions,3);
  const packageSessionRows=(await getPool().request().input('pkg',sqlTypes.Char(10),pkg.id).query('SELECT maCT_DonMua FROM dbo.CT_DonMua WHERE maDonMua=@pkg ORDER BY maCT_DonMua')).recordset;
  const sessionIds=packageSessionRows.map(x=>x.maCT_DonMua.trim());
  await assert.rejects(startPackageSession(pkg.id,sessionIds[1],staff),error=>error.code==='SESSION_ORDER_INVALID');
  await assert.rejects(completePackageSession(pkg.id,sessionIds[0],{result:'Chưa bắt đầu'},staff),error=>error.code==='SESSION_STATE_INVALID');
  await assert.rejects(createReview({customerId:customer.id,servicePackageId:pkg.id,rating:5,content:'Quá sớm'},null),error=>error.code==='SERVICE_NOT_COMPLETED');
  await assert.rejects(deleteService(service.id,owner),error=>error.code==='SERVICE_IN_USE');

  const retail=await createCosmetic({name:`Sản phẩm bán ${stamp}`,category:'Bán lẻ',unit:'Chai',salePrice:50000},owner);
  const treatment=await createCosmetic({name:`Sản phẩm liệu trình ${stamp}`,category:'Dùng cho liệu trình',unit:'Lọ',salePrice:100000},owner);
  await assert.rejects(createCosmetic({name:`Sản phẩm bán ${stamp}`,category:'Bán lẻ',unit:'Chai',salePrice:10},owner),error=>error.code==='VALIDATION_ERROR');
  assert.equal((await getCosmetic(retail.id)).category,'Bán lẻ');
  const changedRetail=await updateCosmetic(retail.id,{description:'Đã sửa',maMyPham:'MP99999999'},owner);
  assert.equal(changedRetail.id,retail.id,'mã mỹ phẩm không bị thay đổi qua dữ liệu khách gửi lên');
  assert.ok((await listCosmetics({keyword:`san pham ban ${stamp}`})).data.some(x=>x.id===retail.id));
  const today=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Ho_Chi_Minh'}).format(new Date());
  const baseDate=new Date(`${today}T00:00:00+07:00`);
  const offset=(days)=>{const d=new Date(baseDate.getTime()+days*86400000);return new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Ho_Chi_Minh'}).format(d);};
  const receipt=await createReceipt({receiptDate:today,paymentStatus:'Đã thanh toán',items:[
    {cosmeticId:retail.id,purchasePrice:20000,quantity:2,lot:{productionDate:offset(-30),expiryDate:offset(30)}},
    {cosmeticId:retail.id,purchasePrice:21000,quantity:5,lot:{productionDate:offset(-20),expiryDate:offset(60)}},
    {cosmeticId:treatment.id,purchasePrice:40000,quantity:5,lot:{productionDate:offset(-30),expiryDate:offset(45)}},
  ]},owner);
  assert.equal((await getReceipt(receipt.id)).total,345000);
  assert.match((await getReceipt(receipt.id)).items[0].lotCode,/^\d{6}-00\d$/);
  const retailStock=Number((await getPool().request().input('id',sqlTypes.Char(10),retail.id).query('SELECT soLuongTonKho FROM dbo.MyPham WHERE maMyPham=@id')).recordset[0].soLuongTonKho);
  assert.equal(retailStock,7);
  assert.ok((await listReceipts({keyword:receipt.id})).data.some(x=>x.id===receipt.id));
  const sale=await createRetailSale(customer.id,{items:[{cosmeticId:retail.id,quantity:3}]},staff);
  assert.deepEqual(sale.items[0].allocation.map(x=>x.quantity),[2,1]);
  await assert.rejects(createRetailSale(customer.id,{items:[{cosmeticId:treatment.id,quantity:1}]},staff),error=>error.status===404);
  const lots=(await getPool().request().input('product',sqlTypes.Char(10),retail.id).query('SELECT maLo,soLuongTonLo FROM dbo.LoHang WHERE maMyPham=@product ORDER BY hanSuDung,ngayNhap,maLo')).recordset;
  assert.equal(Number(lots[0].soLuongTonLo),0);
  const race=await Promise.allSettled([
    createRetailSale(customer.id,{items:[{cosmeticId:retail.id,quantity:3}]},staff),
    createRetailSale(customer.id,{items:[{cosmeticId:retail.id,quantity:3}]},staff),
  ]);
  assert.equal(race.filter(x=>x.status==='fulfilled').length,1,`chỉ một giao dịch đồng thời được dùng lượng tồn còn lại; kết quả: ${race.map(x=>x.status==='rejected'?x.reason.message:'OK').join(' | ')}`);

  const issueReceipt=await createReceipt({receiptDate:today,paymentStatus:'Chưa thanh toán',items:[
    {cosmeticId:treatment.id,purchasePrice:40000,quantity:5,lot:{productionDate:offset(-30),expiryDate:offset(45)}},
  ]},owner);
  const issueLot=(await getReceipt(issueReceipt.id)).items[0].lotCode;
  await assert.rejects(createIssue({issueDate:today,items:[{cosmeticId:treatment.id,batchId:issueLot,quantity:99}]},staff),error=>error.code==='VALIDATION_ERROR');
  const issue=await createIssue({issueDate:today,reason:'Kiểm thử',items:[{cosmeticId:treatment.id,batchId:issueLot,quantity:2}]},staff);
  assert.equal((await getIssue(issue.id)).items[0].quantity,2);
  assert.ok((await listIssues({keyword:issue.id})).data.some(x=>x.id===issue.id));
  await refreshExpiryAlerts();
  assert.ok((await listAlerts({type:'LOW_STOCK'})).data.some(x=>x.cosmeticId.trim()===retail.id));

  const thresholdProduct=await createCosmetic({name:`Cảnh báo tồn ${stamp}`,category:'Dùng cho liệu trình',unit:'Chai',salePrice:10000},owner);
  await createReceipt({receiptDate:today,paymentStatus:'Đã thanh toán',items:[{cosmeticId:thresholdProduct.id,purchasePrice:1000,quantity:10,lot:{productionDate:offset(-30),expiryDate:offset(90)}}]},owner);
  assert.equal((await listAlerts({type:'LOW_STOCK'})).data.find(x=>x.cosmeticId.trim()===thresholdProduct.id).status,'Sắp hết hàng');
  await createReceipt({receiptDate:today,paymentStatus:'Đã thanh toán',items:[{cosmeticId:thresholdProduct.id,purchasePrice:1000,quantity:1,lot:{productionDate:offset(-30),expiryDate:offset(120)}}]},owner);
  assert.ok(!(await listAlerts({type:'LOW_STOCK'})).data.some(x=>x.cosmeticId.trim()===thresholdProduct.id));
  const productLots=await listLots({cosmeticId:thresholdProduct.id});
  const outOfStock=await createIssue({issueDate:today,items:productLots.map(lot=>({cosmeticId:thresholdProduct.id,batchId:lot.id,quantity:lot.stock}))},staff);
  assert.ok(outOfStock.id);
  assert.equal((await listAlerts({type:'LOW_STOCK'})).data.find(x=>x.cosmeticId.trim()===thresholdProduct.id).status,'Hết hàng');

  const expiredProduct=await createCosmetic({name:`Cảnh báo hạn ${stamp}`,category:'Dùng cho liệu trình',unit:'Chai',salePrice:10000},owner);
  const expiredReceipt=await createReceipt({receiptDate:today,paymentStatus:'Đã thanh toán',items:[
    {cosmeticId:expiredProduct.id,purchasePrice:1000,quantity:1,lot:{productionDate:offset(-90),expiryDate:offset(-1)}},
    {cosmeticId:expiredProduct.id,purchasePrice:1000,quantity:1,lot:{productionDate:offset(-90),expiryDate:offset(60)}},
    {cosmeticId:expiredProduct.id,purchasePrice:1000,quantity:1,lot:{productionDate:offset(-90),expiryDate:offset(61)}},
  ]},owner);
  await refreshExpiryAlerts();
  const expiryAlerts=(await listAlerts({type:'EXPIRY'})).data.filter(x=>x.cosmeticId.trim()===expiredProduct.id);
  assert.ok(expiryAlerts.some(x=>x.status==='Hết hạn'));
  assert.ok(expiryAlerts.some(x=>x.status==='Sắp hết hạn'));
  assert.equal(expiryAlerts.length,2,'lô còn 61 ngày không nằm trong danh sách cảnh báo');
  await assert.rejects(deleteCosmetic(expiredProduct.id,owner),error=>error.code==='COSMETIC_HAS_STOCK');
  const expiredLot=(await getReceipt(expiredReceipt.id)).items[0].lotCode;
  await assert.rejects(createIssue({issueDate:today,items:[{cosmeticId:expiredProduct.id,batchId:expiredLot,quantity:1}]},staff),error=>error.code==='VALIDATION_ERROR');

  const future=offset(2);
  const appointments=[];
  for(let index=0;index<3;index++) {
    const sessionId=sessionIds[index];
    const appointment=await createAppointment({customerId:customer.id,sessionId,date:future,startTime:`${String(8+index).padStart(2,'0')}:00`},owner);
    appointments.push(appointment);
  }
  await assert.rejects(createAppointment({customerId:customer.id,sessionId:sessionIds[1],date:future,startTime:'08:15'},owner),error=>error.code==='APPOINTMENT_CONFLICT');
  const reminder=(await getPool().request().input('appointment',sqlTypes.Char(10),appointments[0].id).query("SELECT yeuCau,trangThai FROM dbo.NhatKyThongBao WHERE maLichHen=@appointment AND suKien=N'APPOINTMENT_REMINDER'")).recordset[0];
  assert.equal(JSON.parse(reminder.yeuCau).remindBeforeMinutes,45);
  await assert.rejects(createAppointment({customerId:customer.id,sessionId:(await getPool().request().input('pkg',sqlTypes.Char(10),pkg.id).query('SELECT TOP(1) maCT_DonMua FROM dbo.CT_DonMua WHERE maDonMua=@pkg ORDER BY maCT_DonMua')).recordset[0].maCT_DonMua.trim(),date:future,startTime:'14:00'},owner),error=>error.code==='SESSION_ALREADY_SCHEDULED');
  await updateAppointment(appointments[0].id,{startTime:'08:30'},owner);
  for(const appointment of appointments)await cancelAppointment(appointment.id,{reason:'Kiểm thử'},owner);
  assert.equal((await listCancellations(customer.id)).meta.total,3);
  assert.equal((await getCustomer(customer.id)).isBlacklisted,true);
  await assert.rejects(createAppointment({customerId:customer.id,sessionId:'CM00000099',date:future,startTime:'14:00'},owner),error=>error.code==='CUSTOMER_BLACKLISTED');
  assert.ok((await listAppointments({fromDate:future,toDate:future})).data.every(x=>x.status!=='Đã hủy'));

  for(const [index,sessionId] of sessionIds.entries()) {
    await startPackageSession(pkg.id,sessionId,staff);
    await completePackageSession(pkg.id,sessionId,{result:`Kết quả ${index+1}`},staff);
    const confirmed=await confirmPackageSession(pkg.id,sessionId,null);
    assert.equal(confirmed.createSummary,index===1||index===2);
  }
  const summary=await (await import('../../api/_lib/pdfSummaryService.js')).generateSummaryPdf({packageId:pkg.id,sessionId:sessionIds[2],milestone:'final'});
  assert.ok((await fs.stat(summary.absolutePath)).size>1000);
  const review=await createReview({customerId:customer.id,servicePackageId:pkg.id,rating:5,content:'Hài lòng'},null);
  assert.equal((await confirmPackageSession(pkg.id,sessionIds[2],null)).alreadyConfirmed,true);
  assert.equal((await listReviews({keyword:'hai long'})).meta.total>=1,true);
  await assert.rejects(deleteCustomer(customer.id,staff),error=>error.code==='CUSTOMER_HAS_RELATED_DATA');
  const summaryEvents=(await getPool().request().input('package',sqlTypes.Char(10),pkg.id).query("SELECT COUNT(*) AS total FROM dbo.NhatKyThongBao WHERE suKien=N'SUMMARY_AND_REVIEW' AND maCT_DonMua IN(SELECT maCT_DonMua FROM dbo.CT_DonMua WHERE maDonMua=@package)")).recordset[0].total;
  assert.equal(Number(summaryEvents),2);
  assert.equal(review.rating,5);
  assert.ok(owner.id&&staff.id);

  const port=43000+crypto.randomInt(1000,9000);const baseUrl=`http://127.0.0.1:${port}`;
  const serverPath=fileURLToPath(new URL('../../scripts/dev-api.js',import.meta.url));
  const child=spawn(process.execPath,[serverPath],{cwd:path.dirname(path.dirname(serverPath)),stdio:'ignore',env:{...process.env,PORT:String(port),HOST:'127.0.0.1',NODE_ENV:'test',SQL_DATABASE:databaseName,UPLOAD_DIR:uploadDirectory,N8N_WEBHOOK_BASE_URL:'',N8N_PUBLIC_BASE_URL:'',AUTO_SETUP:'false',JOBS_IN_DEV:'false'}});
  try {
    let health;for(let attempt=0;attempt<60;attempt++) {try{health=await fetch(`${baseUrl}/api/health`);if(health.ok)break;}catch{} await new Promise(resolve=>setTimeout(resolve,500));}
    assert.equal(health?.status,200,'HTTP server starts with migrated test database');
    const loginResponse=await fetch(`${baseUrl}/api/auth/login`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({phone:'0901234567',password:process.env.SEED_STAFF_PASSWORD||'nhanvien123'})});
    const loginBody=await loginResponse.json();assert.equal(loginResponse.status,201);
    const staffToken=loginBody.data.accessToken;
    const denied=await fetch(`${baseUrl}/api/stock-receipts`,{headers:{authorization:`Bearer ${staffToken}`}});
    assert.equal(denied.status,403,'nhân viên bị chặn khỏi API phiếu nhập');
    const allowed=await fetch(`${baseUrl}/api/appointments`,{headers:{authorization:`Bearer ${staffToken}`}});
    assert.equal(allowed.status,200,'nhân viên được xem lịch hẹn');
  } finally {
    child.kill('SIGTERM');
    if(child.exitCode===null)await new Promise(resolve=>{const timeout=setTimeout(()=>{child.kill('SIGKILL');resolve();},5000);child.once('exit',()=>{clearTimeout(timeout);resolve();});});
  }
});
