import { useCallback, useEffect, useState } from 'react';
import EmptyState from '../components/common/EmptyState';
import ErrorState from '../components/common/ErrorState';
import LoadingState from '../components/common/LoadingState';
import RejectModal from '../components/manager/RejectModal';
import { accessRequestApi } from '../services/accessRequest.service';
import { formatAccessPeriod, formatDateTime } from '../utils/dates';
import { getErrorMessage } from '../utils/errors';
import type { PendingAccessRequest } from '../types';

export default function ManagerRequestsPage() {
  const [requests, setRequests] = useState<PendingAccessRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [actionError, setActionError] = useState('');
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [approvingId, setApprovingId] = useState<string | null>(null);

  const loadPending = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await accessRequestApi.listPending();
      setRequests(data);
    } catch (err) {
      setError(getErrorMessage(err, 'Unable to load pending approvals.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadPending();
  }, [loadPending]);

  async function handleApprove(id: string) {
    const confirmed = window.confirm('Approve this access request?');
    if (!confirmed) {
      return;
    }

    setApprovingId(id);
    setActionError('');
    setSuccessMessage('');
    try {
      await accessRequestApi.approve(id);
      setRequests((prev) => prev.filter((request) => request.id !== id));
      setSuccessMessage('Request approved successfully.');
    } catch (err) {
      setActionError(getErrorMessage(err));
    } finally {
      setApprovingId(null);
    }
  }

  async function handleReject(id: string, rejectionReason: string) {
    setActionError('');
    setSuccessMessage('');
    try {
      await accessRequestApi.reject(id, rejectionReason);
      setRequests((prev) => prev.filter((request) => request.id !== id));
      setRejectingId(null);
      setSuccessMessage('Request rejected successfully.');
    } catch (err) {
      setActionError(getErrorMessage(err));
      throw err;
    }
  }

  if (loading) {
    return <LoadingState message="Loading pending approvals..." />;
  }

  if (error) {
    return <ErrorState message={error} onRetry={() => void loadPending()} />;
  }

  return (
    <div className="page">
      <h1>Pending Approvals</h1>
      <p className="text-muted page-intro">Review and action access requests awaiting approval.</p>

      {successMessage && <div className="alert alert-success">{successMessage}</div>}
      {actionError && <div className="alert alert-error">{actionError}</div>}

      {requests.length === 0 ? (
        <EmptyState message="There are no pending approval requests." />
      ) : (
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Requester</th>
                <th>Target</th>
                <th>Type</th>
                <th>Access</th>
                <th>Period</th>
                <th>Reason</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {requests.map((request) => (
                <tr key={request.id}>
                  <td>
                    {request.requester.name}
                    <br />
                    <span className="text-muted">{request.requester.email}</span>
                  </td>
                  <td>{request.target.name}</td>
                  <td>{request.target.type}</td>
                  <td>{request.accessType}</td>
                  <td>{formatAccessPeriod(request.accessType, request.startAt, request.endAt)}</td>
                  <td>{request.reason}</td>
                  <td>{formatDateTime(request.createdAt)}</td>
                  <td className="actions-cell">
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      onClick={() => void handleApprove(request.id)}
                      disabled={approvingId === request.id}
                    >
                      {approvingId === request.id ? 'Approving...' : 'Approve'}
                    </button>
                    <button
                      type="button"
                      className="btn btn-danger btn-sm"
                      onClick={() => setRejectingId(request.id)}
                    >
                      Reject
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {rejectingId && (
        <RejectModal
          requestId={rejectingId}
          onCancel={() => setRejectingId(null)}
          onReject={handleReject}
        />
      )}
    </div>
  );
}
