export const services = [
  { id: 'DV001', name: 'Trị mụn chuyên sâu', price: 3000000, sessions: 5 },
  { id: 'DV002', name: 'Chăm sóc da cơ bản', price: 1500000, sessions: 3 },
  { id: 'DV003', name: 'Phục hồi da', price: 2500000, sessions: 4 },
  { id: 'DV004', name: 'Chăm sóc da công nghệ cao', price: 4500000, sessions: 5 },
  { id: 'DV005', name: 'Điều trị mụn công nghệ cao', price: 4500000, sessions: 5 },
  { id: 'DV006', name: 'Trẻ hóa da', price: 5500000, sessions: 6 },
  { id: 'DV007', name: 'Chăm sóc da đa tầng', price: 3500000, sessions: 4 },
];

export const products = [
  { id: 'MP001', name: 'Serum phục hồi B5', category: 'Serum', stock: 48, price: 450000, image: '/assets/products/mp001.png' },
  { id: 'MP002', name: 'Sữa rửa mặt dưỡng ẩm', category: 'Làm sạch', stock: 36, price: 250000, image: '/assets/products/mp002.png' },
  { id: 'MP003', name: 'Kem dưỡng da ban đêm', category: 'Kem dưỡng', stock: 24, price: 380000, image: '/assets/products/mp003.png' },
  { id: 'MP004', name: 'Mặt nạ cấp ẩm HA', category: 'Mặt nạ', stock: 80, price: 45000, image: '/assets/products/mp004.png' },
  { id: 'MP005', name: 'Toner cân bằng da', category: 'Toner', stock: 32, price: 220000, image: '/assets/products/mp005.png' },
  { id: 'MP006', name: 'Serum sáng da Vitamin C', category: 'Serum', stock: 18, price: 490000, image: '/assets/products/mp006.png' },
  { id: 'MP007', name: 'Kem dưỡng phục hồi Ceramide', category: 'Kem dưỡng', stock: 20, price: 420000, image: '/assets/products/mp007.png' },
  { id: 'MP008', name: 'Nước tẩy trang dịu nhẹ', category: 'Làm sạch', stock: 28, price: 280000, image: '/assets/products/mp008.png' },
];

export const customers = [
  { id: 'KH001', name: 'Nguyễn Thị Lan', birthday: '12/03/1990', phone: '0912345678', visits: 4 },
  { id: 'KH002', name: 'Trần Minh Anh', birthday: '25/07/1995', phone: '0987654321', visits: 3 },
  { id: 'KH003', name: 'Lê Thu Hà', birthday: '08/11/1988', phone: '0933221100', visits: 7 },
  { id: 'KH004', name: 'Phạm Ngọc Mai', birthday: '30/05/1993', phone: '0977112233', visits: 2 },
  { id: 'KH005', name: 'Đỗ Quang Minh', birthday: '14/02/1991', phone: '0966778899', visits: 5 },
  { id: 'KH006', name: 'Vũ Hồng Nhung', birthday: '19/09/1996', phone: '0905123456', visits: 4 },
  { id: 'KH007', name: 'Hoàng Thanh Tâm', birthday: '03/01/1987', phone: '0948765432', visits: 6 },
  { id: 'KH008', name: 'Bùi Khánh Linh', birthday: '22/12/1994', phone: '0919876543', visits: 3 },
  { id: 'KH009', name: 'Đặng Thúy Hằng', birthday: '07/06/1992', phone: '0932109876', visits: 2 },
];

export const reviews = [
  { id: 'DG001', date: '30/10/2026 14:30', customer: 'Nguyễn Thị Lan', service: 'Trị mụn chuyên sâu', stars: 5 },
  { id: 'DG002', date: '28/10/2026 12:00', customer: 'Trần Minh Anh', service: 'Chăm sóc da cơ bản', stars: 5 },
  { id: 'DG003', date: '26/10/2026 16:40', customer: 'Lê Thu Hà', service: 'Chăm sóc da công nghệ cao', stars: 4 },
  { id: 'DG004', date: '24/10/2026 10:15', customer: 'Phạm Ngọc Mai', service: 'Phục hồi da', stars: 5 },
  { id: 'DG005', date: '22/10/2026 15:20', customer: 'Vũ Hồng Nhung', service: 'Trẻ hóa da', stars: 5 },
  { id: 'DG006', date: '20/10/2026 09:30', customer: 'Đỗ Quang Minh', service: 'Chăm sóc da đa tầng', stars: 4 },
  { id: 'DG007', date: '18/10/2026 13:10', customer: 'Bùi Khánh Linh', service: 'Massage tinh dầu', stars: 5 },
];

