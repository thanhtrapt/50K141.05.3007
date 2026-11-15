import { getPool, inTransaction, requestFor, dbTypes } from './database.js';
import { AppError, badRequest, notFound, fieldValidation } from './errors.js';
import { insertAudit, nextCode, nextLotCode } from './repositories.js';
import { normalizeVietnamese, nowIso, paginate } from './utils.js';

const productTypeMap={'Bán lẻ':'Bán lẻ','Dùng cho liệu trình':'Dùng cho liệu trình'};
const asMoney=(value)=>Number.isSafeInteger(Number(value))&&Number(value)>=0?Number(value):null;
const asPositiveInt=(value)=>Number.isInteger(Number(value))&&Number(value)>0?Number(value):null;
const vnToday=()=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Ho_Chi_Minh'}).format(new Date());
const dateText=(value)=>value instanceof Date?new Intl.DateTimeFormat('sv-SE',{timeZone:'UTC'}).format(value):String(value).slice(0,10);
const msg=(message,errors=[])=>new AppError(400,'VALIDATION_ERROR',message,errors);

async function systemNumber(key,fallback) {
  // CauHinhHeThong không tồn tại trong schema thật; dùng ngưỡng mặc định.
  return Number(fallback);
}

async function audit(transaction,user,action,entity,id,before,after) {
  await insertAudit({transaction,user,action,entity,entityId:id,before,after});
}

// Bảng CanhBao không tồn tại trong schema thật. Cảnh báo tồn kho/hạn dùng được
// tính trực tiếp trong listAlerts, nên các hàm cập nhật chỉ là no-op.
export async function updateStockAlerts() {
  return;
}

async function updateExpiryAlert() {
  return;
}

export async function refreshExpiryAlerts() {
  return 0;
}

async function allProducts() {
  const result=await getPool().request().query(`SELECT p.maMyPham AS id,p.tenMyPham AS name,p.hinhAnh AS image,p.phanLoai AS category,
    p.donViTinh AS unit,p.giaBan AS salePrice,p.moTa AS description,p.soLuongTonKho AS stock,TRUE AS isActive,
    COALESCE((SELECT SUM(l.soLuongTonLo) FROM dbo.LoHang l WHERE l.maMyPham=p.maMyPham),0) AS batchStock
    FROM dbo.MyPham p ORDER BY p.tenMyPham`);
  return result.recordset.map(row=>({ ...row,id:row.id.trim(),salePrice:Number(row.salePrice),stock:Number(row.stock),batchStock:Number(row.batchStock),isActive:Boolean(row.isActive) }));
}

export async function listCosmetics(query) {
  let rows=await allProducts();
  const keyword=normalizeVietnamese(query.keyword||'');
  if(keyword) rows=rows.filter(row=>normalizeVietnamese([row.id,row.name,row.category,row.unit].join(' ')).includes(keyword));
  return paginate(rows,query.page,query.limit);
}

export async function getCosmetic(id) {
  const product=await allProducts().then(rows=>rows.find(row=>row.id===id));
  if(!product) throw notFound('Không tìm thấy mỹ phẩm phù hợp!');
  const result=await getPool().request().input('id',dbTypes.Char(10),id).query(`SELECT maLo AS id,ngaySanXuat AS productionDate,hanSuDung AS expiryDate,soLuongTonLo AS stock,NULL AS receivedDate
    FROM dbo.LoHang WHERE maMyPham=@id ORDER BY hanSuDung,maLo`);
  return {...product,batches:result.recordset.map(row=>({...row,id:row.id.trim(),stock:Number(row.stock)}))};
}

