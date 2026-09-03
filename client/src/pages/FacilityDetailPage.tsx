import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import AccessRequestForm from '../components/access/AccessRequestForm';
import ErrorState from '../components/common/ErrorState';
import LoadingState from '../components/common/LoadingState';
import { assetApi } from '../services/asset.service';
import { facilityApi } from '../services/facility.service';
import { getErrorMessage } from '../utils/errors';
import type { Asset, FacilityDetail } from '../types';

export default function FacilityDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [facility, setFacility] = useState<FacilityDetail | null>(null);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) {
      return;
    }

    const facilityId = id;

    async function loadFacility() {
      setLoading(true);
      setError('');
      try {
        const [facilityData, allAssets] = await Promise.all([
          facilityApi.getById(facilityId),
          assetApi.list(),
        ]);
        setFacility(facilityData);
        setAssets(allAssets.filter((asset) => asset.facilityId === facilityId));
      } catch (err) {
        setError(getErrorMessage(err, 'The requested facility could not be found.'));
      } finally {
        setLoading(false);
      }
    }

    void loadFacility();
  }, [id]);

  const areaAssets = useMemo(() => assets.filter((asset) => asset.areaId !== null), [assets]);
  const independentAssets = useMemo(() => assets.filter((asset) => asset.areaId === null), [assets]);

  if (loading) {
    return <LoadingState message="Loading facility..." />;
  }

  if (error || !facility) {
    return <ErrorState message={error || 'The requested facility could not be found.'} />;
  }

  return (
    <div className="page">
      <nav className="breadcrumb">
        <Link to="/facilities">Facilities</Link>
        <span>/</span>
        <span>{facility.name}</span>
      </nav>

      <h1>{facility.name}</h1>
      <p className="text-muted">{facility.description ?? 'No description provided.'}</p>

      <div className="info-grid">
        <div className="info-item">
          <span className="info-label">Status</span>
          <span>{facility.isActive ? 'Active' : 'Inactive'}</span>
        </div>
        <div className="info-item">
          <span className="info-label">Approval</span>
          <span>{facility.requiresApproval ? 'Required' : 'Automatic'}</span>
        </div>
      </div>

      <AccessRequestForm
        target={{ type: 'FACILITY', facilityId: facility.id, name: facility.name }}
      />

      <section className="card">
        <h2>Areas</h2>
        {facility.areas.length === 0 ? (
          <p className="text-muted">No areas in this facility.</p>
        ) : (
          <ul className="link-list">
            {facility.areas.map((area) => (
              <li key={area.id}>
                <Link to={`/areas/${area.id}`}>{area.name}</Link>
                <span className="text-muted"> — {area.description ?? 'No description'}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card">
        <h2>Area Assets</h2>
        {areaAssets.length === 0 ? (
          <p className="text-muted">No assets assigned to areas.</p>
        ) : (
          <ul className="link-list">
            {areaAssets.map((asset) => (
              <li key={asset.id}>
                <Link to={`/assets/${asset.id}`}>{asset.name}</Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card">
        <h2>Independent Facility Assets</h2>
        {independentAssets.length === 0 ? (
          <p className="text-muted">No independent facility assets.</p>
        ) : (
          <ul className="link-list">
            {independentAssets.map((asset) => (
              <li key={asset.id}>
                <Link to={`/assets/${asset.id}`}>{asset.name}</Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
