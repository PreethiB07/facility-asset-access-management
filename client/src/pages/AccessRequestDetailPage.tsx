import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import ErrorState from '../components/common/ErrorState';
import LoadingState from '../components/common/LoadingState';
import PageHeader from '../components/common/PageHeader';
import StatusBadge from '../components/common/StatusBadge';
import { accessRequestApi } from '../services/accessRequest.service';
import { formatAccessPeriod, formatDateTime } from '../utils/dates';
import { getErrorMessage } from '../utils/errors';
import type { AccessRequest } from '../types';

function formatTargetPath(target: AccessRequest['target']): string {
  if (target.type === 'FACILITY') {
    return 'Facility';
  }
  if (target.type === 'AREA') {
    return `Area → ${target.facilityName ?? 'Facility'}`;
  }
  const parts = ['Asset'];
  if (target.areaName) {
    parts.push(`→ ${target.areaName}`);
  }
  if (target.facilityName) {
    parts.push(`→ ${target.facilityName}`);
  }
  return parts.join(' ');
}

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
    return (
      <ErrorState
        title="Not Found"
        message={error || 'The requested resource could not be found.'}
        backTo="/access-requests"
        backLabel="Back to My Requests"
      />
    );
  }

  return (
    <div className="page">
      <nav className="breadcrumb">
        <Link to="/access-requests">My Requests</Link>
        <span>/</span>
        <span>Request #{request.id.slice(0, 8)}</span>
      </nav>

      <PageHeader title={`Access Request #${request.id.slice(0, 8)}`} />

      <section className="detail-section">
        <h2 className="detail-section-title">Status</h2>
        <StatusBadge status={request.status} />
        {request.status === 'PENDING' && (
          <p className="detail-note">Pending manager approval</p>
        )}
      </section>

      <section className="detail-section">
        <h2 className="detail-section-title">Target</h2>
        <div className="detail-grid">
          <div className="detail-item">
            <span className="detail-label">Name</span>
            <span>{request.target.name}</span>
          </div>
          <div className="detail-item">
            <span className="detail-label">Hierarchy</span>
            <span>{formatTargetPath(request.target)}</span>
          </div>
          <div className="detail-item">
            <span className="detail-label">Type</span>
            <span>{request.target.type}</span>
          </div>
        </div>
      </section>

      <section className="detail-section">
        <h2 className="detail-section-title">Access Period</h2>
        <div className="detail-grid">
          <div className="detail-item">
            <span className="detail-label">Access type</span>
            <span>{request.accessType}</span>
          </div>
          <div className="detail-item">
            <span className="detail-label">Period</span>
            <span>{formatAccessPeriod(request.accessType, request.startAt, request.endAt)}</span>
          </div>
        </div>
      </section>

      <section className="detail-section">
        <h2 className="detail-section-title">Reason</h2>
        <p className="detail-text">{request.reason}</p>
      </section>

      <section className="detail-section">
        <h2 className="detail-section-title">Approval</h2>
        <div className="detail-grid">
          <div className="detail-item">
            <span className="detail-label">Submitted</span>
            <span>{formatDateTime(request.createdAt)}</span>
          </div>
          {request.status === 'APPROVED' && request.approvedAt && (
            <div className="detail-item">
              <span className="detail-label">Approved date</span>
              <span>{formatDateTime(request.approvedAt)}</span>
            </div>
          )}
          {request.status === 'REJECTED' && request.approvedAt && (
            <div className="detail-item">
              <span className="detail-label">Rejected date</span>
              <span>{formatDateTime(request.approvedAt)}</span>
            </div>
          )}
          {request.rejectionReason && (
            <div className="detail-item detail-item-wide">
              <span className="detail-label">Rejection reason</span>
              <span>{request.rejectionReason}</span>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
