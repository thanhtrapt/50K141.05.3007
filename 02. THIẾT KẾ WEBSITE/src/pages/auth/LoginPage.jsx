import { useState } from 'react';
import { Eye, EyeOff, LockKeyhole, UserRound } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import loginReference from '../../../ĐĂNG NHẬP/Desktop - ĐĂNG NHẬP.png';
import Button from '../../components/ui/Button.jsx';

export default function LoginPage() {
  const navigate = useNavigate();
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState('');

  const submit = (event) => {
    event.preventDefault();
    if (!phone.trim() || !password.trim()) {
      setError('Vui lòng nhập đầy đủ thông tin đăng nhập.');
      return;
    }
    setError('');
    navigate('/trang-chu');
  };

  return (
    <main className="login-page" style={{ '--login-reference': `url("${loginReference}")` }}>
      <section className="login-card" aria-labelledby="login-title">
        <h1 id="login-title">Đăng nhập</h1>
        <p>Chào mừng bạn<br />đến với hệ thống Hương Spa !</p>
        <form onSubmit={submit}>
          <label className="login-control">
            <UserRound aria-hidden="true" size={23} strokeWidth={1.8} />
            <input type="tel" autoComplete="username" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="Tên đăng nhập (Số điện thoại)" aria-label="Tên đăng nhập (Số điện thoại)" />
          </label>
          <label className="login-control">
            <LockKeyhole aria-hidden="true" size={23} strokeWidth={1.8} />
            <input type={showPassword ? 'text' : 'password'} autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Mật khẩu" aria-label="Mật khẩu" />
            <button type="button" className="login-password-toggle" onClick={() => setShowPassword((current) => !current)} aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}>
              {showPassword ? <EyeOff size={22} /> : <Eye size={22} />}
            </button>
          </label>
          <label className="login-remember"><input type="checkbox" checked={remember} onChange={(event) => setRemember(event.target.checked)} /><span>Ghi nhớ đăng nhập</span></label>
          {error && <p className="login-error" role="alert">{error}</p>}
          <Button type="submit" className="login-submit">Đăng nhập</Button>
        </form>
      </section>
    </main>
  );
}