export const lowStockItems = [
  { lot: 'L-001', id: 'SP-0007', name: 'Serum Vitamin C 20ml', category: 'Serum', stock: 0, status: 'Hết hàng', tone: 'danger' },
  { lot: 'L-002', id: 'SP-0012', name: 'Kem dưỡng ẩm ban đêm', category: 'Kem dưỡng', stock: 3, status: 'Sắp hết', tone: 'warning' },
  { lot: 'L-003', id: 'SP-0003', name: 'Sữa rửa mặt dịu nhẹ', category: 'Làm sạch', stock: 5, status: 'Sắp hết', tone: 'warning' },
  { lot: 'L-004', id: 'SP-0009', name: 'Toner cân bằng da', category: 'Toner', stock: 2, status: 'Sắp hết', tone: 'warning' },
  { lot: 'L-005', id: 'SP-0015', name: 'Tinh chất dưỡng ẩm', category: 'Tinh chất', stock: 10, status: 'Sắp hết', tone: 'warning' },
];

export const expiryItems = [
  { lot: 'L-021', id: 'SP-0007', name: 'Serum Vitamin C 20ml', category: 'Lưu trữ lạnh', expiry: '02/12/2026', days: 20, status: 'Sắp hết hạn', tone: 'warning' },
  { lot: 'L-022', id: 'SP-0012', name: 'Kem dưỡng ẩm ban đêm', category: 'Bán lẻ', expiry: '10/12/2026', days: 28, status: 'Sắp hết hạn', tone: 'warning' },
  { lot: 'L-023', id: 'SP-0003', name: 'Sữa rửa mặt dịu nhẹ', category: 'Lưu trữ lạnh', expiry: '11/11/2026', days: 0, status: 'Hết hạn', tone: 'danger' },
];

export const inboundRecords = [
  {
    id: 'PNK-20261029-005', date: '29/10/2026', total: 14000000, creator: 'Lê Thị Thu Hương', paymentStatus: 'Chưa thanh toán',
    items: [
      { product: 'Serum Vitamin C', unit: 'Chai', price: 380000, quantity: 10, lot: '291026-1' },
      { product: 'Toner cấp ẩm', unit: 'Chai', price: 190000, quantity: 20, lot: '291026-2' },
      { product: 'Sữa rửa mặt dưỡng ẩm', unit: 'Chai', price: 200000, quantity: 11, lot: '291026-3' },
      { product: 'Mặt nạ dưỡng trắng', unit: 'Hộp', price: 280000, quantity: 15, lot: '291026-3' },
    ],
  },
  {
    id: 'PNK-20261004-004', date: '04/10/2026', total: 6300000, creator: 'Lê Thị Thu Hương', paymentStatus: 'Đã thanh toán',
    items: [
      { product: 'Serum Vitamin C', unit: 'Chai', price: 380000, quantity: 10, lot: '041026-1' },
      { product: 'Toner cấp ẩm', unit: 'Chai', price: 190000, quantity: 10, lot: '041026-2' },
      { product: 'Sữa rửa mặt dưỡng ẩm', unit: 'Chai', price: 200000, quantity: 3, lot: '041026-3' },
    ],
  },
  { id: 'PNK-20260905-003', date: '05/09/2026', total: 8900000 },
  { id: 'PNK-20260815-002', date: '15/08/2026', total: 10200000 },
  { id: 'PNK-20260713-001', date: '13/07/2026', total: 13700000 },
];

