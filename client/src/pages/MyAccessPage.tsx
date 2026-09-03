import { useEffect, useState } from 'react';
import EmptyState from '../components/common/EmptyState';
import ErrorState from '../components/common/ErrorState';
import LoadingState from '../components/common/LoadingState';
import { accessRequestApi } from '../services/accessRequest.service';
import { formatDateTime, formatValidUntil } from '../utils/dates';
import { getErrorMessage } from '../utils/errors';
import type { CurrentAccess } from '../types';

export default function MyAccessPage() {
  const [accessList, setAccessList] = useState<CurrentAccess[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function loadAccess() {
      setLoading(true);
      setError('');
      try {
        const data = await accessRequestApi.getMyAccess();
        setAccessList(data);
      } catch (err) {
        setError(getErrorMessage(err, 'Unable to load current access.'));
      } finally {
        setLoading(false);
      }
    }

    void loadAccess();
  }, []);

  if (loading) {
    return <LoadingState message="Loading current access..." />;
  }

  if (error) {
    return <ErrorState message={error} onRetry={() => window.location.reload()} />;
  }

  if (accessList.length === 0) {
    return (
      <div className="page">
        <h1>My Current Access</h1>
        <EmptyState
          message="You currently have no active access."
          actionLabel="Browse Facilities"
          actionTo="/facilities"
        />
      </div>
    );
  }

  return (
    <div className="page">
      <h1>My Current Access</h1>
      <p className="text-muted page-intro">Approved access that is currently valid.</p>

      <div className="table-wrapper">
        <table className="data-table">
          <thead>
            <tr>
              <th>Target</th>
              <th>Type</th>
              <th>Facility</th>
              <th>Area</th>
              <th>Access type</th>
              <th>Valid from</th>
              <th>Valid until</th>
            </tr>
          </thead>
          <tbody>
            {accessList.map((access) => (
              <tr key={access.id}>
                <td>{access.target.name}</td>
                <td>{access.target.type}</td>
                <td>{access.target.facilityName ?? '—'}</td>
                <td>{access.target.areaName ?? '—'}</td>
                <td>{access.accessType}</td>
                <td>{formatDateTime(access.startAt)}</td>
                <td>{formatValidUntil(access.accessType, access.startAt, access.endAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
