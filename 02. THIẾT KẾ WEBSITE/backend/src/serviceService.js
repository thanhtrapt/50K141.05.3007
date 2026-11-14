import { getPool, inTransaction, requestFor, sqlTypes } from './database.js';
import { AppError, fieldValidation, notFound } from './errors.js';
import { insertAudit, nextCode } from './repositories.js';
import { normalizeVietnamese, paginate } from './utils.js';

const invalid=(message,errors)=>new AppError(400,'VALIDATION_ERROR',message,errors);
const money=value=>Number.isSafeInteger(Number(value))&&Number(value)>0?Number(value):null;
const positiveInt=value=>Number.isSafeInteger(Number(value))&&Number(value)>0?Number(value):null;

export function validateService(body,{partial=false}={}) {
  const errors=[];const result={};
  if(!partial||body.name!==undefined||body.tenDV!==undefined) {
    const name=String(body.name??body.tenDV??'').trim();
    if(!name)errors.push({field:'name',message:'Tên dịch vụ không được bỏ trống'});
    else if(name.length>100)errors.push({field:'name',message:'Tên dịch vụ tối đa 100 ký tự'});
    result.tenDV=name;
  }
  if(!partial||body.price!==undefined||body.giaDV!==undefined) {
    const price=money(body.price??body.giaDV);
    if(price===null)errors.push({field:'price',message:'Giá dịch vụ phải là số nguyên dương'});
    else result.giaDV=price;
  }
  const hasSessions=body.sessions!==undefined||body.sessionsDetails!==undefined||body.chiTietBuoi!==undefined;
  if(!partial||hasSessions) {
    const sessions=body.sessions??body.sessionsDetails??body.chiTietBuoi;
    if(!Array.isArray(sessions)||sessions.length===0)errors.push({field:'sessions',message:'Thông tin chưa hoàn tất, yêu cầu nhập lại'});
    else result.sessions=sessions.map((session,index)=>{
      const name=String(session.name??session.tenBuoi??'').trim();
      const technique=String(session.technique??session.kyThuat??'').trim();
      const usage=String(session.cosmeticsUsage??session.myPhamSD??'').trim();
      const duration=positiveInt(session.durationMinutes??session.thoiGianThucHien);
      if(!name)errors.push({field:`sessions.${index}.name`,message:'Tên buổi không được bỏ trống'});
      if(name.length>20)errors.push({field:`sessions.${index}.name`,message:'Tên buổi tối đa 20 ký tự'});
      if(!technique)errors.push({field:`sessions.${index}.technique`,message:'Kỹ thuật thực hiện không được bỏ trống'});
      if(technique.length>255)errors.push({field:`sessions.${index}.technique`,message:'Kỹ thuật thực hiện tối đa 255 ký tự'});
      if(!usage)errors.push({field:`sessions.${index}.cosmeticsUsage`,message:'Mỹ phẩm sử dụng và định lượng không được bỏ trống'});
      if(usage.length>200)errors.push({field:`sessions.${index}.cosmeticsUsage`,message:'Mỹ phẩm sử dụng tối đa 200 ký tự'});
      if(duration===null)errors.push({field:`sessions.${index}.durationMinutes`,message:'Thời gian thực hiện phải là số nguyên dương'});
      return {tenBuoi:name,kyThuat:technique,myPhamSD:usage,thoiGianThucHien:duration};
    });
  }
  const total=body.totalSessions??body.tongSoBuoi;
  if(total!==undefined) {
    const n=positiveInt(total);
    if(n===null)errors.push({field:'totalSessions',message:'Số buổi thực hiện phải là số nguyên dương'});
    else result.tongSoBuoi=n;
  }
  if(result.sessions&&result.tongSoBuoi!==undefined&&result.sessions.length!==result.tongSoBuoi)
    errors.push({field:'totalSessions',message:'Số buổi phải khớp với số chi tiết buổi đã khai báo'});
  if(result.sessions&&result.tongSoBuoi===undefined)result.tongSoBuoi=result.sessions.length;
  fieldValidation(errors,'Thông tin không hợp lệ, yêu cầu nhập lại');
  if(errors.length)throw invalid('Thông tin chưa hoàn tất, yêu cầu nhập lại',errors);
  return result;
}

