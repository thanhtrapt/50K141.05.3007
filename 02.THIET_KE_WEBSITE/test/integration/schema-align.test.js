import test from 'node:test';
import assert from 'node:assert/strict';
import { config } from '../../api/_lib/config.js';
import { closeDatabase, connectDatabase, getPool } from '../../api/_lib/database.js';
import {
  createCustomer, updateCustomer, getCustomer, listCustomers, deleteCustomer,
  assignServicePackage, getServicePackage, startPackageSession, completePackageSession,
  confirmPackageSession, createReview, getReview, listReviews, createRetailSale,
} from '../../api/_lib/customerService.js';
import { createService, getService, updateService, listServices, deleteService } from '../../api/_lib/serviceService.js';
import {
  createCosmetic, getCosmetic, listCosmetics, updateCosmetic, deleteCosmetic,
  createReceipt, getReceipt, listReceipts, listLots, createIssue, getIssue, listIssues,
  listAlerts, updateStockAlerts, refreshExpiryAlerts, updateConfiguration,
} from '../../api/_lib/stockService.js';
import {
  createAppointment, getAppointment, listAppointments, updateAppointment,
  cancelAppointment, listCancellations, getAvailability,
} from '../../api/_lib/appointmentService.js';

const TABLES = ['ct_dichvu', 'ct_donghinhanban', 'ct_donmua', 'ct_phieunhapkho', 'ct_phieuxuatkho', 'danhgia', 'dichvu',
  'donghinhanban', 'donmuadv', 'khachhang', 'lichhen', 'lohang', 'mypham', 'phieunhapkho', 'phieuxuatkho'];

const CODE = /^[A-Z0-9]{10}$/;

const user = { id: 'TK00000001', role: 'OWNER', full_name: 'Chủ Spa' };

function nextDate(days = 1) {
  const now = new Date();
  now.setUTCDate(now.getUTCDate() + days);
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Ho_Chi_Minh' }).format(now);
}

async function tableCounts() {
  const counts = {};
  for (const table of TABLES) {
    const result = await getPool().request().query(`SELECT COUNT(*) AS n FROM public.${table}`);
    counts[table] = Number(result.recordset[0].n);
  }
  return counts;
}

async function trackedCounts() {
  const result = await getPool().request().query(
    `SELECT 'khachhang' AS t, makhachhang AS id FROM public.khachhang
     UNION ALL SELECT 'dichvu', madichvu FROM public.dichvu
     UNION ALL SELECT 'mypham', mamypham FROM public.mypham
     UNION ALL SELECT 'lohang', malo FROM public.lohang
     UNION ALL SELECT 'donmuadv', madonmua FROM public.donmuadv
     UNION ALL SELECT 'lichhen', malichhen FROM public.lichhen
     UNION ALL SELECT 'phieunhapkho', maphieunhap FROM public.phieunhapkho
     UNION ALL SELECT 'phieuxuatkho', maphieuxuat FROM public.phieuxuatkho
     UNION ALL SELECT 'danhgia', madanhgia FROM public.danhgia`);
  return result.recordset.map((row) => `${row.t}:${String(row.id).trim()}`);
}

