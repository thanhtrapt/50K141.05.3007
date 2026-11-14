import { Navigate, Route, Routes } from 'react-router-dom';
import AppShell from './components/layout/AppShell.jsx';
import AppointmentsPage from './pages/appointments/AppointmentsPage.jsx';
import LoginPage from './pages/auth/LoginPage.jsx';
import NotFoundPage from './pages/NotFoundPage.jsx';
import CustomerHubPage from './pages/customers/CustomerHubPage.jsx';
import CustomersPage from './pages/customers/CustomersPage.jsx';
import ReviewsPage from './pages/customers/ReviewsPage.jsx';
import AlertsPage from './pages/dashboard/AlertsPage.jsx';
import DashboardPage from './pages/dashboard/DashboardPage.jsx';
import InboundPage from './pages/inventory/InboundPage.jsx';
import OutboundPage from './pages/inventory/OutboundPage.jsx';
import ProductsPage from './pages/products/ProductsPage.jsx';
import ServicesPage from './pages/services/ServicesPage.jsx';

export default function App() {
  return (
    <Routes>
      <Route path="/dang-nhap" element={<LoginPage />} />
      <Route element={<AppShell />}>
        <Route index element={<Navigate to="/trang-chu" replace />} />
        <Route path="trang-chu" element={<DashboardPage />} />
        <Route path="lich-hen/*" element={<AppointmentsPage />} />
        <Route path="khach-hang" element={<CustomerHubPage />} />
        <Route path="khach-hang/*" element={<CustomersPage />} />
        <Route path="ho-so-khach-hang/*" element={<CustomersPage recordsOnly />} />
        <Route path="danh-gia/*" element={<ReviewsPage />} />
        <Route path="dich-vu/*" element={<ServicesPage />} />
        <Route path="my-pham/*" element={<ProductsPage />} />
        <Route path="phieu-nhap-kho/*" element={<InboundPage />} />
        <Route path="phieu-xuat-kho" element={<OutboundPage />} />
        <Route path="canh-bao/ton-kho" element={<AlertsPage />} />
        <Route path="canh-bao/han-su-dung" element={<AlertsPage />} />
        <Route path="canh-bao" element={<Navigate to="/canh-bao/ton-kho" replace />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