export const outboundRecords = [
  { id: 'PXK-20261029-006', date: '29/10/2026', customer: 'Thư Hương', total: 2600000 },
  { id: 'PXK-20261021-005', date: '21/10/2026', customer: 'Lê Thu Hà', total: 1150000 },
  { id: 'PXK-20261014-004', date: '14/10/2026', customer: 'Nguyễn Thị Lan', total: 1890000 },
  { id: 'PXK-20261008-003', date: '08/10/2026', customer: 'Vũ Hồng Nhung', total: 760000 },
  { id: 'PXK-20261002-002', date: '02/10/2026', customer: 'Trần Minh Anh', total: 1480000 },
];

export const appointmentEvents = [
  { id: 'LH001', day: 0, start: '08:30', end: '10:00', customer: 'Nguyễn Ngọc Lan', service: 'Chăm sóc da chuyên sâu', tone: 'mint' },
  { id: 'LH002', day: 0, start: '14:00', end: '15:30', customer: 'Trần Thanh Hoa', service: 'Massage tinh dầu', tone: 'lavender' },
  { id: 'LH003', day: 1, start: '09:00', end: '10:00', customer: 'Lê Thu Mai', service: 'Chăm sóc da chuyên sâu', tone: 'mint' },
  { id: 'LH004', day: 1, start: '16:00', end: '17:30', customer: 'Phạm Thùy Trang', service: 'Tẩy tế bào chết toàn thân', tone: 'rose' },
  { id: 'LH005', day: 2, start: '08:30', end: '10:00', customer: 'Đỗ Khánh Linh', service: 'Chăm sóc da chuyên sâu', tone: 'mint' },
  { id: 'LH006', day: 2, start: '11:00', end: '12:00', customer: 'Nguyễn Phương Thảo', service: 'Massage tinh dầu', tone: 'lavender' },
  { id: 'LH007', day: 2, start: '15:00', end: '16:30', customer: 'Bùi Hải Yến', service: 'Ủ dưỡng trắng toàn thân', tone: 'rose' },
  { id: 'LH008', day: 3, start: '09:30', end: '11:00', customer: 'Trần Ngọc Hân', phone: '0903 456 789', service: 'Chăm sóc da chuyên sâu', note: 'Da nhạy cảm, ưu tiên sản phẩm dịu nhẹ. Khách muốn tư vấn thêm về dưỡng ẩm sau liệu trình.', tone: 'mint' },
  { id: 'LH009', day: 3, start: '17:00', end: '18:00', customer: 'Võ Tố Anh', service: 'Chăm sóc da', tone: 'lavender' },
  { id: 'LH010', day: 4, start: '10:00', end: '11:30', customer: 'Nguyễn Lan Hương', service: 'Massage tinh dầu', tone: 'lavender' },
  { id: 'LH011', day: 4, start: '14:30', end: '16:00', customer: 'Hoàng Thùy Dung', service: 'Chăm sóc da chuyên sâu', tone: 'mint' },
  { id: 'LH012', day: 5, start: '09:00', end: '10:30', customer: 'Lê Tường Vy', service: 'Ủ dưỡng trắng toàn thân', tone: 'rose' },
  { id: 'LH013', day: 5, start: '16:30', end: '18:00', customer: 'Trần Thanh Hà', service: 'Massage tinh dầu', tone: 'lavender' },
  { id: 'LH014', day: 6, start: '10:30', end: '12:00', customer: 'Phạm Bảo Ngọc', service: 'Chăm sóc da chuyên sâu', tone: 'mint' },
  { id: 'LH015', day: 6, start: '18:30', end: '20:00', customer: 'Võ Yến Nhi', service: 'Massage thư giãn', tone: 'lavender' },
];

export const appointmentDays = [
  { day: 'Thứ Hai', date: '19/10' },
  { day: 'Thứ Ba', date: '20/10' },
  { day: 'Thứ Tư', date: '21/10' },
  { day: 'Thứ Năm', date: '22/10' },
  { day: 'Thứ Sáu', date: '23/10' },
  { day: 'Thứ Bảy', date: '24/10' },
  { day: 'Chủ Nhật', date: '25/10' },
];

export const formatCurrency = (amount) => `${new Intl.NumberFormat('vi-VN').format(amount)} ₫`;
