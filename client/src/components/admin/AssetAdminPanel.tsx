import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import ApprovalHelpText from '../common/ApprovalHelpText';
import ErrorState from '../common/ErrorState';
import LoadingState from '../common/LoadingState';
import { useToast } from '../../context/ToastContext';
import { areaApi } from '../../services/area.service';
import { assetApi, type AssetPayload } from '../../services/asset.service';
import { facilityApi } from '../../services/facility.service';
import { getErrorMessage } from '../../utils/errors';
import type { Area, Asset, Facility } from '../../types';

interface AssetFormState {
  facilityId: string;
  areaId: string;
  name: string;
  description: string;
  requiresApproval: boolean;
  isActive: boolean;
}

const emptyForm: AssetFormState = {
  facilityId: '',
  areaId: '',
  name: '',
  description: '',
  requiresApproval: true,
  isActive: true,
};

export default function AssetAdminPanel() {
  const { showSuccess, showError } = useToast();
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [areasByFacility, setAreasByFacility] = useState<Record<string, Area[]>>({});
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Asset | null>(null);
  const [form, setForm] = useState<AssetFormState>(emptyForm);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const facilityMap = useMemo(
    () => Object.fromEntries(facilities.map((facility) => [facility.id, facility.name])),
    [facilities],
  );

  const areaMap = useMemo(() => {
    const map: Record<string, string> = {};
    Object.values(areasByFacility).forEach((areas) => {
      areas.forEach((area) => {
        map[area.id] = area.name;
      });
    });
    return map;
  }, [areasByFacility]);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [facilityList, assetList] = await Promise.all([
        facilityApi.list(),
        assetApi.list(),
      ]);
      setFacilities(facilityList);
      setAssets(assetList);

      const areaGroups = await Promise.all(
        facilityList.map(async (facility) => {
          const areas = await areaApi.listByFacility(facility.id);
          return [facility.id, areas] as const;
        }),
      );
      setAreasByFacility(Object.fromEntries(areaGroups));
    } catch (err) {
      setError(getErrorMessage(err, 'Unable to load assets.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const availableAreas = form.facilityId ? (areasByFacility[form.facilityId] ?? []) : [];

  function openCreate() {
    setEditing(null);
    setForm({
      ...emptyForm,
      facilityId: facilities[0]?.id ?? '',
    });
    setFormErrors({});
    setFormOpen(true);
  }

  function openEdit(asset: Asset) {
    setEditing(asset);
    setForm({
      facilityId: asset.facilityId,
      areaId: asset.areaId ?? '',
      name: asset.name,
      description: asset.description ?? '',
      requiresApproval: asset.requiresApproval,
      isActive: asset.isActive,
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
      errors.name = 'Asset name is required';
    }
    if (form.areaId) {
      const validArea = availableAreas.some((area) => area.id === form.areaId);
      if (!validArea) {
        errors.areaId = 'Selected area must belong to the chosen facility';
      }
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

    const payload: AssetPayload = {
      facilityId: form.facilityId,
      areaId: form.areaId || null,
      name: form.name.trim(),
      description: form.description.trim() || null,
      requiresApproval: form.requiresApproval,
      isActive: form.isActive,
    };

    setSubmitting(true);
    try {
      if (editing) {
        await assetApi.update(editing.id, payload);
        showSuccess('Asset updated successfully.');
      } else {
        await assetApi.create(payload);
        showSuccess('Asset created successfully.');
      }
      setFormOpen(false);
      await loadData();
    } catch (err) {
      showError(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  async function toggleActive(asset: Asset) {
    setTogglingId(asset.id);
    try {
      await assetApi.update(asset.id, { isActive: !asset.isActive });
      showSuccess(asset.isActive ? 'Asset deactivated.' : 'Asset activated.');
      await loadData();
    } catch (err) {
      showError(getErrorMessage(err));
    } finally {
      setTogglingId(null);
    }
  }

  if (loading) {
    return <LoadingState message="Loading assets..." />;
  }

  if (error) {
    return <ErrorState message={error} onRetry={() => void loadData()} />;
  }

  return (
    <section className="admin-panel">
      <div className="panel-header">
        <h2>Assets</h2>
        <button
          type="button"
          className="btn btn-primary btn-sm"
          onClick={openCreate}
          disabled={facilities.length === 0}
        >
          Create asset
        </button>
      </div>

      {facilities.length === 0 && (
        <p className="text-muted">Create a facility before adding assets.</p>
      )}

      {assets.length === 0 && facilities.length > 0 ? (
        <p className="text-muted">No assets found. Create one to get started.</p>
      ) : (
        <>
          <div className="table-wrapper desktop-only">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Facility</th>
                  <th>Area</th>
                  <th>Status</th>
                  <th>Approval</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {assets.map((asset) => (
                  <tr key={asset.id}>
                    <td>{asset.name}</td>
                    <td>{facilityMap[asset.facilityId] ?? '—'}</td>
                    <td>{asset.areaId ? (areaMap[asset.areaId] ?? '—') : 'Independent'}</td>
                    <td>{asset.isActive ? 'Active' : 'Inactive'}</td>
                    <td>{asset.requiresApproval ? 'Required' : 'Automatic'}</td>
                    <td className="actions-cell">
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => openEdit(asset)}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => void toggleActive(asset)}
                        disabled={togglingId === asset.id}
                      >
                        {togglingId === asset.id
                          ? 'Saving...'
                          : asset.isActive
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
            {assets.map((asset) => (
              <article key={asset.id} className="list-card">
                <h3>{asset.name}</h3>
                <p>
                  <strong>Facility:</strong> {facilityMap[asset.facilityId] ?? '—'}
                </p>
                <p>
                  <strong>Area:</strong>{' '}
                  {asset.areaId ? (areaMap[asset.areaId] ?? '—') : 'Independent facility asset'}
                </p>
                <div className="actions-cell">
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => openEdit(asset)}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => void toggleActive(asset)}
                    disabled={togglingId === asset.id}
                  >
                    {asset.isActive ? 'Deactivate' : 'Activate'}
                  </button>
                </div>
              </article>
            ))}
          </div>
        </>
      )}

      {formOpen && (
        <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="asset-form-title">
          <div className="modal modal-wide">
            <h2 id="asset-form-title">{editing ? 'Edit asset' : 'Create asset'}</h2>
            <form onSubmit={handleSubmit} noValidate>
              <div className="form-group">
                <label htmlFor="assetFacility">
                  Facility <span className="required-indicator">*</span>
                </label>
                <select
                  id="assetFacility"
                  value={form.facilityId}
                  onChange={(e) =>
                    setForm({ ...form, facilityId: e.target.value, areaId: '' })
                  }
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
                <label htmlFor="assetArea">Area (optional)</label>
                <select
                  id="assetArea"
                  value={form.areaId}
                  onChange={(e) => setForm({ ...form, areaId: e.target.value })}
                  disabled={!form.facilityId}
                >
                  <option value="">Independent facility asset</option>
                  {availableAreas.map((area) => (
                    <option key={area.id} value={area.id}>
                      {area.name}
                    </option>
                  ))}
                </select>
                {formErrors.areaId && <span className="field-error">{formErrors.areaId}</span>}
              </div>

              <div className="form-group">
                <label htmlFor="assetName">
                  Asset name <span className="required-indicator">*</span>
                </label>
                <input
                  id="assetName"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Asset name"
                />
                {formErrors.name && <span className="field-error">{formErrors.name}</span>}
              </div>

              <div className="form-group">
                <label htmlFor="assetDescription">Description</label>
                <textarea
                  id="assetDescription"
                  rows={3}
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Optional description"
                />
              </div>

              <div className="form-group checkbox-group">
                <label htmlFor="assetRequiresApproval">
                  <input
                    id="assetRequiresApproval"
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
                  <label htmlFor="assetIsActive">
                    <input
                      id="assetIsActive"
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
                  {submitting ? 'Saving...' : editing ? 'Save changes' : 'Create asset'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}
