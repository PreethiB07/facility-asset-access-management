import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import ApprovalBadge from '../components/common/ApprovalBadge';
import EmptyState from '../components/common/EmptyState';
import ErrorState from '../components/common/ErrorState';
import LoadingState from '../components/common/LoadingState';
import PageHeader from '../components/common/PageHeader';
import ResourceStatusBadge from '../components/common/ResourceStatusBadge';
import { assetApi } from '../services/asset.service';
import { facilityApi } from '../services/facility.service';
import { getErrorMessage } from '../utils/errors';
import type { Asset, Facility, FacilityDetail } from '../types';

interface FacilityCardData {
  facility: Facility;
  areaCount: number;
  assetCount: number;
}

export default function FacilitiesPage() {
  const [facilities, setFacilities] = useState<FacilityCardData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function loadFacilities() {
      setLoading(true);
      setError('');
      try {
        const [facilityList, assets] = await Promise.all([facilityApi.list(), assetApi.list()]);
        const details = await Promise.all(
          facilityList.map((facility) => facilityApi.getById(facility.id)),
        );

        const cards = facilityList.map((facility, index) => {
          const detail = details[index] as FacilityDetail;
          const facilityAssets = assets.filter((asset: Asset) => asset.facilityId === facility.id);
          return {
            facility,
            areaCount: detail.areas.length,
            assetCount: facilityAssets.length,
          };
        });

        setFacilities(cards);
      } catch (err) {
        setError(getErrorMessage(err, "We couldn't load the facilities."));
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
    return (
      <ErrorState
        message={error}
        onRetry={() => window.location.reload()}
        backTo="/dashboard"
        backLabel="Back to dashboard"
      />
    );
  }

  if (facilities.length === 0) {
    return (
      <div className="page">
        <PageHeader title="Facilities" description="Browse facilities and request access." />
        <EmptyState
          title="No Facilities"
          message="No facilities are available right now."
          actionLabel="Back to Dashboard"
          actionTo="/dashboard"
        />
      </div>
    );
  }

  return (
    <div className="page">
      <PageHeader
        title="Facilities"
        description="Browse facilities, areas, and assets to request access."
      />

      <div className="facility-grid">
        {facilities.map(({ facility, areaCount, assetCount }) => (
          <article key={facility.id} className="facility-card">
            <div className="facility-card-header">
              <h2>{facility.name}</h2>
              <ResourceStatusBadge active={facility.isActive} />
            </div>
            <p className="facility-card-description">
              {facility.description ?? 'No description provided.'}
            </p>
            <div className="facility-card-meta">
              <ApprovalBadge requiresApproval={facility.requiresApproval} />
              <span className="meta-count">
                {areaCount} {areaCount === 1 ? 'Area' : 'Areas'}
              </span>
              <span className="meta-count">
                {assetCount} {assetCount === 1 ? 'Asset' : 'Assets'}
              </span>
            </div>
            <Link to={`/facilities/${facility.id}`} className="btn btn-secondary btn-sm">
              View Details
            </Link>
          </article>
        ))}
      </div>
    </div>
  );
}