export function validateProduct(data,{partial=false}={}) {
  const errors=[];
  const values={};
  const fields=[['name','tenMyPham','Tên sản phẩm'],['category','phanLoai','Phân loại'],['unit','donViTinh','Đơn vị tính']];
  for(const [key,column,label] of fields) {
    if(partial&&data[key]===undefined) continue;
    const value=String(data[key]??'').trim();
    if(!value) errors.push({field:key,message:`${label} không được bỏ trống`});
    values[column]=value;
  }
  if(!partial||data.salePrice!==undefined) {
    const price=asMoney(data.salePrice);
    if(price===null) errors.push({field:'salePrice',message:'Giá bán không được là số âm'});
    else values.giaBan=price;
  }
  if(!partial||data.description!==undefined) values.moTa=data.description==null?'':String(data.description).trim();
  if(!partial||data.image!==undefined) values.hinhAnh=data.image?String(data.image).trim():null;
  if((values.phanLoai&&!productTypeMap[values.phanLoai])) errors.push({field:'category',message:'Phân loại không hợp lệ'});
  fieldValidation(errors,'Thông tin chưa hợp lệ, yêu cầu nhập lại');
  return values;
}

async function productNameExists(name,excludeId) {
  const products=await allProducts();
  const key=normalizeVietnamese(name);
  return products.some(p=>p.id!==excludeId&&normalizeVietnamese(p.name)===key);
}

export async function createCosmetic(body,user) {
  const values=validateProduct(body);
  if(await productNameExists(values.tenMyPham)) throw msg('Thông tin chưa hợp lệ, yêu cầu nhập lại',[{field:'name',message:'Tên sản phẩm đã tồn tại'}]);
  return inTransaction(async(transaction)=>{
    const id=await nextCode('MP',transaction);
    const r=requestFor(transaction).input('id',dbTypes.Char(10),id).input('name',dbTypes.NVarChar(100),values.tenMyPham)
      .input('image',dbTypes.VarChar(255),values.hinhAnh).input('category',dbTypes.NVarChar(30),values.phanLoai)
      .input('unit',dbTypes.NVarChar(20),values.donViTinh).input('price',dbTypes.Money,values.giaBan)
      .input('description',dbTypes.NVarChar(200),values.moTa);
    await r.query(`INSERT INTO dbo.MyPham(maMyPham,tenMyPham,hinhAnh,phanLoai,soLuongTonKho,donViTinh,giaBan,moTa)
      VALUES(@id,@name,@image,@category,0,@unit,@price,@description)`);
    const after={maMyPham:id,...values,soLuongTonKho:0,trangThai:true};
    await audit(transaction,user,'Tạo mỹ phẩm','MyPham',id,null,after);
    return {id:id.trim(),name:values.tenMyPham,category:values.phanLoai,unit:values.donViTinh,salePrice:values.giaBan,
      description:values.moTa,image:values.hinhAnh,stock:0,isActive:true};
  });
}

export async function updateCosmetic(id,body,user) {
  const before=await getCosmetic(id);
  const values=validateProduct(body,{partial:true});
  if(values.tenMyPham&&await productNameExists(values.tenMyPham,id)) throw msg('Thông tin chưa hợp lệ, yêu cầu nhập lại',[{field:'name',message:'Tên sản phẩm đã tồn tại'}]);
  return inTransaction(async(transaction)=>{
    const assignments=[]; const r=requestFor(transaction).input('id',dbTypes.Char(10),id);
    const bind={tenMyPham:['name',dbTypes.NVarChar(100)],phanLoai:['category',dbTypes.NVarChar(30)],donViTinh:['unit',dbTypes.NVarChar(20)],giaBan:['price',dbTypes.Money],moTa:['description',dbTypes.NVarChar(200)],hinhAnh:['image',dbTypes.VarChar(255)]};
    for(const [column,[param,type]] of Object.entries(bind)) if(values[column]!==undefined){assignments.push(`${column}=@${param}`);r.input(param,type,values[column]);}
    if(assignments.length) await r.query(`UPDATE dbo.MyPham SET ${assignments.join(',')} WHERE maMyPham=@id`);
    const after={...before,
      name:values.tenMyPham??before.name,
      category:values.phanLoai??before.category,
      unit:values.donViTinh??before.unit,
      salePrice:values.giaBan??before.salePrice,
      description:values.moTa??before.description,
      image:values.hinhAnh??before.image,
    };
    await audit(transaction,user,'Cập nhật mỹ phẩm','MyPham',id,before,after);
    return after;
  });
}

