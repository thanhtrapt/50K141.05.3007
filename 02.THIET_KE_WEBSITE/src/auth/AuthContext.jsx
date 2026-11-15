import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { apiRequest } from '../api.js';
import { can as roleCan } from './permissions.js';

const TOKEN_KEY = 'huong-spa-access-token';
const USER_KEY = 'huong-spa-user';

const AuthContext = createContext(null);

function readStoredUser() {
  try {
    return JSON.parse(window.localStorage.getItem(USER_KEY) || 'null');
  } catch {
    return null;
  }
}

function storeUser(user) {
  if (user) window.localStorage.setItem(USER_KEY, JSON.stringify(user));
  else window.localStorage.removeItem(USER_KEY);
}

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => window.localStorage.getItem(TOKEN_KEY));
  const [user, setUser] = useState(readStoredUser);
  const [status, setStatus] = useState(() => {
    if (!window.localStorage.getItem(TOKEN_KEY)) return 'anonymous';
    // Có phiên đã lưu thì hiển thị giao diện ngay, sau đó xác minh lại với /api/auth/me.
    return readStoredUser() ? 'authenticated' : 'loading';
  });

  useEffect(() => {
    if (!token) {
      setStatus('anonymous');
      return undefined;
    }

    let active = true;

    apiRequest('/api/auth/me')
      .then((result) => {
        if (!active) return;
        const nextUser = result?.user ?? result;
        if (nextUser?.role) {
          setUser(nextUser);
          storeUser(nextUser);
          setStatus('authenticated');
          return;
        }
        setUser(null);
        storeUser(null);
        setStatus('anonymous');
      })
      .catch((error) => {
        if (!active) return;
        if (error?.status === 401) {
          window.localStorage.removeItem(TOKEN_KEY);
          window.localStorage.removeItem(USER_KEY);
          setToken(null);
          setUser(null);
          setStatus('anonymous');
          return;
        }
        // Không xác minh được (mất mạng/CSDL tạm lỗi): giữ phiên đã lưu để
        // giao diện vẫn dùng được, mọi lời gọi API vẫn được Backend kiểm tra quyền.
        const cached = readStoredUser();
        setUser(cached);
        setStatus(cached ? 'authenticated' : 'anonymous');
      });

    return () => { active = false; };
  }, [token]);

  const login = useCallback(async (phone, password) => {
    const result = await apiRequest('/api/auth/login', {
      method: 'POST',
      auth: false,
      body: { phone, password },
    });
    window.localStorage.setItem(TOKEN_KEY, result.accessToken);
    storeUser(result.user ?? null);
    setUser(result.user ?? null);
    setToken(result.accessToken);
    setStatus('authenticated');
    return result.user ?? null;
  }, []);

  const logout = useCallback(() => {
    window.localStorage.removeItem(TOKEN_KEY);
    window.localStorage.removeItem(USER_KEY);
    setToken(null);
    setUser(null);
    setStatus('anonymous');
  }, []);

  const value = useMemo(() => {
    const role = user?.role ?? null;
    return {
      user,
      role,
      roleLabel: user?.roleName || (role === 'OWNER' ? 'Chủ Spa' : role === 'STAFF' ? 'Nhân viên' : ''),
      status,
      isAuthenticated: status === 'authenticated' && Boolean(user),
      isOwner: role === 'OWNER',
      can: (permission) => roleCan(role, permission),
      login,
      logout,
    };
  }, [user, status, login, logout]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth phải được dùng bên trong <AuthProvider>.');
  return context;
}
