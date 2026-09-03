import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import PageHeader from '../components/common/PageHeader';
import LoadingState from '../components/common/LoadingState';
import ErrorState from '../components/common/ErrorState';
import { useAuth, useIsAdmin, useIsManagerOrAdmin } from '../context/AuthContext';
import { accessRequestApi } from '../services/accessRequest.service';
import { assetApi } from '../services/asset.service';
import { facilityApi } from '../services/facility.service';
import { getErrorMessage } from '../utils/errors';

export default function DashboardPage() {
  const { user } = useAuth();
  const isManagerOrAdmin = useIsManagerOrAdmin();
  const isAdmin = useIsAdmin();
  const [myRequests, setMyRequests] = useState(0);
  const [pendingMyRequests, setPendingMyRequests] = useState(0);
  const [approvedMyRequests, setApprovedMyRequests] = useState(0);
  const [pendingApprovals, setPendingApprovals] = useState(0);
  const [approvedAccess, setApprovedAccess] = useState(0);
  const [facilityCount, setFacilityCount] = useState(0);
  const [assetCount, setAssetCount] = useState(0);
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
        setPendingMyRequests(requests.filter((request) => request.status === 'PENDING').length);
        setApprovedMyRequests(requests.filter((request) => request.status === 'APPROVED').length);
        setApprovedAccess(access.length);

        if (isManagerOrAdmin) {
          const pending = await accessRequestApi.listPending();
          setPendingApprovals(pending.length);
        }

        if (isAdmin) {
          const [facilities, assets] = await Promise.all([facilityApi.list(), assetApi.list()]);
          setFacilityCount(facilities.length);
          setAssetCount(assets.length);
        }
      } catch (err) {
        setError(getErrorMessage(err));
      } finally {
        setLoading(false);
      }
    }

    void loadDashboard();
  }, [isManagerOrAdmin, isAdmin]);

  if (loading) {
    return <LoadingState message="Loading dashboard..." />;
  }

  if (error) {
    return <ErrorState message={error} onRetry={() => window.location.reload()} />;
  }

  return (
    <div className="page">
      <PageHeader
        title={`Welcome back, ${user?.name ?? 'there'}`}
        description="Overview of your access requests, permissions, and actions."
      />

      <div className="stats-grid">
        <Link to="/access-requests" className="stat-card">
          <span className="stat-value">{myRequests}</span>
          <span className="stat-label">My Requests</span>
        </Link>

        <Link to="/access-requests?status=PENDING" className="stat-card">
          <span className="stat-value">{pendingMyRequests}</span>
          <span className="stat-label">Pending Requests</span>
        </Link>

        <Link to="/access-requests?status=APPROVED" className="stat-card">
          <span className="stat-value">{approvedMyRequests}</span>
          <span className="stat-label">Approved Requests</span>
        </Link>

        <Link to="/my-access" className="stat-card">
          <span className="stat-value">{approvedAccess}</span>
          <span className="stat-label">Current Access</span>
        </Link>

        {isManagerOrAdmin && (
          <Link to="/manager/requests" className="stat-card stat-card-highlight">
            <span className="stat-value">{pendingApprovals}</span>
            <span className="stat-label">Pending Approvals</span>
          </Link>
        )}

        {isAdmin && (
          <>
            <Link to="/admin" className="stat-card">
              <span className="stat-value">{facilityCount}</span>
              <span className="stat-label">Facilities</span>
            </Link>
            <Link to="/admin" className="stat-card">
              <span className="stat-value">{assetCount}</span>
              <span className="stat-label">Assets</span>
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
