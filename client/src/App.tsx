import { Navigate, Route, Routes } from 'react-router-dom';
import AppLayout from './components/layout/AppLayout';
import AccessRequestDetailPage from './pages/AccessRequestDetailPage';
import AccessRequestsPage from './pages/AccessRequestsPage';
import AdminPage from './pages/AdminPage';
import AreaDetailPage from './pages/AreaDetailPage';
import AssetDetailPage from './pages/AssetDetailPage';
import DashboardPage from './pages/DashboardPage';
import FacilitiesPage from './pages/FacilitiesPage';
import FacilityDetailPage from './pages/FacilityDetailPage';
import LoginPage from './pages/LoginPage';
import ManagerRequestsPage from './pages/ManagerRequestsPage';
import MyAccessPage from './pages/MyAccessPage';
import RegisterPage from './pages/RegisterPage';
import AdminRoute from './routes/AdminRoute';
import ManagerRoute from './routes/ManagerRoute';
import ProtectedRoute from './routes/ProtectedRoute';

function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />

      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/facilities" element={<FacilitiesPage />} />
          <Route path="/facilities/:id" element={<FacilityDetailPage />} />
          <Route path="/areas/:id" element={<AreaDetailPage />} />
          <Route path="/assets/:id" element={<AssetDetailPage />} />
          <Route path="/access-requests" element={<AccessRequestsPage />} />
          <Route path="/access-requests/:id" element={<AccessRequestDetailPage />} />
          <Route path="/my-access" element={<MyAccessPage />} />

          <Route element={<ManagerRoute />}>
            <Route path="/manager/requests" element={<ManagerRequestsPage />} />
          </Route>

          <Route element={<AdminRoute />}>
            <Route path="/admin" element={<AdminPage />} />
          </Route>
        </Route>
      </Route>

      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

export default App;