export async function deleteCosmetic(id,user) {
  const before=await getCosmetic(id);
  if(before.stock!==0||before.batches.some(b=>b.stock!==0)) throw new AppError(409,'COSMETIC_HAS_STOCK','Không thể xóa mỹ phẩm còn tồn kho.');
  return inTransaction(async(transaction)=>{
    // MyPham không có cột trangThai để ngừng sử dụng, nên chỉ xóa cứng khi sản
    // phẩm chưa phát sinh lô/giao dịch nào.
    const usage=await requestFor(transaction).input('id',dbTypes.Char(10),id).query(`SELECT
      (SELECT COUNT(*) FROM dbo.LoHang WHERE maMyPham=@id) AS lotCount,
      (SELECT COUNT(*) FROM dbo.CT_PhieuNhapKho l JOIN dbo.LoHang b ON b.maLo=l.maLo WHERE b.maMyPham=@id) AS receiptCount,
      (SELECT COUNT(*) FROM dbo.CT_PhieuXuatKho l JOIN dbo.LoHang b ON b.maLo=l.maLo WHERE b.maMyPham=@id) AS issueCount,
      (SELECT COUNT(*) FROM dbo.CT_DonGhiNhanBan l JOIN dbo.LoHang b ON b.maLo=l.maLo WHERE b.maMyPham=@id) AS saleCount`);
    const row=usage.recordset[0];
    // COUNT(*) trả về bigint → pg trả dạng chuỗi; phải ép số trước khi so sánh.
    if(Number(row.lotCount)||Number(row.receiptCount)||Number(row.issueCount)||Number(row.saleCount)) throw new AppError(409,'COSMETIC_HAS_HISTORY','Không thể xóa mỹ phẩm đã phát sinh lô hoặc giao dịch kho.');
    await requestFor(transaction).input('id',dbTypes.Char(10),id).query('DELETE FROM dbo.MyPham WHERE maMyPham=@id');
    await audit(transaction,user,'Xóa mỹ phẩm','MyPham',id,before,{...before,isActive:false});
    return {id:id.trim(),message:'Xóa thông tin mỹ phẩm thành công'};
  });
}

export async function listLots(query) {
  const productId=query.maMyPham || query.cosmeticId;
  const r=getPool().request();
  if(productId) r.input('product',dbTypes.Char(10),productId);
  const result=await r.query(`SELECT l.maLo AS id,l.maMyPham AS cosmeticId,p.tenMyPham AS cosmeticName,l.ngaySanXuat AS productionDate,
    l.hanSuDung AS expiryDate,NULL AS receivedDate,l.soLuongTonLo AS stock
    FROM dbo.LoHang l JOIN dbo.MyPham p ON p.maMyPham=l.maMyPham
    ${productId?'WHERE l.maMyPham=@product':''} ORDER BY l.hanSuDung ASC,l.maLo ASC`);
  return result.recordset.map(row=>({...row,id:row.id.trim(),cosmeticId:row.cosmeticId.trim(),stock:Number(row.stock)}));
}

