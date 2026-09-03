import { useState, type FormEvent } from 'react';
import { useToast } from '../../context/ToastContext';
import { useAuth, useIsManagerOrAdmin } from '../../context/AuthContext';
import { accessRequestApi } from '../../services/accessRequest.service';
import { employeeApi } from '../../services/employee.service';
import { getErrorMessage } from '../../utils/errors';
import type { AccessRequest, AccessRequestTarget, AccessType, EmployeeSummary } from '../../types';
import { useEffect } from 'react';

interface AccessRequestFormProps {
  target: AccessRequestTarget;
  onSuccess?: (request: AccessRequest) => void;
}

interface FormErrors {
  beneficiary?: string;
  accessType?: string;
  startAt?: string;
  endAt?: string;
  reason?: string;
}

type BeneficiaryMode = 'myself' | 'employee';

function validateForm(
  isManager: boolean,
  beneficiaryMode: BeneficiaryMode,
  selectedEmployeeId: string,
  accessType: AccessType | '',
  startAt: string,
  endAt: string,
  reason: string,
): FormErrors {
  const errors: FormErrors = {};

  if (isManager && beneficiaryMode === 'employee' && !selectedEmployeeId) {
    errors.beneficiary = 'Please select an employee';
  }

  if (!accessType) {
    errors.accessType = 'Please select an access type';
  }

  if (!startAt) {
    errors.startAt = 'Start date and time is required';
  } else if (Number.isNaN(new Date(startAt).getTime())) {
    errors.startAt = 'Please enter a valid start date and time';
  }

  if (accessType === 'TEMPORARY') {
    if (!endAt) {
      errors.endAt = 'End date and time is required for temporary access';
    } else if (Number.isNaN(new Date(endAt).getTime())) {
      errors.endAt = 'Please enter a valid end date and time';
    } else if (startAt && new Date(endAt) <= new Date(startAt)) {
      errors.endAt = 'End date must be after the start date';
    }
  }

  if (!reason.trim()) {
    errors.reason = 'Please provide a reason for this request';
  }

  return errors;
}

function TargetSummary({ target }: { target: AccessRequestTarget }) {
  return (
    <dl className="target-summary">
      <div>
        <dt>Target type</dt>
        <dd>{target.type}</dd>
      </div>
      <div>
        <dt>{target.type === 'FACILITY' ? 'Facility' : target.type === 'AREA' ? 'Area' : 'Asset'}</dt>
        <dd>{target.name}</dd>
      </div>
      {target.facilityName && target.type !== 'FACILITY' && (
        <div>
          <dt>Facility</dt>
          <dd>{target.facilityName}</dd>
        </div>
      )}
      {target.areaName && target.type === 'ASSET' && (
        <div>
          <dt>Area</dt>
          <dd>{target.areaName}</dd>
        </div>
      )}
    </dl>
  );
}