async function loadService(id,{activeOnly=true,transaction}={}) {
  const where=activeOnly?' AND d.trangThai=1':'';
  const head=(await requestFor(transaction).input('id',sqlTypes.Char(10),id).query(`SELECT d.maDichVu AS id,d.tenDV AS name,d.giaDV AS price,d.tongSoBuoi AS totalSessions,d.trangThai AS isActive
    FROM dbo.DichVu d WHERE d.maDichVu=@id${where}`)).recordset[0];
  if(!head)throw notFound('Dịch vụ không tồn tại');
  const sessions=(await requestFor(transaction).input('id',sqlTypes.Char(10),id).query(`SELECT maCT_DichVu AS id,tenBuoi AS name,kyThuat AS technique,
    thoiGianThucHien AS durationMinutes,myPhamSD AS cosmeticsUsage FROM dbo.CT_DichVu WHERE maDichVu=@id ORDER BY maCT_DichVu`)).recordset;
  return {...head,id:head.id.trim(),price:Number(head.price),totalSessions:Number(head.totalSessions),isActive:Boolean(head.isActive),sessions:sessions.map(x=>({...x,id:x.id.trim(),durationMinutes:Number(x.durationMinutes)}))};
}

export async function listServices(query={}) {
  const rows=(await getPool().request().query(`SELECT d.maDichVu AS id,d.tenDV AS name,d.giaDV AS price,d.tongSoBuoi AS totalSessions
    FROM dbo.DichVu d WHERE d.trangThai=1 ORDER BY d.tenDV,d.maDichVu`)).recordset.map(x=>({...x,id:x.id.trim(),price:Number(x.price),totalSessions:Number(x.totalSessions)}));
  const keyword=normalizeVietnamese(query.keyword||'');
  const filtered=keyword?rows.filter(x=>normalizeVietnamese(`${x.id} ${x.name}`).includes(keyword)):rows;
  return paginate(filtered,query.page,query.limit);
}

export async function getService(id) { return loadService(id); }

async function ensureUniqueName(name,excludeId,transaction) {
  const result=await requestFor(transaction).input('name',sqlTypes.NVarChar(100),name).input('exclude',sqlTypes.Char(10),excludeId||'').query(`SELECT TOP(1) maDichVu FROM dbo.DichVu WITH (UPDLOCK,HOLDLOCK)
    WHERE trangThai=1 AND tenDV=@name AND maDichVu<>@exclude`);
  if(result.recordset.length)throw invalid('Thông tin chưa hoàn tất, yêu cầu nhập lại',[{field:'name',message:'Tên dịch vụ đã tồn tại'}]);
}

async function insertSessions(transaction,serviceId,sessions,user) {
  for(const session of sessions) {
    const sessionId=await nextCode('CD',transaction);
    await requestFor(transaction).input('id',sqlTypes.Char(10),sessionId).input('name',sqlTypes.NVarChar(20),session.tenBuoi)
      .input('technique',sqlTypes.NVarChar(255),session.kyThuat).input('duration',sqlTypes.Int,session.thoiGianThucHien)
      .input('usage',sqlTypes.NVarChar(200),session.myPhamSD).input('service',sqlTypes.Char(10),serviceId)
      .query('INSERT INTO dbo.CT_DichVu(maCT_DichVu,tenBuoi,kyThuat,thoiGianThucHien,myPhamSD,maDichVu) VALUES(@id,@name,@technique,@duration,@usage,@service)');
  }
}

export async function createService(body,user) {
  const value=validateService(body);
  return inTransaction(async transaction=>{
    await ensureUniqueName(value.tenDV,null,transaction);
    const id=await nextCode('DV',transaction);
    await requestFor(transaction).input('id',sqlTypes.Char(10),id).input('name',sqlTypes.NVarChar(100),value.tenDV)
      .input('price',sqlTypes.Money,value.giaDV).input('count',sqlTypes.Int,value.tongSoBuoi)
      .query('INSERT INTO dbo.DichVu(maDichVu,tenDV,giaDV,tongSoBuoi,trangThai) VALUES(@id,@name,@price,@count,1)');
    await insertSessions(transaction,id,value.sessions,user);
    const after={maDichVu:id,...value,trangThai:true};
    await insertAudit({transaction,user,action:'Tạo thông tin dịch vụ',entity:'DichVu',entityId:id,before:null,after});
    return {...await loadService(id,{transaction}),message:'Tạo thông tin dịch vụ thành công'};
  });
}

