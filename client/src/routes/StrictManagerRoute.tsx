import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function StrictManagerRoute() {
  const { user } = useAuth();

  if (user?.role !== 'MANAGER') {
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
}
