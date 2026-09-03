import ErrorState from '../components/common/ErrorState';
import LoadingState from '../components/common/LoadingState';
import PageHeader from '../components/common/PageHeader';
import { useEffect, useState } from 'react';
import { companyApi } from '../services/company.service';
import { formatDate } from '../utils/dates';
import { getErrorMessage } from '../utils/errors';
import type { CompanyDetails } from '../types';

export default function CompanyDetailsPage() {
  const [company, setCompany] = useState<CompanyDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function loadCompany() {
      setLoading(true);
      setError('');
      try {
        const data = await companyApi.getMyCompany();
        setCompany(data);
      } catch (err) {
        setError(getErrorMessage(err, 'Unable to load company details.'));
      } finally {
        setLoading(false);
      }
    }

    void loadCompany();
  }, []);

  if (loading) {
    return <LoadingState message="Loading company details..." />;
  }

  if (error || !company) {
    return <ErrorState title="Unable to Load" message={error || 'Company details are unavailable.'} />;
  }

  return (
    <div className="page">
      <PageHeader
        title="Company Details"
        description="View your organization's profile and resource summary."
      />

      <section className="detail-section">
        <h2 className="detail-section-title">Overview</h2>
        <div className="detail-grid">
          <div className="detail-item">
            <span className="detail-label">Company name</span>
            <span>{company.name}</span>
          </div>
          <div className="detail-item">
            <span className="detail-label">Company ID</span>
            <span>{company.id}</span>
          </div>
          <div className="detail-item">
            <span className="detail-label">Status</span>
            <span className="badge badge-active">{company.status}</span>
          </div>
          <div className="detail-item">
            <span className="detail-label">Created</span>
            <span>{formatDate(company.createdAt)}</span>
          </div>
          <div className="detail-item">
            <span className="detail-label">Total users</span>
            <span>{company.totalUsers}</span>
          </div>
          <div className="detail-item">
            <span className="detail-label">Total facilities</span>
            <span>{company.totalFacilities}</span>
          </div>
        </div>
      </section>
    </div>
  );
}