export async function createReceipt(body,user) {
  const errors=[];const date=String(body.receiptDate||body.ngayNhap||'');
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date)) errors.push({field:'receiptDate',message:'Ngày nhập không hợp lệ'});
  const paymentStatus=body.paymentStatus||body.trangThaiThanhToan;
  if(!['Đã thanh toán','Chưa thanh toán'].includes(paymentStatus)) errors.push({field:'paymentStatus',message:'Trạng thái thanh toán không hợp lệ'});
  if(!Array.isArray(body.items)||body.items.length===0) errors.push({field:'items',message:'Phiếu nhập phải có ít nhất một dòng'});
  const prepared=[];const seen=new Set();
  for(const [index,item] of (body.items||[]).entries()) {
    const price=asMoney(item.purchasePrice??item.giaNhap),quantity=asPositiveInt(item.quantity??item.soLuong);
    if(price===null) errors.push({field:`items.${index}.purchasePrice`,message:'Giá nhập không hợp lệ'});
    if(quantity===null) errors.push({field:`items.${index}.quantity`,message:'Số lượng không hợp lệ!'});
    const lot=item.lot||item.lotInfo||{};
    if(!item.batchId&&!item.maLo&&(!/^\d{4}-\d{2}-\d{2}$/.test(lot.productionDate||lot.ngaySanXuat||'')||!/^\d{4}-\d{2}-\d{2}$/.test(lot.expiryDate||lot.hanSuDung||''))) errors.push({field:`items.${index}.lot`,message:'Thông tin lô chưa hoàn tất'});
    if((lot.expiryDate||lot.hanSuDung)<=(lot.productionDate||lot.ngaySanXuat)) errors.push({field:`items.${index}.expiryDate`,message:'Hạn sử dụng phải sau ngày sản xuất!'});
    const dedupe=`${item.cosmeticId||item.maMyPham||item.newProduct?.name}|${item.batchId||item.maLo||`${lot.productionDate}${lot.expiryDate}`}`;
    if(seen.has(dedupe)) errors.push({field:`items.${index}.batchId`,message:'Mỗi dòng nhập phải ứng với một lô riêng'});seen.add(dedupe);
    prepared.push({item,price,quantity,lot});
  }
  fieldValidation(errors,'Chưa hoàn tất thông tin, yêu cầu nhập lại');
  return inTransaction(async(transaction)=>{
    const receiptId=await nextCode('PN',transaction);
    const r=requestFor(transaction).input('id',dbTypes.Char(10),receiptId).input('creatorId',dbTypes.Char(10),user.id)
      .input('creator',dbTypes.NVarChar(50),user.full_name||user.name||user.id||'Hệ thống').input('date',dbTypes.Date,date)
      .input('payment',dbTypes.NVarChar(20),paymentStatus).input('total',dbTypes.Money,0);
    await r.query('INSERT INTO dbo.PhieuNhapKho(maPhieuNhap,ngayNhap,nguoiTao,trangThaiThanhToan,tongTien,maTK) VALUES(@id,@date,@creator,@payment,@total,@creatorId)');
    for(const {item,price,quantity,lot} of prepared) {
      let productId=item.cosmeticId||item.maMyPham;
      if(item.newProduct) {
        const newItem=item.newProduct;const type=newItem.category||newItem.phanLoai;
        if(!newItem.name||!newItem.unit||!productTypeMap[type]) throw msg('Chưa hoàn tất thông tin, yêu cầu nhập lại',[{field:'newProduct',message:'Tên, đơn vị tính và phân loại sản phẩm là bắt buộc'}]);
        const salePrice=asMoney(newItem.salePrice);
        if(salePrice===null) throw msg('Chưa hoàn tất thông tin, yêu cầu nhập lại',[{field:'newProduct.salePrice',message:'Giá bán không được là số âm'}]);
        const dup=await requestFor(transaction).input('name',dbTypes.NVarChar(100),newItem.name.trim()).query('SELECT maMyPham FROM dbo.MyPham WITH (UPDLOCK,HOLDLOCK) WHERE tenMyPham=@name');
        if(dup.recordset.length) throw msg('Thông tin chưa hợp lệ, yêu cầu nhập lại',[{field:'newProduct.name',message:'Tên sản phẩm đã tồn tại'}]);
        productId=await nextCode('MP',transaction);
        await requestFor(transaction).input('id',dbTypes.Char(10),productId).input('name',dbTypes.NVarChar(100),newItem.name.trim())
          .input('type',dbTypes.NVarChar(30),type).input('unit',dbTypes.NVarChar(20),newItem.unit.trim())
          .input('price',dbTypes.Money,salePrice).input('description',dbTypes.NVarChar(200),newItem.description||'')
          .query('INSERT INTO dbo.MyPham(maMyPham,tenMyPham,phanLoai,soLuongTonKho,donViTinh,giaBan,moTa) VALUES(@id,@name,@type,0,@unit,@price,@description)');
        await audit(transaction,user,'Tạo nhanh mỹ phẩm','MyPham',productId,null,{...newItem,maMyPham:productId,soLuongTonKho:0});
      }
      const product=(await requestFor(transaction).input('id',dbTypes.Char(10),productId).query('SELECT TOP(1) * FROM dbo.MyPham WITH (UPDLOCK,HOLDLOCK) WHERE maMyPham=@id')).recordset[0];
      if(!product) throw notFound('Không tìm thấy mỹ phẩm phù hợp!');
      let lotId=item.batchId||item.maLo;
      if(lotId) {
        const lotRow=(await requestFor(transaction).input('lot',dbTypes.Char(10),lotId).input('product',dbTypes.Char(10),productId)
          .query('SELECT hanSuDung AS "hanSuDung" FROM dbo.LoHang WITH (UPDLOCK,HOLDLOCK) WHERE maLo=@lot AND maMyPham=@product')).recordset[0];
        if(!lotRow) throw notFound('Không tìm thấy lô hàng phù hợp.');
      } else {
        lotId=await nextLotCode(date,transaction);
        await requestFor(transaction).input('lot',dbTypes.Char(10),lotId).input('product',dbTypes.Char(10),productId)
          .input('production',dbTypes.Date,lot.productionDate||lot.ngaySanXuat).input('expiry',dbTypes.Date,lot.expiryDate||lot.hanSuDung)
          .query('INSERT INTO dbo.LoHang(maLo,soLuongTonLo,ngaySanXuat,hanSuDung,maMyPham) VALUES(@lot,0,@production,@expiry,@product)');
      }
      await requestFor(transaction).input('line',dbTypes.Char(10),await nextCode('CI',transaction)).input('receipt',dbTypes.Char(10),receiptId)
        .input('lot',dbTypes.Char(10),lotId).input('quantity',dbTypes.Int,quantity).input('price',dbTypes.Money,price).input('amount',dbTypes.Money,0)
        .query('INSERT INTO dbo.CT_PhieuNhapKho(maCT_PhieuNhap,soLuong,giaNhap,thanhTien,maPhieuNhap,maLo) VALUES(@line,@quantity,@price,@amount,@receipt,@lot)');
    }
    const total=Number((await requestFor(transaction).input('id',dbTypes.Char(10),receiptId)
      .query('SELECT tongTien AS total FROM dbo.PhieuNhapKho WHERE maPhieuNhap=@id')).recordset[0]?.total)||0;
    await audit(transaction,user,'Tạo phiếu nhập kho','PhieuNhapKho',receiptId,null,{maPhieuNhap:receiptId,ngayNhap:date,trangThaiThanhToan:paymentStatus,tongTien:total,maTK:user.id,items:prepared});
    return {id:receiptId.trim(),receiptDate:date,total,message:'Tạo phiếu nhập thành công'};
  });
}

