import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import EmptyState from '../components/common/EmptyState';
import ErrorState from '../components/common/ErrorState';
import LoadingState from '../components/common/LoadingState';
import StatusBadge from '../components/common/StatusBadge';
import { accessRequestApi } from '../services/accessRequest.service';
import { formatAccessPeriod, formatDateTime } from '../utils/dates';
import { getErrorMessage } from '../utils/errors';
import type { AccessRequest, AccessRequestStatus } from '../types';

const STATUS_OPTIONS: Array<{ label: string; value: AccessRequestStatus | '' }> = [
  { label: 'All statuses', value: '' },
  { label: 'Pending', value: 'PENDING' },
  { label: 'Approved', value: 'APPROVED' },
  { label: 'Rejected', value: 'REJECTED' },
];

export default function AccessRequestsPage() {
  const [requests, setRequests] = useState<AccessRequest[]>([]);
  const [statusFilter, setStatusFilter] = useState<AccessRequestStatus | ''>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function loadRequests() {
      setLoading(true);
      setError('');
      try {
        const data = await accessRequestApi.list(statusFilter || undefined);
        setRequests(data);
      } catch (err) {
        setError(getErrorMessage(err, 'Unable to load access requests.'));
      } finally {
        setLoading(false);
      }
    }

    void loadRequests();
  }, [statusFilter]);

  if (loading) {
    return <LoadingState message="Loading requests..." />;
  }

  if (error) {
    return <ErrorState message={error} onRetry={() => window.location.reload()} />;
  }

  return (
    <div className="page">
      <h1>My Access Requests</h1>

      <div className="filter-row">
        <label htmlFor="statusFilter">Filter by status</label>
        <select
          id="statusFilter"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as AccessRequestStatus | '')}
        >
          {STATUS_OPTIONS.map((option) => (
            <option key={option.label} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      {requests.length === 0 ? (
        <EmptyState
          message="You haven't submitted any access requests yet."
          actionLabel="Browse Facilities"
          actionTo="/facilities"
        />
      ) : (
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Target</th>
                <th>Type</th>
                <th>Access</th>
                <th>Period</th>
                <th>Status</th>
                <th>Reason</th>
                <th>Created</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {requests.map((request) => (
                <tr key={request.id}>
                  <td>{request.target.name}</td>
                  <td>{request.target.type}</td>
                  <td>{request.accessType}</td>
                  <td>{formatAccessPeriod(request.accessType, request.startAt, request.endAt)}</td>
                  <td>
                    <StatusBadge status={request.status} />
                  </td>
                  <td>{request.reason}</td>
                  <td>{formatDateTime(request.createdAt)}</td>
                  <td>
                    <Link to={`/access-requests/${request.id}`} className="link-button">
                      View details
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