export default function AccessRequestForm({ target, onSuccess }: AccessRequestFormProps) {
  const { user } = useAuth();
  const isManager = useIsManagerOrAdmin();
  const { showSuccess, showError } = useToast();
  const [beneficiaryMode, setBeneficiaryMode] = useState<BeneficiaryMode>('myself');
  const [employees, setEmployees] = useState<EmployeeSummary[]>([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const [accessType, setAccessType] = useState<AccessType | ''>('');
  const [startAt, setStartAt] = useState('');
  const [endAt, setEndAt] = useState('');
  const [reason, setReason] = useState('');
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!isManager) {
      return;
    }

    void employeeApi
      .list()
      .then((data) => {
        setEmployees(data.filter((employee) => employee.id !== user?.id));
      })
      .catch(() => {
        setEmployees([]);
      });
  }, [isManager, user?.id]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();

    const validationErrors = validateForm(
      isManager,
      beneficiaryMode,
      selectedEmployeeId,
      accessType,
      startAt,
      endAt,
      reason,
    );
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) {
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        accessType: accessType as AccessType,
        startAt: new Date(startAt).toISOString(),
        reason: reason.trim(),
        ...(target.type === 'FACILITY' && { facilityId: target.facilityId }),
        ...(target.type === 'AREA' && { areaId: target.areaId }),
        ...(target.type === 'ASSET' && { assetId: target.assetId }),
        ...(accessType === 'TEMPORARY' && { endAt: new Date(endAt).toISOString() }),
        ...(isManager &&
          beneficiaryMode === 'employee' && { requestedForId: selectedEmployeeId }),
      };

      const request = await accessRequestApi.create(payload);

      if (request.status === 'APPROVED') {
        showSuccess('Access has been approved.');
      } else if (request.status === 'PENDING') {
        showSuccess('Access request submitted successfully.');
      } else {
        showSuccess(`Request submitted with status: ${request.status}`);
      }

      setBeneficiaryMode('myself');
      setSelectedEmployeeId('');
      setAccessType('');
      setStartAt('');
      setEndAt('');
      setReason('');
      onSuccess?.(request);
    } catch (error) {
      showError(getErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  }

  const selectedEmployee = employees.find((employee) => employee.id === selectedEmployeeId);

  return (
    <section className="card access-form-card">
      <h2>Request Access</h2>

      <div className="form-section">
        <h3>Access target</h3>
        <TargetSummary target={target} />
      </div>

      <form onSubmit={handleSubmit} noValidate>
        {isManager && (
          <div className="form-section">
            <h3>Request access for</h3>
            <div className="form-group">
              <label htmlFor="beneficiaryMode">Beneficiary</label>
              <select
                id="beneficiaryMode"
                value={beneficiaryMode}
                onChange={(e) => {
                  setBeneficiaryMode(e.target.value as BeneficiaryMode);
                  setSelectedEmployeeId('');
                }}
              >
                <option value="myself">Myself</option>
                <option value="employee">Employee</option>
              </select>
            </div>

            {beneficiaryMode === 'employee' && (
              <div className="form-group">
                <label htmlFor="employeeSelect">
                  Employee <span className="required-indicator">*</span>
                </label>
                <select
                  id="employeeSelect"
                  value={selectedEmployeeId}
                  onChange={(e) => setSelectedEmployeeId(e.target.value)}
                >
                  <option value="">Select an employee</option>
                  {employees.map((employee) => (
                    <option key={employee.id} value={employee.id}>
                      {employee.name} ({employee.email})
                    </option>
                  ))}
                </select>
                {selectedEmployee && (
                  <p className="field-hint">
                    Access will be granted to {selectedEmployee.name} if approved.
                  </p>
                )}
                {errors.beneficiary && <span className="field-error">{errors.beneficiary}</span>}
              </div>
            )}
          </div>
        )}

        <div className="form-section">
          <h3>Access period</h3>

          <div className="form-group">
            <label htmlFor="accessType">
              Access type <span className="required-indicator">*</span>
            </label>
            <select
              id="accessType"
              value={accessType}
              onChange={(e) => setAccessType(e.target.value as AccessType | '')}
            >
              <option value="">Select access type</option>
              <option value="TEMPORARY">Temporary</option>
              <option value="PERMANENT">Permanent</option>
            </select>
            {errors.accessType && <span className="field-error">{errors.accessType}</span>}
          </div>

          <div className="form-group">
            <label htmlFor="startAt">
              Start date and time <span className="required-indicator">*</span>
            </label>
            <input
              id="startAt"
              type="datetime-local"
              value={startAt}
              onChange={(e) => setStartAt(e.target.value)}
            />
            {errors.startAt && <span className="field-error">{errors.startAt}</span>}
          </div>

          {accessType === 'TEMPORARY' && (
            <div className="form-group">
              <label htmlFor="endAt">
                End date and time <span className="required-indicator">*</span>
              </label>
              <input
                id="endAt"
                type="datetime-local"
                value={endAt}
                onChange={(e) => setEndAt(e.target.value)}
              />
              <span className="field-hint">Required for temporary access</span>
              {errors.endAt && <span className="field-error">{errors.endAt}</span>}
            </div>
          )}
        </div>

        <div className="form-section">
          <h3>Reason</h3>
          <div className="form-group">
            <label htmlFor="reason">
              Why is access needed? <span className="required-indicator">*</span>
            </label>
            <textarea
              id="reason"
              rows={4}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Explain why access is needed"
            />
            {errors.reason && <span className="field-error">{errors.reason}</span>}
          </div>
        </div>

        <button type="submit" className="btn btn-primary" disabled={submitting}>
          {submitting ? 'Submitting...' : 'Submit request'}
        </button>
      </form>
    </section>
  );
}

export { validateForm };
