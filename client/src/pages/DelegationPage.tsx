import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import EmptyState from '../components/common/EmptyState';
import ErrorState from '../components/common/ErrorState';
import LoadingState from '../components/common/LoadingState';
import PageHeader from '../components/common/PageHeader';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { delegationApi } from '../services/delegation.service';
import { employeeApi } from '../services/employee.service';
import { formatDateTime, fromDatetimeLocalValue } from '../utils/dates';
import { getErrorMessage } from '../utils/errors';
import type { ApprovalDelegation, EmployeeSummary } from '../types';

type DelegationStatus = 'ACTIVE' | 'SCHEDULED' | 'EXPIRED';

function getDelegationStatus(delegation: ApprovalDelegation, now = new Date()): DelegationStatus {
  const from = new Date(delegation.effectiveFrom);
  const until = new Date(delegation.effectiveUntil);

  if (until <= now) {
    return 'EXPIRED';
  }

  if (from > now) {
    return 'SCHEDULED';
  }

  return 'ACTIVE';
}

function statusLabel(status: DelegationStatus): string {
  if (status === 'ACTIVE') {
    return 'Active';
  }

  if (status === 'SCHEDULED') {
    return 'Scheduled';
  }

  return 'Expired';
}

interface FormErrors {
  delegatedManagerId?: string;
  effectiveFrom?: string;
  effectiveUntil?: string;
}

function validateForm(
  delegatedManagerId: string,
  effectiveFrom: string,
  effectiveUntil: string,
): FormErrors {
  const errors: FormErrors = {};

  if (!delegatedManagerId) {
    errors.delegatedManagerId = 'Please select a manager';
  }

  if (!effectiveFrom) {
    errors.effectiveFrom = 'Start date and time is required';
  } else if (Number.isNaN(new Date(effectiveFrom).getTime())) {
    errors.effectiveFrom = 'Please enter a valid start date and time';
  }

  if (!effectiveUntil) {
    errors.effectiveUntil = 'End date and time is required';
  } else if (Number.isNaN(new Date(effectiveUntil).getTime())) {
    errors.effectiveUntil = 'Please enter a valid end date and time';
  } else if (
    effectiveFrom &&
    !Number.isNaN(new Date(effectiveFrom).getTime()) &&
    new Date(effectiveUntil) <= new Date(effectiveFrom)
  ) {
    errors.effectiveUntil = 'End date must be after the start date';
  }

  return errors;
}

