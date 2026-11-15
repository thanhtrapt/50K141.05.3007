import fs from 'node:fs/promises';
import path from 'node:path';
import { createWriteStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import PDFDocument from 'pdfkit';
import sharp from 'sharp';
import { config } from './config.js';
import { getPool,sqlTypes } from './database.js';

function localImagePath(value) {
  if(!value)return null;
  let pathname=String(value);
  try { if(/^https?:\/\//i.test(pathname))pathname=new URL(pathname).pathname; } catch { return null; }
  const prefix=pathname.startsWith('/api/uploads/')?'/api/uploads/':pathname.startsWith('/uploads/')?'/uploads/':null;
  if(!prefix)return null;
  const relative=decodeURIComponent(pathname.slice(prefix.length));
  const root=path.resolve(config.uploadDir);const full=path.resolve(root,relative);
  return full.startsWith(`${root}${path.sep}`)?full:null;
}

async function imageBuffer(value) {
  const full=localImagePath(value);if(!full)return null;
  try {const input=await fs.readFile(full);return await sharp(input).rotate().png().toBuffer();} catch { return null; }
}

function ensureSpace(doc,height=70) {
  if(doc.y+height>doc.page.height-doc.page.margins.bottom)doc.addPage();
}

function text(doc,label,value,{bold=false}={}) {
  const v=value==null||value===''?'—':String(value);
  doc.font(bold?'Bold':'Regular').fontSize(10).text(`${label}: ${v}`,{width:500,lineGap:3});
}

export async function generateSummaryPdf({packageId,sessionId,milestone}) {
  const pool=getPool();
  const head=(await pool.request().input('id',sqlTypes.Char(10),packageId).query(`SELECT d.maDonMua AS packageId,d.ngayMua AS purchaseDate,d.giaMua AS purchasePrice,
    d.trangThaiThanhToan AS paymentStatus,d.trangThaiHoanThanh AS packageStatus,d.soBuoiDaThucHien AS sessionsCompleted,d.fileTongHop AS currentFile,
    k.maKhachHang AS customerId,k.hoTen AS customerName,k.soDienThoai AS phone,k.ngaySinh AS dateOfBirth,s.maDichVu AS serviceId,s.tenDV AS serviceName,s.tongSoBuoi AS totalSessions
    FROM dbo.DonMuaDV d JOIN dbo.KhachHang k ON k.maKhachHang=d.maKhachHang JOIN dbo.DichVu s ON s.maDichVu=d.maDichVu WHERE d.maDonMua=@id`)).recordset[0];
  if(!head)throw new Error('Không tìm thấy liệu trình để tạo PDF.');
  const sessions=(await pool.request().input('id',sqlTypes.Char(10),packageId).input('current',sqlTypes.Char(10),sessionId).query(`SELECT c.maCT_DonMua AS id,
    COALESCE(c.tenBuoiSnapshot,c.tenBuoi,t.tenBuoi) AS name,COALESCE(c.kyThuatSnapshot,t.kyThuat) AS technique,
    COALESCE(c.thoiGianThucHienSnapshot,t.thoiGianThucHien) AS durationMinutes,COALESCE(c.myPhamSDSnapshot,t.myPhamSD) AS cosmeticsUsage,
    c.ngayThucHien AS performedAt,c.ketQua AS result,c.trangThaiThucHien AS status,c.hinhAnh AS image,a.hoTen AS staffName
    FROM dbo.CT_DonMua c LEFT JOIN dbo.CT_DichVu t ON t.maCT_DichVu=c.maCT_DichVu LEFT JOIN dbo.TaiKhoan a ON a.maTK=c.maTK
    WHERE c.maDonMua=@id AND c.trangThaiThucHien=N'Đã hoàn thành' ORDER BY c.maCT_DonMua`)).recordset;
  if(!sessions.some(row=>row.id.trim()===sessionId.trim()))throw new Error('Buổi dịch vụ chưa hoàn thành hoặc không thuộc liệu trình.');
  await Promise.all([fs.access(config.pdfFontPath),fs.access(config.pdfBoldFontPath)]);
  const folder=path.join(config.uploadDir,'summaries');await fs.mkdir(folder,{recursive:true});
  const fileName=`${head.packageId.trim()}_${sessionId.trim()}_${milestone}.pdf`;
  const fullPath=path.join(folder,fileName);const publicPath=`/api/uploads/summaries/${fileName}`;
  const doc=new PDFDocument({size:'A4',margin:48,info:{Title:`Tổng hợp liệu trình ${head.serviceName}`,Author:'Hương Spa'}});
  doc.registerFont('Regular',config.pdfFontPath);doc.registerFont('Bold',config.pdfBoldFontPath);
  const writing=pipeline(doc,createWriteStream(fullPath));
  try {
    doc.font('Bold').fontSize(20).fillColor('#6f4d3f').text('HƯƠNG SPA',{align:'center'});
    doc.moveDown(0.35).fontSize(15).fillColor('#222').text('TỔNG HỢP QUÁ TRÌNH ĐIỀU TRỊ',{align:'center'});
    doc.moveDown(0.7).font('Bold').fontSize(12).fillColor('#6f4d3f').text('THÔNG TIN KHÁCH HÀNG');
    doc.moveDown(0.3).font('Regular').fillColor('#222');
    text(doc,'Họ và tên',head.customerName);text(doc,'Số điện thoại',head.phone);text(doc,'Mã khách hàng',head.customerId.trim());
    doc.moveDown(0.6).font('Bold').fillColor('#6f4d3f').text('THÔNG TIN LIỆU TRÌNH');
    doc.moveDown(0.3).font('Regular').fillColor('#222');
    text(doc,'Tên dịch vụ',head.serviceName);text(doc,'Mã liệu trình',head.packageId.trim());text(doc,'Ngày mua',new Date(head.purchaseDate).toLocaleDateString('vi-VN'));
    text(doc,'Giá dịch vụ',`${Number(head.purchasePrice).toLocaleString('vi-VN')} đ`);text(doc,'Thanh toán',head.paymentStatus);
    text(doc,'Tiến độ',`${Number(head.sessionsCompleted)}/${Number(head.totalSessions)} buổi — ${head.packageStatus}`);
    doc.moveDown(0.6).font('Bold').fillColor('#6f4d3f').text('CÁC BUỔI ĐÃ HOÀN THÀNH');
    for(let i=0;i<sessions.length;i++) {
      const item=sessions[i];ensureSpace(doc,115);
      doc.moveDown(0.45).font('Bold').fontSize(11).fillColor('#222').text(`Buổi ${i+1}: ${item.name||'—'}`);
      doc.moveDown(0.2).font('Regular').fontSize(10).fillColor('#222');
      text(doc,'Ngày thực hiện',item.performedAt?new Date(item.performedAt).toLocaleString('vi-VN'):'—');
      text(doc,'Nhân viên',item.staffName);text(doc,'Thời lượng',`${Number(item.durationMinutes||0)} phút`);
      text(doc,'Kỹ thuật',item.technique);text(doc,'Mỹ phẩm và định lượng',item.cosmeticsUsage);text(doc,'Kết quả điều trị',item.result);
      const image=await imageBuffer(item.image);
      if(image) {
        ensureSpace(doc,190);doc.moveDown(0.25).font('Bold').text('Ảnh tình trạng da');
        const y=doc.y+5;doc.image(image,doc.page.margins.left,y,{fit:[480,165],align:'left',valign:'center'});doc.y=y+170;
      } else if(item.image)text(doc,'Ảnh tình trạng da',`Không thể nhúng ảnh; xem tại ${item.image}`);
      doc.moveDown(0.5).strokeColor('#ddd').moveTo(doc.page.margins.left,doc.y).lineTo(doc.page.width-doc.page.margins.right,doc.y).stroke();
    }
    doc.moveDown(1).fontSize(9).fillColor('#777').text(`Tài liệu được tạo tự động ngày ${new Date().toLocaleString('vi-VN')}.`,{align:'center'});
    doc.end();await writing;
  } catch(error) {
    doc.destroy();await writing.catch(()=>{});await fs.rm(fullPath,{force:true}).catch(()=>{});throw error;
  }
  return {fileName,path:publicPath,absolutePath:fullPath,milestone:milestone==='final'?'Cuối liệu trình':'Giữa liệu trình'};
}
