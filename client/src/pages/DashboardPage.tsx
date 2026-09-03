import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import LoadingState from '../components/common/LoadingState';
import ErrorState from '../components/common/ErrorState';
import { useIsManagerOrAdmin } from '../context/AuthContext';
import { accessRequestApi } from '../services/accessRequest.service';
import { getErrorMessage } from '../utils/errors';

export default function DashboardPage() {
  const isManagerOrAdmin = useIsManagerOrAdmin();
  const [myRequests, setMyRequests] = useState(0);
  const [pendingRequests, setPendingRequests] = useState(0);
  const [approvedAccess, setApprovedAccess] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function loadDashboard() {
      setLoading(true);
      setError('');
      try {
        const [requests, access] = await Promise.all([
          accessRequestApi.list(),
          accessRequestApi.getMyAccess(),
        ]);

        setMyRequests(requests.length);
        setApprovedAccess(access.length);

        if (isManagerOrAdmin) {
          const pending = await accessRequestApi.listPending();
          setPendingRequests(pending.length);
        }
      } catch (err) {
        setError(getErrorMessage(err));
      } finally {
        setLoading(false);
      }
    }

    void loadDashboard();
  }, [isManagerOrAdmin]);

  if (loading) {
    return <LoadingState message="Loading dashboard..." />;
  }

  if (error) {
    return <ErrorState message={error} onRetry={() => window.location.reload()} />;
  }

  return (
    <div className="page">
      <h1>Dashboard</h1>
      <p className="text-muted page-intro">Overview of your access requests and permissions.</p>

      <div className="stats-grid">
        <Link to="/access-requests" className="stat-card">
          <span className="stat-value">{myRequests}</span>
          <span className="stat-label">My Requests</span>
        </Link>

        {isManagerOrAdmin && (
          <Link to="/manager/requests" className="stat-card">
            <span className="stat-value">{pendingRequests}</span>
            <span className="stat-label">Pending Requests</span>
          </Link>
        )}

        <Link to="/my-access" className="stat-card">
          <span className="stat-value">{approvedAccess}</span>
          <span className="stat-label">Approved Access</span>
        </Link>
      </div>
    </div>
  );
}
