import { NavLink, Outlet } from 'react-router-dom';
import { useAuth, useIsAdmin, useIsManagerOrAdmin } from '../../context/AuthContext';

export default function AppLayout() {
  const { user, logout } = useAuth();
  const isManagerOrAdmin = useIsManagerOrAdmin();
  const isAdmin = useIsAdmin();

  return (
    <div className="app-layout">
      <header className="app-header">
        <div className="header-brand">
          <span className="brand-title">Facility Access</span>
        </div>
        <div className="header-user">
          <span className="user-info">
            {user?.name} ({user?.role})
          </span>
          <button type="button" className="btn btn-secondary btn-sm" onClick={logout}>
            Logout
          </button>
        </div>
      </header>

      <div className="app-body">
        <nav className="app-sidebar" aria-label="Main navigation">
          <NavLink to="/dashboard" className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}>
            Dashboard
          </NavLink>
          <NavLink to="/facilities" className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}>
            Facilities
          </NavLink>
          <NavLink
            to="/access-requests"
            className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
          >
            My Requests
          </NavLink>
          <NavLink to="/my-access" className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}>
            My Access
          </NavLink>
          {isManagerOrAdmin && (
            <NavLink
              to="/manager/requests"
              className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
            >
              Pending Approvals
            </NavLink>
          )}
          {isAdmin && (
            <NavLink to="/admin" className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}>
              Administration
            </NavLink>
          )}
        </nav>

        <main className="app-main">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
