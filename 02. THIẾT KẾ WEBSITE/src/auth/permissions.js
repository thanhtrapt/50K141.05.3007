/**
 * Ma trận phân quyền dùng chung cho Frontend.
 *
 * Quy tắc nghiệp vụ:
 * - STAFF (Nhân viên): toàn quyền hồ sơ khách hàng, mỹ phẩm, phiếu xuất kho,
 *   đánh giá, cảnh báo tồn kho/hạn sử dụng; chỉ XEM lịch hẹn và dịch vụ;
 *   KHÔNG được xem/tạo phiếu nhập kho.
 * - OWNER (Chủ Spa): kế thừa toàn bộ quyền của STAFF và có thêm quyền quản trị
 *   lịch hẹn, dịch vụ và phiếu nhập kho.
 */
export const ROLES = Object.freeze({ OWNER: 'OWNER', STAFF: 'STAFF' });

export const ROLE_LABELS = Object.freeze({ OWNER: 'Chủ Spa', STAFF: 'Nhân viên' });

const BOTH = Object.freeze([ROLES.OWNER, ROLES.STAFF]);
const OWNER_ONLY = Object.freeze([ROLES.OWNER]);

export const PERMISSIONS = Object.freeze({
  'dashboard:read': BOTH,

  // Hồ sơ khách hàng: STAFF toàn quyền.
  'customers:read': BOTH,
  'customers:write': BOTH,
  'reviews:read': BOTH,
  'reviews:write': BOTH,

  // Lịch hẹn: STAFF chỉ xem, OWNER được tạo/điều chỉnh/hủy.
  'appointments:read': BOTH,
  'appointments:write': OWNER_ONLY,

  // Dịch vụ: STAFF chỉ xem, OWNER được thêm/sửa/xóa.
  'services:read': BOTH,
  'services:write': OWNER_ONLY,

  // Mỹ phẩm + cảnh báo: STAFF toàn quyền.
  'cosmetics:read': BOTH,
  'cosmetics:write': BOTH,
  'alerts:read': BOTH,

  // Phiếu xuất kho: STAFF toàn quyền.
  'stock-issues:read': BOTH,
  'stock-issues:write': BOTH,

  // Phiếu nhập kho: chỉ OWNER, STAFF bị cấm hoàn toàn.
  'stock-receipts:read': OWNER_ONLY,
  'stock-receipts:write': OWNER_ONLY,

  // Cấu hình hệ thống: quyền quản trị.
  'system-config:write': OWNER_ONLY,
});

/**
 * Kiểm tra một role có quyền cụ thể hay không. OWNER kế thừa STAFF nhờ danh sách
 * quyền ở trên luôn chứa cả hai role với các quyền dùng chung.
 */
export function can(role, permission) {
  if (!role) return false;
  const allowed = PERMISSIONS[permission];
  if (!allowed) return false;
  return allowed.includes(role);
}

/** Nhãn hiển thị của role, ưu tiên tên lưu trong CSDL (`roleName`). */
export function roleLabel(role, roleName) {
  return roleName || ROLE_LABELS[role] || 'Người dùng';
}
