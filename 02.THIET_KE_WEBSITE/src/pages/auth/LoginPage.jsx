import { useState } from 'react';
import { Eye, EyeOff, Heart, LockKeyhole, UserRound } from 'lucide-react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import Button from '../../components/ui/Button.jsx';
import FeedbackDialog from '../../components/ui/FeedbackDialog.jsx';
import { useFeedback } from '../../components/ui/FeedbackContext.jsx';
import { useAuth } from '../../auth/AuthContext.jsx';

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, status } = useAuth();
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);
  const [fieldErrors, setFieldErrors] = useState({});
  const [credentialErrorOpen, setCredentialErrorOpen] = useState(false);
  const { notify } = useFeedback();
  const from = location.state?.from || '/trang-chu';

  if (status === 'authenticated') return <Navigate to={from} replace />;

  const submit = async (event) => {
    event.preventDefault();
    if (!phone.trim() || !password.trim()) {
      setFieldErrors({ username: !phone.trim() ? 'Tên đăng nhập không được bỏ trống' : '', password: !password.trim() ? 'Mật khẩu không được bỏ trống' : '' });
      return;
    }
    setFieldErrors({});
    try {
      await login(phone.trim(), password);
      navigate(from, { replace: true });
    } catch (requestError) {
      if (requestError.isServerError || requestError.code === 'NETWORK_ERROR') {
        notify('Có lỗi xảy ra. Vui lòng thử lại.', 'error');
      } else {
        setCredentialErrorOpen(true);
      }
    }
  };

  return (
    <main className="login-page">
      <div className="login-brand" aria-label="Hương Spa — Nâng niu nét đẹp tự nhiên">
        <img src="/assets/brand-logo.png" alt="Hương Spa" />
        <p>NÂNG NIU NÉT ĐẸP TỰ NHIÊN</p>
        <div className="login-brand__flourish" aria-hidden="true"><span /><Heart size={24} fill="currentColor" strokeWidth={1.5} /><span /></div>
      </div>
      <section className="login-card" aria-labelledby="login-title">
        <h1 id="login-title">Đăng nhập</h1>
        <p>Chào mừng bạn<br />đến với hệ thống Hương Spa !</p>
        <form onSubmit={submit}>
          <label className="login-control">
            <UserRound aria-hidden="true" size={23} strokeWidth={1.8} />
            <input type="text" autoComplete="username" value={phone} onChange={(event) => { setPhone(event.target.value); setFieldErrors((current) => ({ ...current, username: '' })); }} placeholder="Tên đăng nhập (Số điện thoại)" aria-label="Tên đăng nhập (Số điện thoại)" aria-invalid={Boolean(fieldErrors.username)} />
          </label>
          {fieldErrors.username && <p className="login-error" role="alert">{fieldErrors.username}</p>}
          <label className="login-control">
            <LockKeyhole aria-hidden="true" size={23} strokeWidth={1.8} />
            <input type={showPassword ? 'text' : 'password'} autoComplete="current-password" value={password} onChange={(event) => { setPassword(event.target.value); setFieldErrors((current) => ({ ...current, password: '' })); }} placeholder="Mật khẩu" aria-label="Mật khẩu" aria-invalid={Boolean(fieldErrors.password)} />
            <button type="button" className="login-password-toggle" onClick={() => setShowPassword((current) => !current)} aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}>
              {showPassword ? <EyeOff size={22} /> : <Eye size={22} />}
            </button>
          </label>
          {fieldErrors.password && <p className="login-error" role="alert">{fieldErrors.password}</p>}
          <label className="login-remember"><input type="checkbox" checked={remember} onChange={(event) => setRemember(event.target.checked)} /><span>Ghi nhớ đăng nhập</span></label>
          <Button type="submit" className="login-submit">Đăng nhập</Button>
        </form>
      </section>
      <FeedbackDialog open={credentialErrorOpen} message="Tên đăng nhập hoặc mật khẩu không chính xác" onClose={() => setCredentialErrorOpen(false)} />
    </main>
  );
}
