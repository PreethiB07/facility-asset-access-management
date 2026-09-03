import { useCallback, useEffect, useState, type FormEvent } from 'react';
import ApprovalHelpText from '../common/ApprovalHelpText';
import ConfirmModal from '../common/ConfirmModal';
import EmptyState from '../common/EmptyState';
import ErrorState from '../common/ErrorState';
import LoadingState from '../common/LoadingState';
import ResourceStatusBadge from '../common/ResourceStatusBadge';
import { useToast } from '../../context/ToastContext';
import { facilityApi, type FacilityPayload } from '../../services/facility.service';
import { getErrorMessage } from '../../utils/errors';
import type { Facility } from '../../types';

interface FacilityFormState {
  name: string;
  description: string;
  requiresApproval: boolean;
  isActive: boolean;
}

const emptyForm: FacilityFormState = {
  name: '',
  description: '',
  requiresApproval: true,
  isActive: true,
};

export default function FacilityAdminPanel() {
  const { showSuccess, showError } = useToast();
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Facility | null>(null);
  const [form, setForm] = useState<FacilityFormState>(emptyForm);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [confirmDeactivate, setConfirmDeactivate] = useState<Facility | null>(null);

  const loadFacilities = useCallback(async () => {
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
  }, []);

  useEffect(() => {
    void loadFacilities();
  }, [loadFacilities]);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setFormErrors({});
    setFormOpen(true);
  }

  function openEdit(facility: Facility) {
    setEditing(facility);
    setForm({
      name: facility.name,
      description: facility.description ?? '',
      requiresApproval: facility.requiresApproval,
      isActive: facility.isActive,
    });
    setFormErrors({});
    setFormOpen(true);
  }

  function validate(): Record<string, string> {
    const errors: Record<string, string> = {};
    if (!form.name.trim()) {
      errors.name = 'Facility name is required.';
    }
    return errors;
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const errors = validate();
    setFormErrors(errors);
    if (Object.keys(errors).length > 0) {
      return;
    }

    const payload: FacilityPayload = {
      name: form.name.trim(),
      description: form.description.trim() || null,
      requiresApproval: form.requiresApproval,
      isActive: form.isActive,
    };

    setSubmitting(true);
    try {
      if (editing) {
        await facilityApi.update(editing.id, payload);
        showSuccess('Facility updated successfully.');
      } else {
        await facilityApi.create(payload);
        showSuccess('Facility created successfully.');
      }
      setFormOpen(false);
      await loadFacilities();
    } catch (err) {
      showError(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  async function toggleActive(facility: Facility) {
    setTogglingId(facility.id);
    try {
      await facilityApi.update(facility.id, { isActive: !facility.isActive });
      showSuccess(facility.isActive ? 'Facility deactivated.' : 'Facility activated.');
      await loadFacilities();
    } catch (err) {
      showError(getErrorMessage(err));
    } finally {
      setTogglingId(null);
    }
  }

  if (loading) {
    return <LoadingState message="Loading facilities..." />;
  }

  if (error) {
    return <ErrorState message={error} onRetry={() => void loadFacilities()} />;
  }

  return (
    <section className="admin-panel">
      <div className="panel-header">
        <h2>Facilities</h2>
        <button type="button" className="btn btn-primary btn-sm" onClick={openCreate}>
          + Add Facility
        </button>
      </div>

      {facilities.length === 0 ? (
        <EmptyState
          title="No Facilities"
          message="Create your first facility to get started."
          actionLabel="Add Facility"
          onAction={openCreate}
        />
      ) : (
        <>
          <div className="table-wrapper desktop-only">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Description</th>
                  <th>Status</th>
                  <th>Approval</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {facilities.map((facility) => (
                  <tr key={facility.id}>
                    <td>{facility.name}</td>
                    <td>{facility.description ?? '—'}</td>
                    <td>
                      <ResourceStatusBadge active={facility.isActive} />
                    </td>
                    <td>{facility.requiresApproval ? 'Required' : 'Automatic'}</td>
                    <td className="actions-cell">
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => openEdit(facility)}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() =>
                          facility.isActive
                            ? setConfirmDeactivate(facility)
                            : void toggleActive(facility)
                        }
                        disabled={togglingId === facility.id}
                      >
                        {togglingId === facility.id
                          ? 'Saving...'
                          : facility.isActive
                            ? 'Deactivate'
                            : 'Activate'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="card-list mobile-only">
            {facilities.map((facility) => (
              <article key={facility.id} className="list-card">
                <h3>{facility.name}</h3>
                <p className="text-muted">{facility.description ?? 'No description'}</p>
                <p>
                  <strong>Status:</strong> {facility.isActive ? 'Active' : 'Inactive'}
                </p>
                <p>
                  <strong>Approval:</strong>{' '}
                  {facility.requiresApproval ? 'Required' : 'Automatic'}
                </p>
                <div className="actions-cell">
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => openEdit(facility)}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() =>
                      facility.isActive ? setConfirmDeactivate(facility) : void toggleActive(facility)
                    }
                    disabled={togglingId === facility.id}
                  >
                    {facility.isActive ? 'Deactivate' : 'Activate'}
                  </button>
                </div>
              </article>
            ))}
          </div>
        </>
      )}

      {confirmDeactivate && (
        <ConfirmModal
          title={`Deactivate ${confirmDeactivate.name}?`}
          message="Existing historical access requests will be retained."
          confirmLabel="Deactivate"
          loadingLabel="Deactivating..."
          loading={togglingId === confirmDeactivate.id}
          onCancel={() => setConfirmDeactivate(null)}
          onConfirm={async () => {
            await toggleActive(confirmDeactivate);
            setConfirmDeactivate(null);
          }}
        />
      )}

      {formOpen && (
        <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="facility-form-title">
          <div className="modal modal-wide">
            <h2 id="facility-form-title">{editing ? 'Edit facility' : 'Create facility'}</h2>
            <form onSubmit={handleSubmit} noValidate>
              <div className="form-group">
                <label htmlFor="facilityName">
                  Name <span className="required-indicator">*</span>
                </label>
                <input
                  id="facilityName"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Facility name"
                />
                {formErrors.name && <span className="field-error">{formErrors.name}</span>}
              </div>

              <div className="form-group">
                <label htmlFor="facilityDescription">Description</label>
                <textarea
                  id="facilityDescription"
                  rows={3}
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Optional description"
                />
              </div>

              <div className="form-group checkbox-group">
                <label htmlFor="facilityRequiresApproval">
                  <input
                    id="facilityRequiresApproval"
                    type="checkbox"
                    checked={form.requiresApproval}
                    onChange={(e) => setForm({ ...form, requiresApproval: e.target.checked })}
                  />
                  Requires approval
                </label>
                <ApprovalHelpText />
              </div>

              {editing && (
                <div className="form-group checkbox-group">
                  <label htmlFor="facilityIsActive">
                    <input
                      id="facilityIsActive"
                      type="checkbox"
                      checked={form.isActive}
                      onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                    />
                    Active
                  </label>
                </div>
              )}

              <div className="modal-actions">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setFormOpen(false)}
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? 'Saving...' : editing ? 'Save changes' : 'Create facility'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}
