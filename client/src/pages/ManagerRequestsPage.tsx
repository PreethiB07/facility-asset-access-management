import { useCallback, useEffect, useState } from 'react';
import ConfirmModal from '../components/common/ConfirmModal';
import EmptyState from '../components/common/EmptyState';
import ErrorState from '../components/common/ErrorState';
import LoadingState from '../components/common/LoadingState';
import RejectModal from '../components/manager/RejectModal';
import { useToast } from '../context/ToastContext';
import { accessRequestApi } from '../services/accessRequest.service';
import { formatAccessPeriod, formatDateTime } from '../utils/dates';
import { getErrorMessage } from '../utils/errors';
import type { PendingAccessRequest } from '../types';

function formatBeneficiaryLabel(request: PendingAccessRequest): string {
  if (request.createdBy.id === request.requestedFor.id) {
    return request.requestedFor.name;
  }

  return `${request.requestedFor.name} (created by ${request.createdBy.name})`;
}

export default function ManagerRequestsPage() {
  const { showSuccess, showError } = useToast();
  const [requests, setRequests] = useState<PendingAccessRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [confirmApproveId, setConfirmApproveId] = useState<string | null>(null);

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
    setApprovingId(id);
    try {
      await accessRequestApi.approve(id);
      setRequests((prev) => prev.filter((request) => request.id !== id));
      showSuccess('Access request approved.');
      setConfirmApproveId(null);
    } catch (err) {
      showError(getErrorMessage(err));
    } finally {
      setApprovingId(null);
    }
  }

  async function handleReject(id: string, rejectionReason: string) {
    try {
      await accessRequestApi.reject(id, rejectionReason);
      setRequests((prev) => prev.filter((request) => request.id !== id));
      setRejectingId(null);
      showSuccess('Access request rejected.');
    } catch (err) {
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

      {requests.length === 0 ? (
        <EmptyState
          title="No Pending Approvals"
          message="There are currently no access requests waiting for your review."
        />
      ) : (
        <>
          <div className="table-wrapper desktop-only">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Requested for</th>
                  <th>Created by</th>
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
                      {request.requestedFor.name}
                      <br />
                      <span className="text-muted">{request.requestedFor.email}</span>
                    </td>
                    <td>
                      {request.createdBy.id === request.requestedFor.id
                        ? 'Self'
                        : request.createdBy.name}
                    </td>
                    <td>{request.target.name}</td>
                    <td>{request.target.type}</td>
                    <td>{request.accessType}</td>
                    <td>{formatAccessPeriod(request.accessType, request.startAt, request.endAt)}</td>
                    <td>{request.reason}</td>
                    <td>{formatDateTime(request.createdAt)}</td>
                    <td className="actions-cell">
                      {request.canApprove ? (
                        <>
                          <button
                            type="button"
                            className="btn btn-primary btn-sm"
                            onClick={() => setConfirmApproveId(request.id)}
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
                        </>
                      ) : (
                        <span className="text-muted">You created this request</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="card-list mobile-only">
            {requests.map((request) => (
              <article key={request.id} className="list-card">
                <h3>{request.target.name}</h3>
                <p>
                  <strong>Requested for:</strong> {formatBeneficiaryLabel(request)}
                </p>
                <p className="text-muted">{request.reason}</p>
                <p>{formatAccessPeriod(request.accessType, request.startAt, request.endAt)}</p>
                <div className="actions-cell">
                  {request.canApprove ? (
                    <>
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        onClick={() => setConfirmApproveId(request.id)}
                        disabled={approvingId === request.id}
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        className="btn btn-danger btn-sm"
                        onClick={() => setRejectingId(request.id)}
                      >
                        Reject
                      </button>
                    </>
                  ) : (
                    <span className="text-muted">You created this request</span>
                  )}
                </div>
              </article>
            ))}
          </div>
        </>
      )}

      {confirmApproveId && (
        <ConfirmModal
          title="Approve access request?"
          message="Approve this access request?"
          confirmLabel="Approve"
          loadingLabel="Approving..."
          loading={approvingId === confirmApproveId}
          onCancel={() => setConfirmApproveId(null)}
          onConfirm={() => handleApprove(confirmApproveId)}
        />
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
