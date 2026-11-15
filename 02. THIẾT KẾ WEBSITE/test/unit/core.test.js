import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeVietnamese,paginate,parseDate,idempotentCode } from '../../api/_lib/utils.js';
import { formatEntityCode,formatLotCode } from '../../api/_lib/repositories.js';
import { availableSlots } from '../../api/_lib/appointmentService.js';
import { hashPassword,verifyPassword,signToken,verifyToken,signActionToken,verifyActionToken } from '../../api/_lib/security.js';
import { Readable } from 'node:stream';
import { readBody } from '../../api/_lib/http.js';

test('tìm kiếm không phân biệt dấu và hoa thường',()=>{
  assert.equal(normalizeVietnamese('  Mỹ Phẩm HƯƠNG  '),'my pham huong');
  assert.equal(normalizeVietnamese('Đặng Thị Ánh'),'dang thi anh');
});

test('phân trang giới hạn page và limit, kể cả khi tham số sai',()=>{
  assert.deepEqual(paginate(['a','b','c'],0,500),{data:['a','b','c'],meta:{page:1,limit:100,total:3,totalPages:1}});
  assert.deepEqual(paginate([1,2,3,4],2,2),{data:[3,4],meta:{page:2,limit:2,total:4,totalPages:2}});
});

test('ngày lịch hợp lệ phải tồn tại trong lịch Gregorian',()=>{
  const errors=[];
  assert.equal(parseDate('2024-02-29','date',errors,'Ngày'),'2024-02-29');
  assert.equal(parseDate('2025-02-29','date',errors,'Ngày'),null);
  assert.equal(parseDate('2025-13-01','date',errors,'Ngày'),null);
  assert.equal(errors.length,2);
});

test('mã lô theo ddMMyy-STT với bộ đếm tăng',()=>{
  assert.equal(formatLotCode('2026-11-14',1),'141126-001');
  assert.equal(formatLotCode('2026-11-14',12),'141126-012');
  assert.equal(formatLotCode('2026-11-14',1000),'141126-1000');
  assert.throws(()=>formatLotCode('2026-02-31',1));
  assert.throws(()=>formatLotCode('2026-11-14',0));
  assert.equal(idempotentCode('EV','2026-11-14',3),'EV-20261114-003');
});

test('mã nghiệp vụ luôn vừa cột CHAR(10), kể cả tiền tố ba ký tự',()=>{
  assert.equal(formatEntityCode('PNB',1),'PNB0000001');
  assert.equal(formatEntityCode('LHD',1234567),'LHD1234567');
  assert.equal(formatEntityCode('KH',1),'KH00000001');
  assert.throws(()=>formatEntityCode('LHD',10000000));
  assert.equal(formatEntityCode('PNB',1).length,10);
});

test('tạo gợi ý khung giờ tôn trọng giờ mở cửa, thời lượng và sức chứa',()=>{
  const config={SPA_OPEN_TIME:'08:00',SPA_CLOSE_TIME:'10:00',APPOINTMENT_SLOT_MINUTES:'30',SERVICE_BED_COUNT:'3',SERVICE_PROVIDER_COUNT:'1'};
  const busy=[{startMinutes:480,endMinutes:540}];
  assert.deepEqual(availableSlots({date:'2026-11-15',duration:30,busy,config,limit:3}).map(x=>x.startTime),['09:00','09:30']);
  assert.deepEqual(availableSlots({date:'2026-11-15',duration:121,busy:[],config,limit:5}),[]);
});

test('mật khẩu được băm và chỉ mật khẩu ban đầu xác thực',async()=>{
  const hash=hashPassword('chuspa123');
  assert.match(hash,/^scrypt\$16384\$8\$1\$/);
  assert.equal(await verifyPassword('chuspa123',hash),true);
  assert.equal(await verifyPassword('sai-mat-khau',hash),false);
  assert.equal(await verifyPassword('anything','plaintext'),false);
});

test('JWT và action token từ chối chữ ký sai, sai mục đích và hết hạn',()=>{
  // Đổi ký tự đầu của phần chữ ký sang ký tự Base64URL khác để byte chữ ký chắc chắn thay đổi.
  const tamper=(token)=>{
    const parts=token.split('.');
    const signature=parts.at(-1);
    const replacement=signature[0]==='A'?'B':'A';
    parts[parts.length-1]=`${replacement}${signature.slice(1)}`;
    return parts.join('.');
  };
  const jwt=signToken({id:'TK00000001',phone:'0912345678',role:'OWNER'});
  assert.equal(verifyToken(jwt)?.sub,'TK00000001');
  assert.equal(verifyToken(tamper(jwt)),null);
  const action=signActionToken('session-confirmation',{packageId:'PK00000001'},60);
  assert.equal(verifyActionToken(action,'session-confirmation')?.packageId,'PK00000001');
  assert.equal(verifyActionToken(action,'service-review'),null);
  assert.equal(verifyActionToken(signActionToken('session-confirmation',{},-1),'session-confirmation'),null);
  assert.equal(verifyActionToken(tamper(action),'session-confirmation'),null);
});

test('readBody ưu tiên req.body đã parse sẵn của Vercel thay vì đọc stream đã cạn',async()=>{
  const json={code:'KH00000001'};
  const parsed=Readable.from([]);
  parsed.headers={'content-type':'application/json'};
  parsed.body=json;
  assert.deepEqual(await readBody(parsed),json);

  const buffered=Readable.from([]);
  buffered.headers={'content-type':'application/json'};
  buffered.body=Buffer.from('{"ok":true}');
  assert.deepEqual(await readBody(buffered),{ok:true});

  const form=Readable.from([Buffer.from('a=1&b=hai')]);
  form.headers={'content-type':'application/x-www-form-urlencoded'};
  assert.deepEqual(await readBody(form),{a:'1',b:'hai'});
});

test('readBody từ chối JSON hỏng và Content-Type không hỗ trợ',async()=>{
  const broken=Readable.from([Buffer.from('{')]);
  broken.headers={'content-type':'application/json'};
  await assert.rejects(()=>readBody(broken),(error)=>error.status===400&&error.code==='VALIDATION_ERROR');
  const xml=Readable.from([Buffer.from('<x/>')]);
  xml.headers={'content-type':'text/xml'};
  await assert.rejects(()=>readBody(xml),(error)=>error.status===415);
});
