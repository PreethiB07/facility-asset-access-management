import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import EmptyState from '../components/common/EmptyState';
import ErrorState from '../components/common/ErrorState';
import LoadingState from '../components/common/LoadingState';
import { facilityApi } from '../services/facility.service';
import { getErrorMessage } from '../utils/errors';
import type { Facility } from '../types';

export default function FacilitiesPage() {
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function loadFacilities() {
      setLoading(true);
      setError('');
      try {
        const data = await facilityApi.list();
        setFacilities(data);
      } catch (err) {
        setError(getErrorMessage(err, 'Unable to load facilities.'));
      } finally {
        setLoading(false);
      }
    }

    void loadFacilities();
  }, []);

  if (loading) {
    return <LoadingState message="Loading facilities..." />;
  }

  if (error) {
    return <ErrorState message={error} onRetry={() => window.location.reload()} />;
  }

  if (facilities.length === 0) {
    return (
      <div className="page">
        <h1>Facilities</h1>
        <EmptyState message="No facilities are available." />
      </div>
    );
  }

  return (
    <div className="page">
      <h1>Facilities</h1>
      <p className="text-muted page-intro">Browse facilities and request access.</p>

      <div className="table-wrapper">
        <table className="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Description</th>
              <th>Status</th>
              <th>Approval</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {facilities.map((facility) => (
              <tr key={facility.id}>
                <td>{facility.name}</td>
                <td>{facility.description ?? '—'}</td>
                <td>{facility.isActive ? 'Active' : 'Inactive'}</td>
                <td>{facility.requiresApproval ? 'Required' : 'Auto'}</td>
                <td>
                  <Link to={`/facilities/${facility.id}`} className="link-button">
                    View details
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