export async function listReceipts(query) {
  let result=await getPool().request().query(`SELECT maPhieuNhap AS id,ngayNhap AS receiptDate,nguoiTao AS creator,trangThaiThanhToan AS paymentStatus,tongTien AS total
    FROM dbo.PhieuNhapKho ORDER BY ngayNhap DESC,maPhieuNhap DESC`);
  let rows=result.recordset.map(row=>({...row,id:row.id.trim(),total:Number(row.total)}));
  const keyword=normalizeVietnamese(query.keyword||'');
  if(keyword) rows=rows.filter(row=>normalizeVietnamese(`${row.id} ${row.creator}`).includes(keyword));
  return paginate(rows,query.page,query.limit);
}

export async function getReceipt(id) {
  const head=(await getPool().request().input('id',dbTypes.Char(10),id).query(`SELECT maPhieuNhap AS id,ngayNhap AS receiptDate,nguoiTao AS creator,
    trangThaiThanhToan AS paymentStatus,tongTien AS total FROM dbo.PhieuNhapKho WHERE maPhieuNhap=@id`)).recordset[0];
  if(!head) throw notFound('Không tồn tại phiếu nhập kho!');
  const lines=(await getPool().request().input('id',dbTypes.Char(10),id).query(`SELECT c.maMyPham AS cosmeticId,c.tenMyPham AS cosmeticName,c.donViTinh AS unit,
    l.giaNhap AS purchasePrice,l.soLuong AS quantity,b.maLo AS lotCode,b.ngaySanXuat AS productionDate,b.hanSuDung AS expiryDate,l.thanhTien AS lineTotal
    FROM dbo.CT_PhieuNhapKho l JOIN dbo.LoHang b ON b.maLo=l.maLo JOIN dbo.MyPham c ON c.maMyPham=b.maMyPham WHERE l.maPhieuNhap=@id ORDER BY l.maCT_PhieuNhap`)).recordset;
  return {...head,id:head.id.trim(),total:Number(head.total),items:lines.map(row=>({...row,cosmeticId:row.cosmeticId.trim(),lotCode:row.lotCode.trim(),purchasePrice:Number(row.purchasePrice),lineTotal:Number(row.lineTotal)}))};
}

