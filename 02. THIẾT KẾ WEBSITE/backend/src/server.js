import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { config } from './config.js';
import { connectDatabase, closeDatabase, getPool, inTransaction, requestFor, sqlTypes } from './database.js';
import { authenticate, login } from './authService.js';
import { AppError, badRequest, forbidden, notFound, unauthorized } from './errors.js';
import { insertAudit } from './repositories.js';
import { nowIso } from './utils.js';
import { verifyActionToken } from './security.js';
import { runSeed } from './seed.js';
import { listServices,getService,createService,updateService,deleteService } from './serviceService.js';
import {
  listCustomers,getCustomer,createCustomer,updateCustomer,deleteCustomer,listCustomerServiceHistory,assignServicePackage,
  getServicePackage,startPackageSession,completePackageSession,confirmPackageSession,listRetailCosmetics,createRetailSale,
  listReviews,getReview,createReview,
} from './customerService.js';
import { listAppointments,getAppointment,getAvailability,createAppointment,updateAppointment,cancelAppointment,listCancellations } from './appointmentService.js';
import { startAppointmentScheduler,stopAppointmentScheduler,startDailyExpiryScheduler,stopDailyExpiryScheduler } from './appointmentScheduler.js';
import { logInboundEvent,startNotificationWorker,stopNotificationWorker } from './notificationService.js';
import {
  listCosmetics,getCosmetic,createCosmetic,updateCosmetic,deleteCosmetic,listLots,
  createReceipt,listReceipts,getReceipt,createIssue,listIssues,getIssue,listAlerts,updateConfiguration,
} from './stockService.js';

const dirname=path.dirname(fileURLToPath(import.meta.url));
const maxBodyBytes=12*1024*1024;
const mimeTypes={'.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.pdf':'application/pdf'};

async function readBody(req) {
  const chunks=[];let size=0;
  for await(const chunk of req){size+=chunk.length;if(size>maxBodyBytes)throw new AppError(413,'PAYLOAD_TOO_LARGE','Tệp hoặc nội dung gửi lên vượt quá giới hạn.');chunks.push(chunk);}
  const raw=Buffer.concat(chunks);
  if(!raw.length)return {};
  const type=String(req.headers['content-type']||'').split(';')[0].trim();
  if(type==='application/json') {
    try{return JSON.parse(raw.toString('utf8'));}catch{throw badRequest('Dữ liệu JSON không hợp lệ.');}
  }
  if(type==='application/x-www-form-urlencoded') return Object.fromEntries(new URLSearchParams(raw.toString('utf8')));
  if(type==='multipart/form-data') {
    const boundary=/boundary=(?:"([^"]+)"|([^;]+))/i.exec(String(req.headers['content-type']||''));
    if(!boundary) throw badRequest('Thiếu boundary của biểu mẫu tải tệp.');
    const marker=Buffer.from(`--${boundary[1]||boundary[2]}`);
    const fields={};let cursor=0;
    while((cursor=raw.indexOf(marker,cursor))>=0) {
      cursor+=marker.length;
      if(raw.subarray(cursor,cursor+2).toString()==='--')break;
      if(raw.subarray(cursor,cursor+2).toString()==='\r\n')cursor+=2;
      const headerEnd=raw.indexOf(Buffer.from('\r\n\r\n'),cursor);
      if(headerEnd<0)break;
      const headerText=raw.subarray(cursor,headerEnd).toString('utf8');
      const next=raw.indexOf(marker,headerEnd+4);
      if(next<0)break;
      const value=raw.subarray(headerEnd+4,Math.max(headerEnd+4,next-2));
      const name=/name="([^"]+)"/i.exec(headerText)?.[1];
      const filename=/filename="([^"]*)"/i.exec(headerText)?.[1];
      const contentType=/\r\ncontent-type:\s*([^\r\n]+)/i.exec(`\r\n${headerText}`)?.[1]?.trim();
      if(name&&filename!==undefined) {
        fields.base64=value.toString('base64');
        fields.mimeType=contentType||'application/octet-stream';
        fields.originalName=filename;
      } else if(name) fields[name]=value.toString('utf8');
      cursor=next;
    }
    return fields;
  }
  throw new AppError(415,'UNSUPPORTED_MEDIA_TYPE','Content-Type phải là application/json.');
}

