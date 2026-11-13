import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar.jsx';
import TopBar from './TopBar.jsx';

export default function AppShell() {
  const [navigationOpen, setNavigationOpen] = useState(false);

  const closeNavigation = () => setNavigationOpen(false);

  return (
    <div className={`app-shell${navigationOpen ? ' app-shell--navigation-open' : ''}`}>
      <button
        className="navigation-backdrop"
        type="button"
        aria-label="Đóng menu"
        onClick={closeNavigation}
        tabIndex={navigationOpen ? 0 : -1}
      />
      <Sidebar onNavigate={closeNavigation} />
      <div className="app-workspace">
        <TopBar onMenuClick={() => setNavigationOpen((open) => !open)} />
        <main className="main-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