export async function createIssue(body,user) {
  const date=String(body.issueDate||body.ngayXuat||'');
  const items=body.items;
  const errors=[];
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date)) errors.push({field:'issueDate',message:'Ngày xuất không hợp lệ'});
  if(date>vnToday()) errors.push({field:'issueDate',message:'Ngày xuất không được sau ngày hiện tại'});
  if(!Array.isArray(items)||items.length===0) errors.push({field:'items',message:'Phiếu xuất chưa có dòng sản phẩm'});
  const seen=new Set();
  for(const [i,line] of (items||[]).entries()) {
    const batch=line.batchId||line.maLo; const quantity=asPositiveInt(line.quantity??line.soLuong);
    if(!line.cosmeticId&&!line.maMyPham) errors.push({field:`items.${i}.cosmeticId`,message:'Vui lòng chọn sản phẩm'});
    if(!batch) errors.push({field:`items.${i}.batchId`,message:'Vui lòng chọn lô hàng'});
    if(quantity===null) errors.push({field:`items.${i}.quantity`,message:'Số lượng không hợp lệ!'});
    if(batch&&seen.has(batch)) errors.push({field:`items.${i}.batchId`,message:'Lô đã có trong phiếu xuất'});
    if(batch) seen.add(batch);
  }
  fieldValidation(errors,'Chưa hoàn tất thông tin, yêu cầu nhập lại');
  return inTransaction(async(transaction)=>{
    const issueId=await nextCode('PX',transaction);
    await requestFor(transaction).input('id',dbTypes.Char(10),issueId).input('creatorId',dbTypes.Char(10),user.id)
      .input('creator',dbTypes.NVarChar(50),user.full_name||user.name||user.id||'Hệ thống').input('date',dbTypes.Date,date).input('note',dbTypes.NVarChar(200),body.reason||body.ghiChu||'')
      .query('INSERT INTO dbo.PhieuXuatKho(maPhieuXuat,ngayXuat,nguoiTao,ghiChu,maTK) VALUES(@id,@date,@creator,@note,@creatorId)');
    for(const [i,line] of items.entries()) {
      const productId=line.cosmeticId||line.maMyPham; const batchId=line.batchId||line.maLo; const quantity=Number(line.quantity??line.soLuong);
      const row=(await requestFor(transaction).input('lot',dbTypes.Char(10),batchId).input('product',dbTypes.Char(10),productId)
        .query(`SELECT b.maLo AS "maLo",b.maMyPham AS "maMyPham",b.hanSuDung AS "hanSuDung",b.soLuongTonLo AS "soLuongTonLo",
          p.phanLoai AS "phanLoai",p.soLuongTonKho AS "soLuongTonKho",p.tenMyPham AS "tenMyPham"
          FROM dbo.LoHang b WITH (UPDLOCK,HOLDLOCK) JOIN dbo.MyPham p WITH (UPDLOCK,HOLDLOCK) ON p.maMyPham=b.maMyPham
          WHERE b.maLo=@lot AND b.maMyPham=@product`)).recordset[0];
      if(!row) throw notFound('Không tìm thấy lô hàng phù hợp.');
      if(row.phanLoai!=='Dùng cho liệu trình') throw msg('Phiếu xuất kho chỉ áp dụng cho mỹ phẩm dùng cho liệu trình.',[{field:`items.${i}.cosmeticId`,message:'Sản phẩm không thuộc loại dùng cho liệu trình'}]);
      if(dateText(row.hanSuDung)<=vnToday()) throw msg('Lô đã hết hạn sử dụng, không thể xuất dùng!',[{field:`items.${i}.batchId`,message:'Lô đã hết hạn sử dụng, không thể xuất dùng!'}]);
      if(Number(row.soLuongTonLo)===0) throw msg('Sản phẩm đã hết hàng!',[{field:`items.${i}.batchId`,message:'Sản phẩm đã hết hàng!'}]);
      if(quantity>Number(row.soLuongTonLo)) throw msg('Số lượng xuất vượt quá số lượng tồn của lô!',[{field:`items.${i}.quantity`,message:'Số lượng xuất vượt quá số lượng tồn của lô!'}]);
      await requestFor(transaction).input('line',dbTypes.Char(10),await nextCode('CX',transaction)).input('issue',dbTypes.Char(10),issueId)
        .input('lot',dbTypes.Char(10),batchId).input('quantity',dbTypes.Int,quantity)
        .query('INSERT INTO dbo.CT_PhieuXuatKho(maCT_PhieuXuat,soLuong,maPhieuXuat,maLo) VALUES(@line,@quantity,@issue,@lot)');
    }
    await audit(transaction,user,'Tạo phiếu xuất kho','PhieuXuatKho',issueId,null,{maPhieuXuat:issueId,ngayXuat:date,ghiChu:body.reason||body.ghiChu||'',items});
    return {id:issueId.trim(),issueDate:date,message:'Tạo phiếu xuất thành công'};
  });
}