export async function updateService(id,body,user) {
  const value=validateService(body,{partial:true});
  return inTransaction(async transaction=>{
    const before=await loadService(id,{transaction});
    if(value.tenDV)await ensureUniqueName(value.tenDV,id,transaction);
    const assignments=[];const request=requestFor(transaction).input('id',sqlTypes.Char(10),id);
    if(value.tenDV!==undefined){assignments.push('tenDV=@name');request.input('name',sqlTypes.NVarChar(100),value.tenDV);}
    if(value.giaDV!==undefined){assignments.push('giaDV=@price');request.input('price',sqlTypes.Money,value.giaDV);}
    if(value.tongSoBuoi!==undefined){assignments.push('tongSoBuoi=@count');request.input('count',sqlTypes.Int,value.tongSoBuoi);}
    if(assignments.length)await request.query(`UPDATE dbo.DichVu SET ${assignments.join(',')} WHERE maDichVu=@id`);
    if(value.tongSoBuoi!==undefined&&!value.sessions&&value.tongSoBuoi!==before.sessions.length)
      throw invalid('Thông tin không hợp lệ, yêu cầu nhập lại',[{field:'totalSessions',message:'Số buổi phải khớp với số chi tiết buổi đã khai báo'}]);
    if(value.sessions) {
      const linked=Number((await requestFor(transaction).input('id',sqlTypes.Char(10),id)
        .query('SELECT COUNT_BIG(*) AS total FROM dbo.DonMuaDV WITH (UPDLOCK,HOLDLOCK) WHERE maDichVu=@id')).recordset[0].total)>0;
      if(linked&&value.sessions.length!==before.sessions.length)
        throw new AppError(409,'SERVICE_SESSION_COUNT_IN_USE','Không thể đổi số buổi của dịch vụ đã được khách hàng mua.');
      if(linked) {
        for(let index=0;index<value.sessions.length;index++) {
          const session=value.sessions[index];const sessionId=before.sessions[index].id;
          await requestFor(transaction).input('id',sqlTypes.Char(10),sessionId).input('name',sqlTypes.NVarChar(20),session.tenBuoi)
            .input('technique',sqlTypes.NVarChar(255),session.kyThuat).input('duration',sqlTypes.Int,session.thoiGianThucHien)
            .input('usage',sqlTypes.NVarChar(200),session.myPhamSD)
            .query('UPDATE dbo.CT_DichVu SET tenBuoi=@name,kyThuat=@technique,thoiGianThucHien=@duration,myPhamSD=@usage WHERE maCT_DichVu=@id');
        }
      } else {
        await requestFor(transaction).input('id',sqlTypes.Char(10),id).query('DELETE FROM dbo.CT_DichVu WHERE maDichVu=@id');
        await insertSessions(transaction,id,value.sessions,user);
      }
    }
    const after=await loadService(id,{transaction});
    await insertAudit({transaction,user,action:'Cập nhật thông tin dịch vụ',entity:'DichVu',entityId:id,before,after});
    return {...after,message:'Cập nhật thông tin dịch vụ thành công'};
  });
}

export async function deleteService(id,user) {
  return inTransaction(async transaction=>{
    const before=await loadService(id,{transaction});
    const used=(await requestFor(transaction).input('id',sqlTypes.Char(10),id).query('SELECT COUNT_BIG(*) AS total FROM dbo.DonMuaDV WITH (UPDLOCK,HOLDLOCK) WHERE maDichVu=@id')).recordset[0].total;
    if(Number(used)>0)throw new AppError(409,'SERVICE_IN_USE','Không thể xóa dịch vụ đã được khách hàng mua.');
    await requestFor(transaction).input('id',sqlTypes.Char(10),id).query('DELETE FROM dbo.CT_DichVu WHERE maDichVu=@id; DELETE FROM dbo.DichVu WHERE maDichVu=@id;');
    await insertAudit({transaction,user,action:'Xóa thông tin dịch vụ',entity:'DichVu',entityId:id,before,after:null});
    return {id:id.trim(),message:'Xóa dịch vụ thành công'};
  });
}