function json(res,status,data) {
  const body=JSON.stringify(data);
  res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Content-Length':Buffer.byteLength(body),'Cache-Control':'no-store'});
  res.end(body);
}

function cors(req,res) {
  const origin=req.headers.origin;
  if(origin&&config.corsOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin',origin);
    res.setHeader('Vary','Origin');
    res.setHeader('Access-Control-Allow-Credentials','true');
  }
  res.setHeader('Access-Control-Allow-Headers','Authorization, Content-Type');
  res.setHeader('Access-Control-Allow-Methods','GET, POST, PUT, PATCH, DELETE, OPTIONS');
}

async function serveUpload(urlPath,res) {
  const relative=decodeURIComponent(urlPath.replace(/^\/uploads\//,''));
  const full=path.resolve(config.uploadDir,relative);
  if(!full.startsWith(`${path.resolve(config.uploadDir)}${path.sep}`))throw notFound('Không tìm thấy tệp.');
  let file;try{file=await fs.readFile(full);}catch{throw notFound('Không tìm thấy tệp.');}
  const contentType=mimeTypes[path.extname(full).toLowerCase()]||'application/octet-stream';
  res.writeHead(200,{'Content-Type':contentType,'Content-Length':file.length,'Cache-Control':'public, max-age=86400'});res.end(file);
}

async function serveApiDocumentation(pathname,res) {
  if(pathname==='/docs'||pathname==='/docs/') {
    const html='<!doctype html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Hương Spa API</title><link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css"></head><body><div id="swagger-ui"></div><script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script><script>SwaggerUIBundle({url:"/openapi.json",dom_id:"#swagger-ui",deepLinking:true,persistAuthorization:true,displayRequestDuration:true})</script></body></html>';
    res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Content-Length':Buffer.byteLength(html),'Cache-Control':'no-store'});res.end(html);return true;
  }
  if(pathname==='/openapi.json') {
    const spec=await fs.readFile(path.resolve(dirname,'../docs/openapi.json'));
    res.writeHead(200,{'Content-Type':'application/vnd.oai.openapi+json;version=3.1','Content-Length':spec.length,'Cache-Control':'no-cache'});res.end(spec);return true;
  }
  return false;
}

function validImageSignature(buffer,mime) {
  if(mime==='image/png')return buffer.length>8&&buffer.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
  if(mime==='image/jpeg')return buffer.length>3&&buffer[0]===0xff&&buffer[1]===0xd8&&buffer[2]===0xff;
  if(mime==='image/webp')return buffer.length>12&&buffer.toString('ascii',0,4)==='RIFF'&&buffer.toString('ascii',8,12)==='WEBP';
  return false;
}

async function uploadImage(body,user) {
  const mime=String(body.mimeType||'');
  if(!['image/png','image/jpeg','image/webp'].includes(mime))throw badRequest('Định dạng ảnh không được hỗ trợ.',[{field:'mimeType',message:'Chỉ hỗ trợ PNG, JPEG hoặc WEBP'}]);
  const data=String(body.base64||'').replace(/^data:[^;]+;base64,/,'');
  let buffer;try{buffer=Buffer.from(data,'base64');}catch{throw badRequest('Tệp ảnh không hợp lệ.',[{field:'base64',message:'Dữ liệu ảnh không hợp lệ'}]);}
  if(!buffer.length||buffer.length>8*1024*1024||!validImageSignature(buffer,mime))throw badRequest('Tệp ảnh không hợp lệ.',[{field:'base64',message:'Ảnh rỗng, quá lớn hoặc nội dung không khớp định dạng'}]);
  await fs.mkdir(config.uploadDir,{recursive:true});
  const ext=mime==='image/jpeg'?'.jpg':mime==='image/webp'?'.webp':'.png';
  const filename=`${crypto.randomUUID()}${ext}`;
  await fs.writeFile(path.join(config.uploadDir,filename),buffer,{flag:'wx'});
  await inTransaction(tx=>insertAudit({transaction:tx,user,action:'Tải ảnh lên',entity:'TaiNguyenTep',entityId:filename,before:null,after:{mimeType:mime,size:buffer.length,originalName:String(body.originalName||'').slice(0,255)}}));
  return {path:`/uploads/${filename}`,url:`${config.publicBaseUrl}/uploads/${filename}`,mimeType:mime,size:buffer.length};
}

const routes=[];
function route(method,pattern,handler,{auth=true,roles=null}={}) {
  const keys=[];
  const expression=new RegExp(`^${pattern.replace(/[.*+?^${}()|[\]\\]/g,'\\$&').replace(/:([A-Za-z0-9_]+)/g,(_,key)=>{keys.push(key);return '([^/]+)';})}/?$`);
  routes.push({method,expression,keys,handler,auth,roles});
}

route('GET','/health',async()=>({status:'ok',service:'huong-spa-backend'}),{auth:false});
route('POST','/api/auth/login',(req,body)=>login(body,req),{auth:false});
route('GET','/api/auth/me',async(req)=>({user:req.user}));
route('GET','/api/customers',async(req)=>listCustomers(req.query));
route('POST','/api/customers',async(_req,body,_params,user)=>createCustomer(body,user));
route('GET','/api/customers/:id/service-history',async(req,_body,params)=>listCustomerServiceHistory(params.id,req.query));
route('POST','/api/customers/:id/service-packages',async(_req,body,params,user)=>assignServicePackage(params.id,body,user));
route('POST','/api/customers/:id/retail-sales',async(_req,body,params,user)=>createRetailSale(params.id,body,user));
route('GET','/api/customers/:id',async(_req,_body,params)=>getCustomer(params.id));
route('PUT','/api/customers/:id',async(_req,body,params,user)=>updateCustomer(params.id,body,user));
route('DELETE','/api/customers/:id',async(_req,_body,params,user)=>deleteCustomer(params.id,user));
route('GET','/api/service-packages/:id',async(_req,_body,params)=>getServicePackage(params.id));
route('POST','/api/service-packages/:packageId/sessions/:sessionId/start',async(_req,_body,params,user)=>startPackageSession(params.packageId,params.sessionId,user));
route('POST','/api/service-packages/:packageId/sessions/:sessionId/complete',async(_req,body,params,user)=>completePackageSession(params.packageId,params.sessionId,body,user));
route('GET','/api/retail-products',async(req)=>listRetailCosmetics(req.query));
route('GET','/api/reviews',async(req)=>listReviews(req.query));
route('GET','/api/reviews/:id',async(_req,_body,params)=>getReview(params.id));
route('POST','/api/reviews',async(_req,body,_params,user)=>createReview(body,user));
route('GET','/api/appointments/availability',async(req)=>getAvailability(req.query));
route('GET','/api/appointments/cancellations',async(req)=>listCancellations(null,req.query));
route('GET','/api/customers/:id/cancellations',async(req,_body,params)=>listCancellations(params.id,req.query));
route('GET','/api/appointments',async(req)=>listAppointments(req.query));
route('POST','/api/appointments',async(_req,body,_params,user)=>createAppointment(body,user),{roles:['OWNER']});
route('GET','/api/appointments/:id',async(_req,_body,params)=>getAppointment(params.id));
route('PUT','/api/appointments/:id',async(_req,body,params,user)=>updateAppointment(params.id,body,user),{roles:['OWNER']});
route('POST','/api/appointments/:id/cancel',async(_req,body,params,user)=>cancelAppointment(params.id,body,user),{roles:['OWNER']});
route('GET','/api/services',async(req)=>listServices(req.query));
route('GET','/api/services/:id',async(_req,_body,params)=>getService(params.id));
route('POST','/api/services',async(_req,body,_params,user)=>createService(body,user),{roles:['OWNER']});
route('PUT','/api/services/:id',async(_req,body,params,user)=>updateService(params.id,body,user),{roles:['OWNER']});
route('DELETE','/api/services/:id',async(_req,_body,params,user)=>deleteService(params.id,user),{roles:['OWNER']});
route('GET','/api/cosmetics',async(req)=>listCosmetics(req.query));
route('GET','/api/cosmetics/:id',async(req,_body,params)=>getCosmetic(params.id));
route('POST','/api/cosmetics',async(_req,body,_params,user)=>createCosmetic(body,user),{roles:['OWNER']});
route('PUT','/api/cosmetics/:id',async(_req,body,params,user)=>updateCosmetic(params.id,body,user),{roles:['OWNER']});
route('DELETE','/api/cosmetics/:id',async(_req,_body,params,user)=>deleteCosmetic(params.id,user),{roles:['OWNER']});
route('GET','/api/cosmetics/:id/lots',async(req,_body,params)=>listLots({...req.query,cosmeticId:params.id}));
route('GET','/api/lots',async(req)=>listLots(req.query));
route('POST','/api/files/images',async(_req,body,_params,user)=>uploadImage(body,user));
route('POST','/api/webhooks/n8n/session-confirmed',async(req,body)=>{
  verifyN8nWebhook(req);
  const data=body&&typeof body==='object'?body:{};
  const token=verifyActionToken(data.confirmationToken,'session-confirmation');
  if(!token||token.packageId!==String(data.packageId)||token.sessionId!==String(data.sessionId))throw unauthorized('Liên kết xác nhận không hợp lệ hoặc đã hết hạn.');
  const result=await confirmPackageSession(data.packageId,data.sessionId,null);
  await logInboundEvent({event:'SESSION_CONFIRMED',recipient:data.phone||null,payload:{packageId:data.packageId,sessionId:data.sessionId},response:result});
  return result;
},{auth:false});
route('POST','/api/webhooks/n8n/review-submitted',async(req,body)=>{
  verifyN8nWebhook(req);
  const data=body&&typeof body==='object'?body:{};
  const token=verifyActionToken(data.reviewToken,'service-review');
  if(!token)throw unauthorized('Liên kết đánh giá không hợp lệ hoặc đã hết hạn.');
  const result=await createReview({...data,customerId:token.customerId,servicePackageId:token.packageId},null);
  await logInboundEvent({event:'REVIEW_SUBMITTED',recipient:data.phone||null,payload:{customerId:token.customerId,servicePackageId:token.packageId,rating:data.rating},response:{reviewId:result.id}});
  return result;
},{auth:false});
route('POST','/api/dev/simulate-zalo-session-confirmed',async(_req,body,_params,user)=>{
  if(config.nodeEnv!=='development')throw notFound('Không tìm thấy API phù hợp.');
  const result=await confirmPackageSession(String(body.packageId||''),String(body.sessionId||''),user);
  return {...result,simulated:true};
},{roles:['OWNER']});
route('POST','/api/dev/simulate-zalo-review-submitted',async(_req,body,_params,user)=>{
  if(config.nodeEnv!=='development')throw notFound('Không tìm thấy API phù hợp.');
  return {...await createReview(body,user),simulated:true};
},{roles:['OWNER']});
route('GET','/api/alerts',async(req)=>listAlerts(req.query));
route('GET','/api/alerts/stock',async(req)=>listAlerts({...req.query,type:'LOW_STOCK'}));
route('GET','/api/alerts/expiry',async(req)=>listAlerts({...req.query,type:'EXPIRY'}));
route('GET','/api/system-config',async()=>{
  const rows=(await getPool().request().query('SELECT maCauHinh AS [key],giaTri AS value,kieuGiaTri AS valueType,moTa AS description,capNhatLuc AS updatedAt FROM dbo.CauHinhHeThong ORDER BY maCauHinh')).recordset;
  return {data:rows.map(row=>({...row,value:row.valueType==='number'?Number(row.value):row.value}))};
},{roles:['OWNER']});
route('PATCH','/api/system-config/:key',async(_req,body,params,user)=>updateConfiguration(params.key,body.value,user),{roles:['OWNER']});
route('GET','/api/stock-receipts',async(req)=>listReceipts(req.query),{roles:['OWNER']});
route('GET','/api/stock-receipts/:id',async(_req,_body,params)=>getReceipt(params.id),{roles:['OWNER']});
route('POST','/api/stock-receipts',async(_req,body,_params,user)=>createReceipt(body,user),{roles:['OWNER']});
route('GET','/api/stock-issues',async(req)=>listIssues(req.query));
route('GET','/api/stock-issues/:id',async(_req,_body,params)=>getIssue(params.id));
route('POST','/api/stock-issues',async(_req,body,_params,user)=>createIssue(body,user));

function verifyN8nWebhook(req) {
  if(!config.n8nWebhookSecret)throw new AppError(503,'WEBHOOK_NOT_CONFIGURED','Webhook n8n chưa được cấu hình.');
  const supplied=String(req.headers.authorization||'').replace(/^Bearer\s+/i,'');
  const expected=Buffer.from(config.n8nWebhookSecret);const actual=Buffer.from(supplied);
  if(!supplied||expected.length!==actual.length||!crypto.timingSafeEqual(expected,actual))throw unauthorized('Webhook không được xác thực.');
}

const server=http.createServer(async(req,res)=>{
  cors(req,res);
  if(req.method==='OPTIONS'){res.writeHead(204);res.end();return;}
  try {
    const url=new URL(req.url,'http://localhost');
    if(req.method==='GET'&&await serveApiDocumentation(url.pathname,res))return;
    if(req.method==='GET'&&url.pathname.startsWith('/uploads/')){await serveUpload(url.pathname,res);return;}
    const found=routes.map(route=>({route,match:route.method===req.method?route.expression.exec(url.pathname):null})).find(item=>item.match);
    if(!found)throw notFound('Không tìm thấy API phù hợp.');
    const {route:matched,match}=found;
    const params=Object.fromEntries(matched.keys.map((key,index)=>[key,decodeURIComponent(match[index+1])]));
    const query=Object.fromEntries(url.searchParams.entries());
    req.query=query;
    let user=null;
    if(matched.auth) user=await authenticate(req);
    if(user&&matched.roles&&!matched.roles.includes(user.role))throw forbidden();
    const body=['POST','PUT','PATCH','DELETE'].includes(req.method)?await readBody(req):{};
    const result=await matched.handler(req,body,params,user);
    if(result?.statusCode&&result?.headers){res.writeHead(result.statusCode,result.headers);res.end(result.body);return;}
    const status=req.method==='POST'?201:200;
    json(res,status,{code:'OK',message:result?.message||'Thành công',data:result});
  } catch(error) {
    const known=error instanceof AppError;
    if(!known)console.error(error);
    const status=known?error.status:500;
    const message=known?error.message:'Đã xảy ra lỗi trong quá trình xử lý.';
    json(res,status,{code:known?error.code:'INTERNAL_ERROR',message,fieldErrors:known?error.fieldErrors:[]});
  }
});

async function start() {
  await runSeed();
  await connectDatabase();
  startAppointmentScheduler();
  startDailyExpiryScheduler();
  startNotificationWorker();
  server.listen(config.port,config.host,()=>process.stdout.write(`Hương Spa API đang chạy tại http://${config.host}:${config.port}\n`));
}

async function stop() {
  stopAppointmentScheduler();
  stopDailyExpiryScheduler();
  stopNotificationWorker();
  server.close(async()=>{await closeDatabase();process.exit(0);});
}
process.on('SIGINT',stop);process.on('SIGTERM',stop);
start().catch(async(error)=>{console.error('Không thể khởi động Backend:',error.message);await closeDatabase();process.exitCode=1;});
