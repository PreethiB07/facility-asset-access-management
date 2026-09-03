import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import AccessRequestForm from '../components/access/AccessRequestForm';
import ErrorState from '../components/common/ErrorState';
import LoadingState from '../components/common/LoadingState';
import { assetApi } from '../services/asset.service';
import { getErrorMessage } from '../utils/errors';
import type { Asset } from '../types';

export default function AssetDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [asset, setAsset] = useState<Asset | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) {
      return;
    }

    const assetId = id;

    async function loadAsset() {
      setLoading(true);
      setError('');
      try {
        const data = await assetApi.getById(assetId);
        setAsset(data);
      } catch (err) {
        setError(getErrorMessage(err, 'The requested asset could not be found.'));
      } finally {
        setLoading(false);
      }
    }

    void loadAsset();
  }, [id]);

  if (loading) {
    return <LoadingState message="Loading asset..." />;
  }

  if (error || !asset) {
    return <ErrorState message={error || 'The requested asset could not be found.'} />;
  }

  return (
    <div className="page">
      <nav className="breadcrumb">
        <Link to="/facilities">Facilities</Link>
        <span>/</span>
        <Link to={`/facilities/${asset.facilityId}`}>Facility</Link>
        {asset.areaId && (
          <>
            <span>/</span>
            <Link to={`/areas/${asset.areaId}`}>Area</Link>
          </>
        )}
        <span>/</span>
        <span>{asset.name}</span>
      </nav>

      <h1>{asset.name}</h1>
      <p className="text-muted">{asset.description ?? 'No description provided.'}</p>

      <div className="info-grid">
        <div className="info-item">
          <span className="info-label">Facility</span>
          <Link to={`/facilities/${asset.facilityId}`}>View facility</Link>
        </div>
        <div className="info-item">
          <span className="info-label">Area</span>
          {asset.areaId ? (
            <Link to={`/areas/${asset.areaId}`}>View area</Link>
          ) : (
            <span>Independent facility asset</span>
          )}
        </div>
        <div className="info-item">
          <span className="info-label">Status</span>
          <span>{asset.isActive ? 'Active' : 'Inactive'}</span>
        </div>
        <div className="info-item">
          <span className="info-label">Approval</span>
          <span>{asset.requiresApproval ? 'Required' : 'Automatic'}</span>
        </div>
      </div>

      <AccessRequestForm target={{ type: 'ASSET', assetId: asset.id, name: asset.name }} />
    </div>
  );
}
