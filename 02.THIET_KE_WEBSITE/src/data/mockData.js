export const services = [
  { id: 'DV00000001', name: 'Trị mụn chuyên sâu', price: 3000000, sessions: 5 },
  { id: 'DV00000002', name: 'Chăm sóc da cơ bản', price: 1500000, sessions: 3 },
  { id: 'DV00000003', name: 'Phục hồi da', price: 2500000, sessions: 4 },
  { id: 'DV00000004', name: 'Chăm sóc da công nghệ cao', price: 4500000, sessions: 5 },
  { id: 'DV00000005', name: 'Điều trị mụn công nghệ cao', price: 4500000, sessions: 5 },
  { id: 'DV00000006', name: 'Trẻ hóa da', price: 5500000, sessions: 6 },
  { id: 'DV00000007', name: 'Chăm sóc da đa tầng', price: 3500000, sessions: 4 },
];

export const activeServiceUsage = {
  id: 'LHD0000001',
  name: 'VI KIM SINH HỌC',
  purchaseDate: '07/11/2026',
  purchaseOrder: 'LHD0000001',
  price: 3600000,
  paymentStatus: 'Đã thanh toán',
  status: 'Đang thực hiện',
  startDate: '12/10/2026',
  expectedEndDate: '',
  totalSessions: 4,
  deliveryMilestones: [1, 2, 4],
  deliveryHistory: [],
  galleryImages: [],
  techniques: [
    'Kiểm tra da',
    'Tẩy trang và rửa mặt',
    'Tẩy tế bào chết',
    'Bôi Enzyme',
    'Xông hơi',
    'Hút nhờn',
    'Sát khuẩn',
    'Lấy nhân mụn',
    'Điện tím',
    'Sử dụng công nghệ IPL',
    'Chiếu đèn ánh sáng sinh học',
    'Đắp mặt nạ',
    'Massage dầu thư giãn',
    'Điện di tinh chất',
    'Thưởng trà thảo mộc',
  ],
  products: [
    { name: 'Tẩy trang', amount: '2g' },
    { name: 'Sữa rửa mặt', amount: '2g' },
    { name: 'Tẩy tế bào chết', amount: '2g' },
    { name: 'Bột enzyme', amount: '2g' },
    { name: 'Gel lô hội', amount: '5g' },
    { name: 'Mặt nạ', amount: '10g' },
    { name: 'Vi Kim', amount: '3g' },
  ],
  sessions: [
    {
      number: 1,
      status: 'Đã hoàn thành',
      date: '12/10/2026',
      duration: 90,
      customerConfirmation: 'Chưa xác nhận',
      employee: '',
      notes: '',
      techniques: [],
      products: [],
      result: '',
      beforeImages: [],
      afterImages: [],
    },
    {
      number: 2,
      status: 'Chờ xác nhận',
      date: '20/10/2026',
      duration: 90,
      customerConfirmation: 'Chưa xác nhận',
      employee: '',
      notes: '',
      techniques: [],
      products: [],
      result: '',
      beforeImages: [],
      afterImages: [],
    },
    {
      number: 3,
      status: 'Đang thực hiện',
      date: '28/10/2026',
      duration: 90,
      customerConfirmation: 'Chưa xác nhận',
      employee: '',
      notes: '',
      techniques: [],
      products: [],
      result: '',
      beforeImages: [],
      afterImages: [],
    },
    {
      number: 4,
      status: 'Chưa thực hiện',
      date: '--',
      duration: 90,
      customerConfirmation: 'Chưa xác nhận',
      employee: '',
      notes: '',
      techniques: [],
      products: [],
      result: '',
      beforeImages: [],
      afterImages: [],
    },
  ],
};