export async function listIssues(query) {
  const result=await getPool().request().query(`SELECT maPhieuXuat AS id,ngayXuat AS issueDate,nguoiTao AS creator,ghiChu AS reason
    FROM dbo.PhieuXuatKho ORDER BY ngayXuat DESC,maPhieuXuat DESC`);
  let rows=result.recordset.map(row=>({...row,id:row.id.trim()}));
  const keyword=normalizeVietnamese(query.keyword||'');
  if(keyword) rows=rows.filter(row=>normalizeVietnamese(`${row.id} ${row.creator} ${row.reason||''}`).includes(keyword));
  return paginate(rows,query.page,query.limit);
}

export async function getIssue(id) {
  const head=(await getPool().request().input('id',dbTypes.Char(10),id).query('SELECT maPhieuXuat AS id,ngayXuat AS issueDate,nguoiTao AS creator,ghiChu AS reason FROM dbo.PhieuXuatKho WHERE maPhieuXuat=@id')).recordset[0];
  if(!head) throw notFound('Không tồn tại phiếu xuất kho!');
  const lines=(await getPool().request().input('id',dbTypes.Char(10),id).query(`SELECT c.maMyPham AS cosmeticId,c.tenMyPham AS cosmeticName,c.donViTinh AS unit,
    b.maLo AS lotCode,b.hanSuDung AS expiryDate,l.soLuong AS quantity FROM dbo.CT_PhieuXuatKho l
    JOIN dbo.LoHang b ON b.maLo=l.maLo JOIN dbo.MyPham c ON c.maMyPham=b.maMyPham WHERE l.maPhieuXuat=@id ORDER BY l.maCT_PhieuXuat`)).recordset;
  return {...head,id:head.id.trim(),items:lines.map(row=>({...row,cosmeticId:row.cosmeticId.trim(),lotCode:row.lotCode.trim(),quantity:Number(row.quantity)}))};
}

