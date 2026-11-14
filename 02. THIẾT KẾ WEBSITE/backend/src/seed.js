import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { connectDatabase, closeDatabase, inTransaction, getPool } from './database.js';
import { hashPassword } from './security.js';
import { nowIso } from './utils.js';
import { runMigrations } from './migrate.js';

const defaults = [
  ['MIN_STOCK_THRESHOLD','10','number','Ngưỡng tồn kho tối thiểu (chai/lọ)'],
  ['EXPIRY_WARNING_DAYS','60','number','Số ngày cảnh báo hạn sử dụng'],
  ['REMINDER_BEFORE_MINUTES','45','number','Số phút nhắc lịch trước giờ hẹn'],
  ['BLACKLIST_CANCEL_LIMIT','3','number','Số lần hủy lịch để đưa vào danh sách đen'],
  ['SPA_OPEN_TIME','08:00','time','Giờ mở cửa'],
  ['SPA_CLOSE_TIME','20:00','time','Giờ đóng cửa'],
  ['APPOINTMENT_SLOT_MINUTES','30','number','Độ chia khung giờ lịch hẹn'],
  ['SERVICE_BED_COUNT','3','number','Số giường dịch vụ'],
  ['SERVICE_PROVIDER_COUNT','1','number','Số kỹ thuật viên'],
];

export async function runSeed() {
  await runMigrations();
  await inTransaction(async (tx) => {
    const accounts = [
      { code:'TK00000001', name:process.env.SEED_OWNER_NAME || 'Lê Thị Thu Hương', phone:process.env.SEED_OWNER_PHONE || '0912345678', password:process.env.SEED_OWNER_PASSWORD || 'HuongSpaOwner2026!', role:'Chủ Spa' },
      { code:'TK00000002', name:process.env.SEED_STAFF_NAME || 'Nhân viên Hương Spa', phone:process.env.SEED_STAFF_PHONE || '0901234567', password:process.env.SEED_STAFF_PASSWORD || 'HuongSpaStaff2026!', role:'Nhân viên' },
    ];
    for (const account of accounts) {
      if (!/^0[0-9]{9}$/.test(account.phone)) throw new Error(`Số điện thoại seed không hợp lệ: ${account.phone}`);
      if (account.password.length < 8 || account.password.length > 20) throw new Error(`Mật khẩu seed cho ${account.role} phải dài 8–20 ký tự.`);
      const exists = await tx.request().input('phone', account.phone).query('SELECT maTK FROM dbo.TaiKhoan WHERE tenDangNhap=@phone');
      if (exists.recordset.length) continue;
      await tx.request().input('id', account.code).input('phone', account.phone).input('password', hashPassword(account.password))
        .input('role', account.role).input('name', account.name)
        .query(`INSERT INTO dbo.TaiKhoan(maTK,tenDangNhap,matKhau,vaiTro,trangThai,hoTen,ngayTao)
          VALUES(@id,@phone,@password,@role,1,@name,SYSDATETIME())`);
    }
    for (const [key,value,type,description] of defaults) {
      await tx.request().input('key',key).input('value',value).input('type',type).input('description',description)
        .query(`IF NOT EXISTS(SELECT 1 FROM dbo.CauHinhHeThong WHERE maCauHinh=@key)
          INSERT INTO dbo.CauHinhHeThong(maCauHinh,giaTri,kieuGiaTri,moTa) VALUES(@key,@value,@type,@description)`);
    }
    await tx.request().input('now',nowIso()).query(`
      IF NOT EXISTS(SELECT 1 FROM dbo.MyPham WHERE maMyPham='MP00000001')
        INSERT INTO dbo.MyPham(maMyPham,tenMyPham,hinhAnh,phanLoai,soLuongTonKho,donViTinh,giaBan,moTa,trangThai)
        VALUES('MP00000001',N'Serum phục hồi B5',NULL,N'Bán lẻ',0,N'Chai',450000,N'Mẫu dữ liệu khởi tạo',1);
      IF NOT EXISTS(SELECT 1 FROM dbo.MyPham WHERE maMyPham='MP00000002')
        INSERT INTO dbo.MyPham(maMyPham,tenMyPham,hinhAnh,phanLoai,soLuongTonKho,donViTinh,giaBan,moTa,trangThai)
        VALUES('MP00000002',N'Sữa rửa mặt dưỡng ẩm',NULL,N'Dùng cho liệu trình',0,N'Chai',250000,N'Mẫu dữ liệu khởi tạo',1);
    `);
  });
  process.stdout.write('Đã tạo tài khoản OWNER/STAFF, cấu hình và dữ liệu mỹ phẩm mẫu.\n');
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  runSeed().then(closeDatabase).catch(async (error) => {
    console.error('Không thể tạo seed:', error.message);
    await closeDatabase();
    process.exitCode = 1;
  });
}
