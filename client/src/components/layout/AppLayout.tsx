import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useAuth, useIsAdmin, useIsManagerOrAdmin } from '../../context/AuthContext';

const NAV_LINKS = [
  { to: '/dashboard', label: 'Dashboard', roles: 'all' as const },
  { to: '/facilities', label: 'Facilities', roles: 'all' as const },
  { to: '/access-requests', label: 'My Requests', roles: 'all' as const },
  { to: '/my-access', label: 'My Access', roles: 'all' as const },
  { to: '/manager/requests', label: 'Pending Approvals', roles: 'manager' as const },
  { to: '/admin', label: 'Administration', roles: 'admin' as const },
];

export default function AppLayout() {
  const { user, logout } = useAuth();
  const isManagerOrAdmin = useIsManagerOrAdmin();
  const isAdmin = useIsAdmin();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  function closeMobileNav() {
    setMobileNavOpen(false);
  }

  function isLinkVisible(roles: 'all' | 'manager' | 'admin') {
    if (roles === 'all') {
      return true;
    }
    if (roles === 'manager') {
      return isManagerOrAdmin;
    }
    return isAdmin;
  }

  const navLinks = NAV_LINKS.filter((link) => isLinkVisible(link.roles));

  return (
    <div className="app-layout">
      <header className="app-header">
        <div className="header-brand">
          <button
            type="button"
            className="mobile-nav-toggle mobile-only"
            aria-expanded={mobileNavOpen}
            aria-controls="main-navigation"
            onClick={() => setMobileNavOpen((open) => !open)}
          >
            {mobileNavOpen ? 'Close menu' : 'Open menu'}
          </button>
          <span className="brand-mark" aria-hidden="true">
            FA
          </span>
          <div>
            <span className="brand-title">Facility Access</span>
            <span className="brand-subtitle">Asset Management</span>
          </div>
        </div>
        <div className="header-user">
          <div className="user-meta">
            <span className="user-name">{user?.name}</span>
            <span className="role-badge">{user?.role}</span>
          </div>
          <button type="button" className="btn btn-secondary btn-sm" onClick={logout}>
            Logout
          </button>
        </div>
      </header>

      <div className="app-body">
        {mobileNavOpen && (
          <button
            type="button"
            className="mobile-nav-backdrop mobile-only"
            aria-label="Close navigation menu"
            onClick={closeMobileNav}
          />
        )}

        <nav
          id="main-navigation"
          className={`app-sidebar ${mobileNavOpen ? 'mobile-open' : ''}`}
          aria-label="Main navigation"
        >
          {navLinks.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
              onClick={closeMobileNav}
            >
              {link.label}
            </NavLink>
          ))}
        </nav>

        <main className="app-main">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