export async function listAlerts(query) {
  // CanhBao không có trong schema thật, nên cảnh báo được suy ra trực tiếp:
  // tồn kho <= 10 và lô còn hàng có hạn sử dụng trong vòng 60 ngày.
  const lowRows=(await getPool().request().query(`SELECT 'LOW_STOCK' AS type,p.maMyPham AS cosmeticId,p.tenMyPham AS cosmeticName,p.phanLoai AS category,
      p.soLuongTonKho AS stock,NULL AS batchId,NULL AS expiryDate,
      CASE WHEN p.soLuongTonKho=0 THEN 'Hết hàng' ELSE 'Sắp hết hàng' END AS status,CURRENT_TIMESTAMP AS triggeredAt
    FROM dbo.MyPham p WHERE p.soLuongTonKho<=10 ORDER BY p.soLuongTonKho,p.tenMyPham`)).recordset;
  const expiryRows=(await getPool().request().query(`SELECT 'EXPIRY' AS type,p.maMyPham AS cosmeticId,p.tenMyPham AS cosmeticName,p.phanLoai AS category,
      p.soLuongTonKho AS stock,l.maLo AS batchId,l.hanSuDung AS expiryDate,
      CASE WHEN l.hanSuDung<=CURRENT_DATE THEN 'Hết hạn' ELSE 'Sắp hết hạn' END AS status,CURRENT_TIMESTAMP AS triggeredAt
    FROM dbo.LoHang l JOIN dbo.MyPham p ON p.maMyPham=l.maMyPham
    WHERE l.soLuongTonLo>0 AND l.hanSuDung<=CURRENT_DATE + 60 ORDER BY l.hanSuDung,l.maLo`)).recordset;
  const rows=[...lowRows,...expiryRows].map(row=>({...row,cosmeticId:row.cosmeticId?.trim()||null,batchId:row.batchId?.trim()||null,stock:Number(row.stock)}));
  const low=rows.filter(row=>row.type==='LOW_STOCK'); const expiry=rows.filter(row=>row.type==='EXPIRY');
  const type=query.type;
  const filtered=type==='LOW_STOCK'?low:type==='EXPIRY'?expiry:rows;
  const data=paginate(filtered,query.page,query.limit);
  return {...data,message:low.length?'Cảnh báo có mỹ phẩm đã chạm ngưỡng tối thiểu!':expiry.length?'Cảnh báo có mỹ phẩm sắp hết hạn sử dụng!':null,
    summary:{lowStock:{soon:low.filter(x=>x.status==='Sắp hết hàng').length,out:low.filter(x=>x.status==='Hết hàng').length},expiry:{soon:expiry.filter(x=>x.status==='Sắp hết hạn').length,expired:expiry.filter(x=>x.status==='Hết hạn').length}}};
}

export async function updateConfiguration(key,value,user) {
  const allowed=new Set(['MIN_STOCK_THRESHOLD','EXPIRY_WARNING_DAYS','REMINDER_BEFORE_MINUTES','BLACKLIST_CANCEL_LIMIT','SPA_OPEN_TIME','SPA_CLOSE_TIME','APPOINTMENT_SLOT_MINUTES','SERVICE_BED_COUNT','SERVICE_PROVIDER_COUNT']);
  if(!allowed.has(key)) throw notFound('Không tìm thấy cấu hình hệ thống phù hợp.');
  // Không có bảng CauHinhHeThong trong schema thật nên không thể lưu cấu hình.
  throw new AppError(503,'CONFIGURATION_UNAVAILABLE','Cấu hình hệ thống chưa khả dụng trên cơ sở dữ liệu hiện tại.');
}
