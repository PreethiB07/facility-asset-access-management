import { useCallback, useEffect, useState, type FormEvent } from 'react';
import ApprovalHelpText from '../common/ApprovalHelpText';
import ErrorState from '../common/ErrorState';
import LoadingState from '../common/LoadingState';
import { useToast } from '../../context/ToastContext';
import { areaApi, type AreaPayload } from '../../services/area.service';
import { facilityApi } from '../../services/facility.service';
import { getErrorMessage } from '../../utils/errors';
import type { Area, Facility } from '../../types';

interface AreaFormState {
  facilityId: string;
  name: string;
  description: string;
  requiresApproval: boolean;
  isActive: boolean;
}

const emptyForm: AreaFormState = {
  facilityId: '',
  name: '',
  description: '',
  requiresApproval: true,
  isActive: true,
};

export default function AreaAdminPanel() {
  const { showSuccess, showError } = useToast();
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [areas, setAreas] = useState<Array<Area & { facilityId: string; facilityName: string }>>(
    [],
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<(Area & { facilityId: string }) | null>(null);
  const [form, setForm] = useState<AreaFormState>(emptyForm);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const facilityList = await facilityApi.list();
      setFacilities(facilityList);

      const areaGroups = await Promise.all(
        facilityList.map(async (facility) => {
          const facilityAreas = await areaApi.listByFacility(facility.id);
          return facilityAreas.map((area) => ({
            ...area,
            facilityId: facility.id,
            facilityName: facility.name,
          }));
        }),
      );
      setAreas(areaGroups.flat());
    } catch (err) {
      setError(getErrorMessage(err, 'Unable to load areas.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  function openCreate() {
    setEditing(null);
    setForm({
      ...emptyForm,
      facilityId: facilities[0]?.id ?? '',
    });
    setFormErrors({});
    setFormOpen(true);
  }

  function openEdit(area: Area & { facilityId: string }) {
    setEditing(area);
    setForm({
      facilityId: area.facilityId,
      name: area.name,
      description: area.description ?? '',
      requiresApproval: area.requiresApproval,
      isActive: area.isActive,
    });
    setFormErrors({});
    setFormOpen(true);
  }

  function validate(): Record<string, string> {
    const errors: Record<string, string> = {};
    if (!form.facilityId) {
      errors.facilityId = 'A facility is required';
    }
    if (!form.name.trim()) {
      errors.name = 'Area name is required';
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

    const payload: AreaPayload = {
      name: form.name.trim(),
      description: form.description.trim() || null,
      requiresApproval: form.requiresApproval,
      isActive: form.isActive,
    };

    setSubmitting(true);
    try {
      if (editing) {
        await areaApi.update(editing.id, payload);
        showSuccess('Area updated successfully.');
      } else {
        await areaApi.create(form.facilityId, payload);
        showSuccess('Area created successfully.');
      }
      setFormOpen(false);
      await loadData();
    } catch (err) {
      showError(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  async function toggleActive(area: Area & { facilityId: string }) {
    setTogglingId(area.id);
    try {
      await areaApi.update(area.id, { isActive: !area.isActive });
      showSuccess(area.isActive ? 'Area deactivated.' : 'Area activated.');
      await loadData();
    } catch (err) {
      showError(getErrorMessage(err));
    } finally {
      setTogglingId(null);
    }
  }

  if (loading) {
    return <LoadingState message="Loading areas..." />;
  }

  if (error) {
    return <ErrorState message={error} onRetry={() => void loadData()} />;
  }

  return (
    <section className="admin-panel">
      <div className="panel-header">
        <h2>Areas</h2>
        <button
          type="button"
          className="btn btn-primary btn-sm"
          onClick={openCreate}
          disabled={facilities.length === 0}
        >
          Create area
        </button>
      </div>

      {facilities.length === 0 && (
        <p className="text-muted">Create a facility before adding areas.</p>
      )}

      {areas.length === 0 && facilities.length > 0 ? (
        <p className="text-muted">No areas found. Create one to get started.</p>
      ) : (
        <>
          <div className="table-wrapper desktop-only">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Facility</th>
                  <th>Description</th>
                  <th>Status</th>
                  <th>Approval</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {areas.map((area) => (
                  <tr key={area.id}>
                    <td>{area.name}</td>
                    <td>{area.facilityName}</td>
                    <td>{area.description ?? '—'}</td>
                    <td>{area.isActive ? 'Active' : 'Inactive'}</td>
                    <td>{area.requiresApproval ? 'Required' : 'Automatic'}</td>
                    <td className="actions-cell">
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => openEdit(area)}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => void toggleActive(area)}
                        disabled={togglingId === area.id}
                      >
                        {togglingId === area.id
                          ? 'Saving...'
                          : area.isActive
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
            {areas.map((area) => (
              <article key={area.id} className="list-card">
                <h3>{area.name}</h3>
                <p>
                  <strong>Facility:</strong> {area.facilityName}
                </p>
                <p className="text-muted">{area.description ?? 'No description'}</p>
                <div className="actions-cell">
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => openEdit(area)}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => void toggleActive(area)}
                    disabled={togglingId === area.id}
                  >
                    {area.isActive ? 'Deactivate' : 'Activate'}
                  </button>
                </div>
              </article>
            ))}
          </div>
        </>
      )}

      {formOpen && (
        <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="area-form-title">
          <div className="modal modal-wide">
            <h2 id="area-form-title">{editing ? 'Edit area' : 'Create area'}</h2>
            <form onSubmit={handleSubmit} noValidate>
              <div className="form-group">
                <label htmlFor="areaFacility">
                  Facility <span className="required-indicator">*</span>
                </label>
                <select
                  id="areaFacility"
                  value={form.facilityId}
                  onChange={(e) => setForm({ ...form, facilityId: e.target.value })}
                  disabled={Boolean(editing)}
                >
                  <option value="">Select a facility</option>
                  {facilities.map((facility) => (
                    <option key={facility.id} value={facility.id}>
                      {facility.name}
                    </option>
                  ))}
                </select>
                {formErrors.facilityId && (
                  <span className="field-error">{formErrors.facilityId}</span>
                )}
              </div>

              <div className="form-group">
                <label htmlFor="areaName">
                  Area name <span className="required-indicator">*</span>
                </label>
                <input
                  id="areaName"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Area name"
                />
                {formErrors.name && <span className="field-error">{formErrors.name}</span>}
              </div>

              <div className="form-group">
                <label htmlFor="areaDescription">Description</label>
                <textarea
                  id="areaDescription"
                  rows={3}
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Optional description"
                />
              </div>

              <div className="form-group checkbox-group">
                <label htmlFor="areaRequiresApproval">
                  <input
                    id="areaRequiresApproval"
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
                  <label htmlFor="areaIsActive">
                    <input
                      id="areaIsActive"
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
                  {submitting ? 'Saving...' : editing ? 'Save changes' : 'Create area'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}