export const products = [
  { id: 'MP00000001', name: 'Serum phục hồi B5', category: 'Serum', stock: 48, price: 450000, image: '/assets/products/mp001.png' },
  { id: 'MP00000002', name: 'Sữa rửa mặt dưỡng ẩm', category: 'Làm sạch', stock: 36, price: 250000, image: '/assets/products/mp002.png' },
  { id: 'MP00000003', name: 'Kem dưỡng da ban đêm', category: 'Kem dưỡng', stock: 24, price: 380000, image: '/assets/products/mp003.png' },
  { id: 'MP00000004', name: 'Mặt nạ cấp ẩm HA', category: 'Mặt nạ', stock: 80, price: 45000, image: '/assets/products/mp004.png' },
  { id: 'MP00000005', name: 'Toner cân bằng da', category: 'Toner', stock: 32, price: 220000, image: '/assets/products/mp005.png' },
  { id: 'MP00000006', name: 'Serum sáng da Vitamin C', category: 'Serum', stock: 18, price: 490000, image: '/assets/products/mp006.png' },
  { id: 'MP00000007', name: 'Kem dưỡng phục hồi Ceramide', category: 'Kem dưỡng', stock: 20, price: 420000, image: '/assets/products/mp007.png' },
  { id: 'MP00000008', name: 'Nước tẩy trang dịu nhẹ', category: 'Làm sạch', stock: 28, price: 280000, image: '/assets/products/mp008.png' },
];

export const customers = [
  { id: 'KH00000001', name: 'Nguyễn Thị Lan', birthday: '12/03/1990', phone: '0912345678', visits: 4 },
  { id: 'KH00000002', name: 'Trần Minh Anh', birthday: '25/07/1995', phone: '0987654321', visits: 3 },
  { id: 'KH00000003', name: 'Lê Thu Hà', birthday: '08/11/1988', phone: '0933221100', visits: 7 },
  { id: 'KH00000004', name: 'Phạm Ngọc Mai', birthday: '30/05/1993', phone: '0977112233', visits: 2 },
  { id: 'KH00000005', name: 'Đỗ Quang Minh', birthday: '14/02/1991', phone: '0966778899', visits: 5 },
  { id: 'KH00000006', name: 'Vũ Hồng Nhung', birthday: '19/09/1996', phone: '0905123456', visits: 4 },
  { id: 'KH00000007', name: 'Hoàng Thanh Tâm', birthday: '03/01/1987', phone: '0948765432', visits: 6 },
  { id: 'KH00000008', name: 'Bùi Khánh Linh', birthday: '22/12/1994', phone: '0919876543', visits: 3 },
  { id: 'KH00000009', name: 'Đặng Thúy Hằng', birthday: '07/06/1992', phone: '0932109876', visits: 2 },
];

export const reviews = [
  { id: 'DG00000001', date: '30/10/2026 14:30', customer: 'Nguyễn Thị Lan', service: 'Trị mụn chuyên sâu', stars: 5 },
  { id: 'DG00000002', date: '28/10/2026 12:00', customer: 'Trần Minh Anh', service: 'Chăm sóc da cơ bản', stars: 5 },
  { id: 'DG00000003', date: '26/10/2026 16:40', customer: 'Lê Thu Hà', service: 'Chăm sóc da công nghệ cao', stars: 4 },
  { id: 'DG00000004', date: '24/10/2026 10:15', customer: 'Phạm Ngọc Mai', service: 'Phục hồi da', stars: 5 },
  { id: 'DG00000005', date: '22/10/2026 15:20', customer: 'Vũ Hồng Nhung', service: 'Trẻ hóa da', stars: 5 },
  { id: 'DG00000006', date: '20/10/2026 09:30', customer: 'Đỗ Quang Minh', service: 'Chăm sóc da đa tầng', stars: 4 },
  { id: 'DG00000007', date: '18/10/2026 13:10', customer: 'Bùi Khánh Linh', service: 'Massage tinh dầu', stars: 5 },
];

