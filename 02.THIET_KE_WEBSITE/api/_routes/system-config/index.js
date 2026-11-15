import { endpoint } from '../../_lib/http.js';

// CauHinhHeThong không tồn tại trong schema thật. Trả về bộ giá trị mặc định
// đúng hình dạng cũ để giao diện không bị lỗi; PATCH sẽ trả 503.
const defaults = [
  ['MIN_STOCK_THRESHOLD', 10, 'number', 'Ngưỡng tồn kho tối thiểu'],
  ['EXPIRY_WARNING_DAYS', 60, 'number', 'Số ngày cảnh báo hạn sử dụng'],
  ['REMINDER_BEFORE_MINUTES', 45, 'number', 'Số phút nhắc trước lịch hẹn'],
  ['BLACKLIST_CANCEL_LIMIT', 3, 'number', 'Số lần hủy trước khi vào danh sách đen'],
  ['SPA_OPEN_TIME', '08:00', 'string', 'Giờ mở cửa'],
  ['SPA_CLOSE_TIME', '20:00', 'string', 'Giờ đóng cửa'],
  ['APPOINTMENT_SLOT_MINUTES', 30, 'number', 'Độ dài khung giờ hẹn (phút)'],
  ['SERVICE_BED_COUNT', 3, 'number', 'Số giường phục vụ'],
  ['SERVICE_PROVIDER_COUNT', 1, 'number', 'Số nhân viên phục vụ'],
];

// GET /api/system-config
export default endpoint({
  path: '/api/system-config',
  methods: ['GET'],
  roles: ['OWNER'],
  handler: async () => ({
    data: defaults.map(([key, value, valueType, description]) => ({ key, value, valueType, description, updatedAt: null })),
    readOnly: true,
    reason: 'CauHinhHeThong is not part of the current schema',
  }),
});
