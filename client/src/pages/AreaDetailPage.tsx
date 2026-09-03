import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import AccessRequestForm from '../components/access/AccessRequestForm';
import ErrorState from '../components/common/ErrorState';
import LoadingState from '../components/common/LoadingState';
import { areaApi } from '../services/area.service';
import { facilityApi } from '../services/facility.service';
import { getErrorMessage } from '../utils/errors';
import type { AreaDetail, Asset } from '../types';

export default function AreaDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [area, setArea] = useState<AreaDetail | null>(null);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [facilityName, setFacilityName] = useState('');

  useEffect(() => {
    if (!id) {
      return;
    }

    const areaId = id;

    async function loadArea() {
      setLoading(true);
      setError('');
      try {
        const areaData = await areaApi.getById(areaId);
        const [areaAssets, facilityData] = await Promise.all([
          areaApi.listAssets(areaId),
          facilityApi.getById(areaData.facilityId),
        ]);
        setArea(areaData);
        setAssets(areaAssets);
        setFacilityName(facilityData.name);
      } catch (err) {
        setError(getErrorMessage(err, 'The requested area could not be found.'));
      } finally {
        setLoading(false);
      }
    }

    void loadArea();
  }, [id]);

  if (loading) {
    return <LoadingState message="Loading area details..." />;
  }

  if (error || !area) {
    return <ErrorState message={error || 'The requested area could not be found.'} />;
  }

  return (
    <div className="page">
      <nav className="breadcrumb">
        <Link to="/facilities">Facilities</Link>
        <span>/</span>
        <Link to={`/facilities/${area.facilityId}`}>Facility</Link>
        <span>/</span>
        <span>{area.name}</span>
      </nav>

      <h1>{area.name}</h1>
      <p className="text-muted">{area.description ?? 'No description provided.'}</p>

      <div className="info-grid">
        <div className="info-item">
          <span className="info-label">Status</span>
          <span>{area.isActive ? 'Active' : 'Inactive'}</span>
        </div>
        <div className="info-item">
          <span className="info-label">Approval</span>
          <span>{area.requiresApproval ? 'Required' : 'Automatic'}</span>
        </div>
        <div className="info-item">
          <span className="info-label">Parent facility</span>
          <Link to={`/facilities/${area.facilityId}`}>View facility</Link>
        </div>
      </div>

      <AccessRequestForm
        target={{
          type: 'AREA',
          areaId: area.id,
          facilityId: area.facilityId,
          name: area.name,
          facilityName,
        }}
      />

      <section className="card">
        <h2>Assets in this area</h2>
        {assets.length === 0 ? (
          <p className="text-muted">No assets in this area.</p>
        ) : (
          <ul className="link-list">
            {assets.map((asset) => (
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