export default function DelegationPage() {
  const { user } = useAuth();
  const { showSuccess, showError } = useToast();
  const [delegations, setDelegations] = useState<ApprovalDelegation[]>([]);
  const [managers, setManagers] = useState<EmployeeSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [delegatedManagerId, setDelegatedManagerId] = useState('');
  const [effectiveFrom, setEffectiveFrom] = useState('');
  const [effectiveUntil, setEffectiveUntil] = useState('');
  const [formErrors, setFormErrors] = useState<FormErrors>({});

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [delegationData, employeeData] = await Promise.all([
        delegationApi.list(),
        employeeApi.list(),
      ]);
      setDelegations(delegationData);
      setManagers(
        employeeData.filter(
          (employee) => employee.role === 'MANAGER' && employee.id !== user?.id,
        ),
      );
    } catch (err) {
      setError(getErrorMessage(err, 'Unable to load delegation settings.'));
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) {
      return;
    }

    void loadData();
  }, [loadData, user?.id]);

  const currentDelegation = useMemo(() => {
    if (delegations.length === 0) {
      return null;
    }

    const activeOrScheduled = delegations.find((delegation) => {
      const status = getDelegationStatus(delegation);
      return status === 'ACTIVE' || status === 'SCHEDULED';
    });

    return activeOrScheduled ?? delegations[0];
  }, [delegations]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();

    const validationErrors = validateForm(delegatedManagerId, effectiveFrom, effectiveUntil);
    setFormErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) {
      return;
    }

    setSubmitting(true);
    try {
      const created = await delegationApi.create({
        delegatedManagerId,
        effectiveFrom: fromDatetimeLocalValue(effectiveFrom),
        effectiveUntil: fromDatetimeLocalValue(effectiveUntil),
      });
      setDelegations((prev) => [created, ...prev]);
      setDelegatedManagerId('');
      setEffectiveFrom('');
      setEffectiveUntil('');
      setFormErrors({});
      showSuccess('Approval delegation created.');
    } catch (err) {
      showError(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return <LoadingState message="Loading approval delegation..." />;
  }

  if (error) {
    return <ErrorState message={error} onRetry={() => void loadData()} />;
  }

  return (
    <div className="page">
      <PageHeader
        title="Approval Delegation"
        description="Delegate your approval authority to another manager for a defined period."
      />

      <section className="detail-section">
        <h2 className="detail-section-title">Current delegation</h2>
        {currentDelegation ? (
          <div className="detail-grid">
            <div className="detail-item">
              <span className="detail-label">Delegate</span>
              <span>{currentDelegation.delegatedManager.name}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">Status</span>
              <span className="badge badge-active">
                {statusLabel(getDelegationStatus(currentDelegation))}
              </span>
            </div>
            <div className="detail-item">
              <span className="detail-label">Effective from</span>
              <span>{formatDateTime(currentDelegation.effectiveFrom)}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">Effective until</span>
              <span>{formatDateTime(currentDelegation.effectiveUntil)}</span>
            </div>
          </div>
        ) : (
          <EmptyState
            title="No delegation configured"
            message="Create a delegation below to temporarily assign approval authority."
          />
        )}
      </section>

      <section className="card access-form-card">
        <h2>Create delegation</h2>
        <form onSubmit={handleSubmit} noValidate>
          <div className="form-group">
            <label htmlFor="delegatedManager">
              Delegate manager <span className="required-indicator">*</span>
            </label>
            <select
              id="delegatedManager"
              value={delegatedManagerId}
              onChange={(event) => setDelegatedManagerId(event.target.value)}
            >
              <option value="">Select a manager</option>
              {managers.map((manager) => (
                <option key={manager.id} value={manager.id}>
                  {manager.name} ({manager.email})
                </option>
              ))}
            </select>
            {managers.length === 0 && (
              <p className="field-hint">No other managers are available in your company.</p>
            )}
            {formErrors.delegatedManagerId && (
              <p className="field-error">{formErrors.delegatedManagerId}</p>
            )}
          </div>

          <div className="form-group">
            <label htmlFor="effectiveFrom">
              Start date <span className="required-indicator">*</span>
            </label>
            <input
              id="effectiveFrom"
              type="datetime-local"
              value={effectiveFrom}
              onChange={(event) => setEffectiveFrom(event.target.value)}
            />
            {formErrors.effectiveFrom && <p className="field-error">{formErrors.effectiveFrom}</p>}
          </div>

          <div className="form-group">
            <label htmlFor="effectiveUntil">
              End date <span className="required-indicator">*</span>
            </label>
            <input
              id="effectiveUntil"
              type="datetime-local"
              value={effectiveUntil}
              onChange={(event) => setEffectiveUntil(event.target.value)}
            />
            {formErrors.effectiveUntil && <p className="field-error">{formErrors.effectiveUntil}</p>}
          </div>

          <button type="submit" className="btn btn-primary" disabled={submitting || managers.length === 0}>
            {submitting ? 'Creating...' : 'Create delegation'}
          </button>
        </form>
      </section>

      {delegations.length > 0 && (
        <section className="detail-section">
          <h2 className="detail-section-title">Delegation history</h2>
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Delegate</th>
                  <th>Status</th>
                  <th>Effective period</th>
                </tr>
              </thead>
              <tbody>
                {delegations.map((delegation) => {
                  const status = getDelegationStatus(delegation);
                  return (
                    <tr key={delegation.id}>
                      <td>{delegation.delegatedManager.name}</td>
                      <td>
                        <span className="badge badge-active">{statusLabel(status)}</span>
                      </td>
                      <td>
                        {formatDateTime(delegation.effectiveFrom)} –{' '}
                        {formatDateTime(delegation.effectiveUntil)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
