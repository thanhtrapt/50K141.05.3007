import test from 'node:test';
import assert from 'node:assert/strict';
import { login } from '../../src/authService.js';
import { customerFields,createReview } from '../../src/customerService.js';
import { validateService } from '../../src/serviceService.js';
import { validateProduct,createReceipt,createIssue } from '../../src/stockService.js';
import { validateDateAndTime,createAppointment,getAvailability } from '../../src/appointmentService.js';

const errorCode=(code)=>error=>error.code===code;

test('BR-0-01/02/03: login fields, Vietnamese mobile format and password length',async()=>{
  await assert.rejects(login({}, {headers:{},socket:{}}),error=>error.code==='VALIDATION_ERROR'&&error.fieldErrors.length===2);
  await assert.rejects(login({phone:'0212345678',password:'password1'},{}),error=>error.fieldErrors.some(x=>x.field==='phone'));
  await assert.rejects(login({phone:'0912345678',password:'short'},{}),error=>error.fieldErrors.some(x=>x.field==='password'));
  await assert.rejects(login({phone:'0912345678',password:'x'.repeat(21)},{}),error=>error.fieldErrors.some(x=>x.field==='password'));
});

test('BR-1.2-01/02 and BR-1.4-01/02: customer fields are required, date is real and phone has ten digits',()=>{
  assert.throws(()=>customerFields({name:'',phone:'123',dateOfBirth:'2020-02-31'}),error=>error.code==='VALIDATION_ERROR'&&error.fieldErrors.length>=3);
  assert.throws(()=>customerFields({name:'Khách',phone:'091234567',dateOfBirth:'2000-01-01'}),error=>error.fieldErrors.some(x=>x.field==='phone'));
  const valid=customerFields({name:'Khách',phone:'0912345678',dateOfBirth:'2000-01-01'});
  assert.equal(valid.soDienThoai,'0912345678');
});

test('BR-4.2-01/02 and BR-4.3-02: service name, price, sessions and session fields are validated',()=>{
  assert.throws(()=>validateService({name:'',price:0,sessions:[]}),error=>error.code==='VALIDATION_ERROR'&&error.fieldErrors.length>=3);
  assert.throws(()=>validateService({name:'Dịch vụ',price:100000,sessions:[{name:'Buổi 1',technique:'',durationMinutes:0,cosmeticsUsage:''}]}),error=>error.fieldErrors.length>=3);
  const valid=validateService({name:'Dịch vụ',price:100000,sessions:[{name:'Buổi 1',technique:'Chăm sóc',durationMinutes:30,cosmeticsUsage:'Serum 2ml'}]});
  assert.equal(valid.tongSoBuoi,1);
});

test('BR-2.2-01/03 and BR-2.3-01/03: mỹ phẩm bắt buộc tên và có giá không âm',()=>{
  assert.throws(()=>validateProduct({name:'',category:'Bán lẻ',unit:'Chai',salePrice:0}),error=>error.fieldErrors.some(x=>x.field==='name'));
  assert.throws(()=>validateProduct({name:'Sản phẩm',category:'Không rõ',unit:'Chai',salePrice:-1}),error=>error.code==='VALIDATION_ERROR');
  const valid=validateProduct({name:'Sản phẩm',category:'Bán lẻ',unit:'Chai',salePrice:0});
  assert.equal(valid.giaBan,0);
});

test('BR-5.1-02/03/05/07: phiếu nhập kiểm tra dòng, giá trị và hạn lô',async()=>{
  await assert.rejects(createReceipt({receiptDate:'2026-11-14',paymentStatus:'Đã thanh toán',items:[]},{id:'TK00000001'}),errorCode('VALIDATION_ERROR'));
  await assert.rejects(createReceipt({receiptDate:'2026-11-14',paymentStatus:'Đã thanh toán',items:[{cosmeticId:'MP00000002',purchasePrice:-1,quantity:0,lot:{productionDate:'2026-01-01',expiryDate:'2025-12-31'}}]},{id:'TK00000001'}),error=>error.code==='VALIDATION_ERROR'&&error.fieldErrors.length>=3);
});

test('BR-6.1-02/03/04: phiếu xuất yêu cầu dòng, ngày hợp lệ, số dương và lô không lặp',async()=>{
  await assert.rejects(createIssue({issueDate:'2099-01-01',items:[]},{id:'TK00000001'}),errorCode('VALIDATION_ERROR'));
  await assert.rejects(createIssue({issueDate:'2026-11-14',items:[{cosmeticId:'MP00000002',batchId:'141126-001',quantity:0},{cosmeticId:'MP00000002',batchId:'141126-001',quantity:1}]},{id:'TK00000001'}),error=>error.code==='VALIDATION_ERROR'&&error.fieldErrors.some(x=>x.message==='Lô đã có trong phiếu xuất'));
});

test('BR-1.7-01: review rating is restricted to one through five stars',async()=>{
  await assert.rejects(createReview({customerId:'KH00000001',servicePackageId:'LHD00000001',rating:0,content:'Nội dung'},null),error=>error.fieldErrors.some(x=>x.field==='rating'));
  await assert.rejects(createReview({customerId:'KH00000001',servicePackageId:'LHD00000001',rating:6,content:'Nội dung'},null),error=>error.fieldErrors.some(x=>x.field==='rating'));
});

test('BR-3.2-01: lịch hẹn yêu cầu ngày và giờ hợp lệ; availability rejects invalid day and duration',async()=>{
  assert.throws(()=>validateDateAndTime({date:'2026-02-31',startTime:'10:00'}),error=>error.fieldErrors.some(x=>x.field==='date'));
  assert.throws(()=>validateDateAndTime({date:'2026-11-14',startTime:'25:90'}),error=>error.fieldErrors.some(x=>x.field==='startTime'));
  await assert.rejects(getAvailability({date:'2026-02-31',durationMinutes:30}),errorCode('VALIDATION_ERROR'));
  await assert.rejects(getAvailability({date:'2026-11-14',durationMinutes:0}),errorCode('VALIDATION_ERROR'));
  await assert.rejects(createAppointment({date:'2026-11-14',startTime:'10:00'},{id:'TK00000001'}),error=>error.fieldErrors.some(x=>x.field==='customerId'));
});