export const lowStockItems = [
  { lot: '011126-001', id: 'MP00000009', name: 'Serum Vitamin C 20ml', category: 'Serum', stock: 0, status: 'Hết hàng', tone: 'danger' },
  { lot: '011126-002', id: 'MP00000010', name: 'Kem dưỡng ẩm ban đêm', category: 'Kem dưỡng', stock: 3, status: 'Sắp hết', tone: 'warning' },
  { lot: '011126-003', id: 'MP00000011', name: 'Sữa rửa mặt dịu nhẹ', category: 'Làm sạch', stock: 5, status: 'Sắp hết', tone: 'warning' },
  { lot: '011126-004', id: 'MP00000012', name: 'Toner cân bằng da', category: 'Toner', stock: 2, status: 'Sắp hết', tone: 'warning' },
  { lot: '011126-005', id: 'MP00000013', name: 'Tinh chất dưỡng ẩm', category: 'Tinh chất', stock: 10, status: 'Sắp hết', tone: 'warning' },
];

export const expiryItems = [
  { lot: '011026-021', id: 'MP00000009', name: 'Serum Vitamin C 20ml', category: 'Lưu trữ lạnh', expiry: '02/12/2026', days: 20, status: 'Sắp hết hạn', tone: 'warning' },
  { lot: '011026-022', id: 'MP00000010', name: 'Kem dưỡng ẩm ban đêm', category: 'Bán lẻ', expiry: '10/12/2026', days: 28, status: 'Sắp hết hạn', tone: 'warning' },
  { lot: '011026-023', id: 'MP00000011', name: 'Sữa rửa mặt dịu nhẹ', category: 'Lưu trữ lạnh', expiry: '11/11/2026', days: 0, status: 'Hết hạn', tone: 'danger' },
];

export const inboundRecords = [
  {
    id: 'PN00000005', date: '29/10/2026', total: 14000000, creator: 'Lê Thị Thu Hương', paymentStatus: 'Chưa thanh toán',
    items: [
      { product: 'Serum Vitamin C', unit: 'Chai', price: 380000, quantity: 10, lot: '291026-001' },
      { product: 'Toner cấp ẩm', unit: 'Chai', price: 190000, quantity: 20, lot: '291026-002' },
      { product: 'Sữa rửa mặt dưỡng ẩm', unit: 'Chai', price: 200000, quantity: 11, lot: '291026-003' },
      { product: 'Mặt nạ dưỡng trắng', unit: 'Hộp', price: 280000, quantity: 15, lot: '291026-003' },
    ],
  },
  {
    id: 'PN00000004', date: '04/10/2026', total: 6300000, creator: 'Lê Thị Thu Hương', paymentStatus: 'Đã thanh toán',
    items: [
      { product: 'Serum Vitamin C', unit: 'Chai', price: 380000, quantity: 10, lot: '041026-001' },
      { product: 'Toner cấp ẩm', unit: 'Chai', price: 190000, quantity: 10, lot: '041026-002' },
      { product: 'Sữa rửa mặt dưỡng ẩm', unit: 'Chai', price: 200000, quantity: 3, lot: '041026-003' },
    ],
  },
  { id: 'PN00000003', date: '05/09/2026', total: 8900000 },
  { id: 'PN00000002', date: '15/08/2026', total: 10200000 },
  { id: 'PN00000001', date: '13/07/2026', total: 13700000 },
];

export const outboundRecords = [
  { id: 'PX00000006', date: '29/10/2026', customer: 'Thư Hương', total: 2600000 },
  { id: 'PX00000005', date: '21/10/2026', customer: 'Lê Thu Hà', total: 1150000 },
  { id: 'PX00000004', date: '14/10/2026', customer: 'Nguyễn Thị Lan', total: 1890000 },
  { id: 'PX00000003', date: '08/10/2026', customer: 'Vũ Hồng Nhung', total: 760000 },
  { id: 'PX00000002', date: '02/10/2026', customer: 'Trần Minh Anh', total: 1480000 },
];

export const formatCurrency = (amount) => `${new Intl.NumberFormat('vi-VN').format(amount)} ₫`;