// Test này chạm cơ sở dữ liệu thật và tự dọn dẹp. Chỉ chạy khi có DATABASE_URL.
test('schema thật: tạo/sửa/xóa/tìm kiếm và mã 10 ký tự cho mọi nghiệp vụ', {
  skip: !config.databaseUrl ? 'Set DATABASE_URL locally to run the live schema alignment test.' : false,
  timeout: 180_000,
}, async () => {
  await connectDatabase();
  const trackedIds = {
    customers: [], services: [], products: [], packages: [], appointments: [],
    reviews: [], receipts: [], issues: [], sales: [],
  };
  const stamp = String(Date.now()).slice(-8);
  const phone = (suffix) => `09${stamp.slice(-6)}${String(suffix).padStart(2, '0')}`;

  const before = await tableCounts();
  const beforeIds = new Set(await trackedCounts());

  const cleanup = async () => {
    const run = async (sql, values = {}) => {
      const request = getPool().request();
      for (const [key, value] of Object.entries(values)) request.input(key, value);
      await request.query(sql).catch(() => {});
    };
    for (const id of trackedIds.reviews) await run('DELETE FROM public.danhgia WHERE madanhgia=@id', { id });
    for (const id of trackedIds.appointments) await run('DELETE FROM public.lichhen WHERE malichhen=@id', { id });
    for (const id of trackedIds.sales) {
      await run('DELETE FROM public.ct_donghinhanban WHERE madon=@id', { id });
      await run('DELETE FROM public.donghinhanban WHERE madon=@id', { id });
    }
    for (const id of trackedIds.issues) {
      await run('DELETE FROM public.ct_phieuxuatkho WHERE maphieuxuat=@id', { id });
      await run('DELETE FROM public.phieuxuatkho WHERE maphieuxuat=@id', { id });
    }
    for (const id of trackedIds.receipts) {
      await run('DELETE FROM public.ct_phieunhapkho WHERE maphieunhap=@id', { id });
      await run('DELETE FROM public.phieunhapkho WHERE maphieunhap=@id', { id });
    }
    for (const id of trackedIds.packages) {
      await run('DELETE FROM public.ct_donmua WHERE madonmua=@id', { id });
      await run('DELETE FROM public.donmuadv WHERE madonmua=@id', { id });
    }
    for (const id of trackedIds.services) {
      await run('DELETE FROM public.ct_dichvu WHERE madichvu=@id', { id });
      await run('DELETE FROM public.dichvu WHERE madichvu=@id', { id });
    }
    for (const id of trackedIds.reviews) await run('DELETE FROM public.danhgia WHERE madanhgia=@id', { id });
    for (const id of trackedIds.products) await run('DELETE FROM public.lohang WHERE mamypham=@id', { id });
    for (const id of trackedIds.products) await run('DELETE FROM public.mypham WHERE mamypham=@id', { id });
    for (const id of trackedIds.customers) await run('DELETE FROM public.khachhang WHERE makhachhang=@id', { id });
  };

  try {
    // 1. Tạo mới và kiểm tra mã tự sinh đúng 10 ký tự.
    const customer = await createCustomer({ name: `Khách tích hợp ${stamp}`, dateOfBirth: '1990-01-01', phone: phone(1) }, user);
    trackedIds.customers.push(customer.id);
    assert.match(customer.id, CODE);
    assert.equal(customer.name, `Khách tích hợp ${stamp}`);
    assert.equal(customer.phone, phone(1));

    const service = await createService({
      name: `Dịch vụ tích hợp ${stamp}`, price: 250000,
      sessions: [
        { name: 'Buổi 1', technique: 'Kỹ thuật 1', cosmeticsUsage: 'Serum 2ml', durationMinutes: 30 },
        { name: 'Buổi 2', technique: 'Kỹ thuật 2', cosmeticsUsage: 'Serum 3ml', durationMinutes: 30 },
      ],
    }, user);
    trackedIds.services.push(service.id);
    assert.match(service.id, CODE);
    assert.equal(service.totalSessions, 2);
    assert.equal(service.sessions.length, 2);
    for (const session of service.sessions) assert.match(session.id, CODE);

    // 2. Gán liệu trình + kiểm tra liên kết khóa ngoại.
    const pkg = await assignServicePackage(customer.id, { serviceId: service.id, paymentStatus: 'Đã thanh toán' }, user);
    trackedIds.packages.push(pkg.id);
    assert.match(pkg.id, CODE);
    assert.equal(pkg.customerId, customer.id);
    assert.equal(pkg.serviceId, service.id);
    const detail = await getServicePackage(pkg.id);
    assert.equal(detail.customerId, customer.id);
    assert.equal(detail.serviceId, service.id);
    assert.equal(detail.sessions.length, 2);
    for (const session of detail.sessions) {
      assert.match(session.id, CODE);
      assert.equal(session.templateId.trim().length, 10);
    }

    // 3. Lịch hẹn: tạo, xem, sửa, hủy.
    const date = nextDate(2);
    const appointment = await createAppointment({ customerId: customer.id, sessionId: detail.sessions[0].id, date, startTime: '09:00', note: 'tích hợp' }, user);
    trackedIds.appointments.push(appointment.id);
    assert.match(appointment.id, CODE);
    assert.equal(appointment.customerId, customer.id);
    assert.equal(appointment.sessionId, detail.sessions[0].id);
    const fetched = await getAppointment(appointment.id);
    assert.equal(fetched.sessionId, detail.sessions[0].id);
    const updated = await updateAppointment(appointment.id, { date, startTime: '10:00', note: 'tích hợp 2' }, user);
    assert.equal(updated.startTime, '10:00');
    assert.ok((await listAppointments({ date })).data.some((row) => row.id === appointment.id));
    assert.ok((await getAvailability({ date, durationMinutes: 30 })).availableSlots.length > 0);
    const cancelled = await cancelAppointment(appointment.id, { reason: 'tích hợp hủy' }, user);
    assert.equal(cancelled.status, 'Đã hủy');
    assert.equal(cancelled.cancellationCount, 1);
    const cancellations = await listCancellations(customer.id, {});
    assert.deepEqual(cancellations.data, []);

    // 4. Hoàn thành buổi và xác nhận, sau đó đánh giá.
    for (const session of detail.sessions) {
      await startPackageSession(pkg.id, session.id, user);
      await completePackageSession(pkg.id, session.id, { result: `Kết quả ${session.name}`, note: 'ok' }, user);
      const confirmed = await confirmPackageSession(pkg.id, session.id, user);
      assert.equal(confirmed.status, 'Đã hoàn thành');
    }
    const completed = await getServicePackage(pkg.id);
    assert.equal(completed.completionStatus, 'Đã hoàn thành');
    assert.equal(completed.sessionsCompleted, 2);
    const review = await createReview({ customerId: customer.id, servicePackageId: pkg.id, content: 'Rất tốt', rating: 5 }, user);
    trackedIds.reviews.push(review.id);
    assert.match(review.id, CODE);
    assert.equal(review.customerId, customer.id);
    assert.equal((await getReview(review.id)).rating, 5);
    assert.ok((await listReviews({ keyword: stamp })).data.some((row) => row.id === review.id));

    // 5. Mỹ phẩm + phiếu nhập/lô + bán lẻ + phiếu xuất.
    const retail = await createCosmetic({ name: `Mỹ phẩm lẻ ${stamp}`, category: 'Bán lẻ', unit: 'Chai', salePrice: 90000 }, user);
    trackedIds.products.push(retail.id);
    const treatment = await createCosmetic({ name: `Mỹ phẩm liệu trình ${stamp}`, category: 'Dùng cho liệu trình', unit: 'Hộp', salePrice: 120000 }, user);
    trackedIds.products.push(treatment.id);
    assert.match(retail.id, CODE);
    assert.match(treatment.id, CODE);
    assert.equal((await getCosmetic(retail.id)).category, 'Bán lẻ');
    assert.equal((await updateCosmetic(retail.id, { salePrice: 95000 }, user)).salePrice, 95000);
    assert.ok((await listCosmetics({ keyword: stamp })).data.some((row) => row.id === retail.id));

    const receipt = await createReceipt({
      receiptDate: nextDate(-1), paymentStatus: 'Đã thanh toán',
      items: [
        { cosmeticId: retail.id, purchasePrice: 50000, quantity: 4, lot: { productionDate: '2026-01-01', expiryDate: '2028-12-31' } },
        { cosmeticId: treatment.id, purchasePrice: 70000, quantity: 5, lot: { productionDate: '2026-01-01', expiryDate: '2028-12-31' } },
      ],
    }, user);
    trackedIds.receipts.push(receipt.id);
    assert.match(receipt.id, CODE);
    assert.equal(receipt.total, 50000 * 4 + 70000 * 5);
    assert.ok((await listReceipts({ keyword: receipt.id })).data.some((row) => row.id === receipt.id));
    assert.equal((await getReceipt(receipt.id)).items.length, 2);

    const retailLots = await listLots({ cosmeticId: retail.id });
    const treatmentLots = await listLots({ cosmeticId: treatment.id });
    for (const lot of [...retailLots, ...treatmentLots]) {
      assert.match(lot.id, /^\d{6}-\d{3}$/);
      assert.ok([retail.id, treatment.id].includes(lot.cosmeticId));
    }

    const sale = await createRetailSale(customer.id, { items: [{ cosmeticId: retail.id, quantity: 1 }] }, user);
    trackedIds.sales.push(sale.id);
    assert.match(sale.id, CODE);

    const issue = await createIssue({
      issueDate: nextDate(0), reason: 'tích hợp xuất kho',
      items: [{ cosmeticId: treatment.id, batchId: treatmentLots[0].id, quantity: 5 }],
    }, user);
    trackedIds.issues.push(issue.id);
    assert.match(issue.id, CODE);
    assert.ok((await listIssues({ keyword: issue.id })).data.some((row) => row.id === issue.id));
    assert.equal((await getIssue(issue.id)).items[0].lotCode, treatmentLots[0].id);

    // 6. Cảnh báo/cấu hình vẫn trả đúng hình dạng dù bảng gốc không tồn tại.
    const alerts = await listAlerts({});
    assert.ok(Array.isArray(alerts.data));
    assert.ok(alerts.summary.lowStock);
    assert.equal(await refreshExpiryAlerts(), 0);
    assert.equal(await updateStockAlerts(), undefined);
    await assert.rejects(updateConfiguration('MIN_STOCK_THRESHOLD', 5, user), (error) => error.code === 'CONFIGURATION_UNAVAILABLE');

    // 7. Tìm kiếm + sửa + chặn xóa khi còn dữ liệu liên quan.
    assert.ok((await listCustomers({ keyword: stamp })).data.some((row) => row.id === customer.id));
    assert.equal((await updateCustomer(customer.id, { name: `Khách tích hợp sửa ${stamp}` }, user)).name, `Khách tích hợp sửa ${stamp}`);
    assert.equal((await getCustomer(customer.id)).id, customer.id);
    assert.ok((await listServices({ keyword: stamp })).data.some((row) => row.id === service.id));
    await updateService(service.id, { price: 275000 }, user);
    assert.equal((await getService(service.id)).price, 275000);
    await assert.rejects(deleteCustomer(customer.id, user), (error) => error.code === 'CUSTOMER_HAS_RELATED_DATA');
    await assert.rejects(deleteService(service.id, user), (error) => error.code === 'SERVICE_IN_USE');
    await assert.rejects(deleteCosmetic(treatment.id, user), (error) => error.code === 'COSMETIC_HAS_HISTORY');

    // 8. Xóa mỹ phẩm không phát sinh giao dịch.
    const spare = await createCosmetic({ name: `Mỹ phẩm tạm ${stamp}`, category: 'Bán lẻ', unit: 'Chai', salePrice: 10000 }, user);
    trackedIds.products.push(spare.id);
    const removed = await deleteCosmetic(spare.id, user);
    assert.equal(removed.id, spare.id);

    // 9. Tạo đồng thời: mã không trùng, luôn đủ 10 ký tự.
    const concurrent = await Promise.all(Array.from({ length: 8 }, (_, index) =>
      createCustomer({ name: `Khách song song ${stamp} ${index}`, dateOfBirth: '1991-02-02', phone: phone(index + 10) }, user)));
    for (const row of concurrent) {
      trackedIds.customers.push(row.id);
      assert.match(row.id, CODE);
    }
    assert.equal(new Set(concurrent.map((row) => row.id)).size, concurrent.length);
    assert.equal(new Set(concurrent.map((row) => row.phone)).size, concurrent.length);

    // 10. Dữ liệu cũ không bị thay đổi.
    const afterIds = new Set(await trackedCounts());
    for (const id of beforeIds) assert.ok(afterIds.has(id), `Mất dữ liệu cũ: ${id}`);
  } finally {
    await cleanup();
    const after = await tableCounts();
    assert.deepEqual(after, before, 'Số dòng phải trở về đúng như trước khi chạy test');
    await closeDatabase();
  }
});
