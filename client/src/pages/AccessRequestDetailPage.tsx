import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import ErrorState from '../components/common/ErrorState';
import LoadingState from '../components/common/LoadingState';
import StatusBadge from '../components/common/StatusBadge';
import { accessRequestApi } from '../services/accessRequest.service';
import { formatAccessPeriod, formatDateTime } from '../utils/dates';
import { getErrorMessage } from '../utils/errors';
import type { AccessRequest } from '../types';

export default function AccessRequestDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [request, setRequest] = useState<AccessRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) {
      return;
    }

    const requestId = id;

    async function loadRequest() {
      setLoading(true);
      setError('');
      try {
        const data = await accessRequestApi.getById(requestId);
        setRequest(data);
      } catch (err) {
        setError(getErrorMessage(err, 'Access request not found.'));
      } finally {
        setLoading(false);
      }
    }

    void loadRequest();
  }, [id]);

  if (loading) {
    return <LoadingState message="Loading request details..." />;
  }

  if (error || !request) {
    return <ErrorState message={error || 'Access request not found.'} />;
  }

  return (
    <div className="page">
      <nav className="breadcrumb">
        <Link to="/access-requests">My Requests</Link>
        <span>/</span>
        <span>Request details</span>
      </nav>

      <h1>Access Request</h1>
      <StatusBadge status={request.status} />

      <div className="detail-grid">
        <div className="detail-item">
          <span className="detail-label">Target</span>
          <span>{request.target.name} ({request.target.type})</span>
        </div>
        <div className="detail-item">
          <span className="detail-label">Access type</span>
          <span>{request.accessType}</span>
        </div>
        <div className="detail-item">
          <span className="detail-label">Period</span>
          <span>{formatAccessPeriod(request.accessType, request.startAt, request.endAt)}</span>
        </div>
        <div className="detail-item">
          <span className="detail-label">Reason</span>
          <span>{request.reason}</span>
        </div>
        <div className="detail-item">
          <span className="detail-label">Created</span>
          <span>{formatDateTime(request.createdAt)}</span>
        </div>
        {request.approvedAt && (
          <div className="detail-item">
            <span className="detail-label">Approved at</span>
            <span>{formatDateTime(request.approvedAt)}</span>
          </div>
        )}
        {request.rejectionReason && (
          <div className="detail-item">
            <span className="detail-label">Rejection reason</span>
            <span>{request.rejectionReason}</span>
          </div>
        )}
      </div>
    </div>
  );
}
