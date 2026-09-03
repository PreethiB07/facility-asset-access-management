import { useState, type FormEvent } from 'react';
import { accessRequestApi } from '../../services/accessRequest.service';
import { getErrorMessage } from '../../utils/errors';
import type { AccessRequest, AccessRequestTarget, AccessType } from '../../types';

interface AccessRequestFormProps {
  target: AccessRequestTarget;
  onSuccess?: (request: AccessRequest) => void;
}

interface FormErrors {
  accessType?: string;
  startAt?: string;
  endAt?: string;
  reason?: string;
}

function validateForm(
  accessType: AccessType | '',
  startAt: string,
  endAt: string,
  reason: string,
): FormErrors {
  const errors: FormErrors = {};

  if (!accessType) {
    errors.accessType = 'Access type is required';
  }

  if (!startAt) {
    errors.startAt = 'Start date and time is required';
  } else if (Number.isNaN(new Date(startAt).getTime())) {
    errors.startAt = 'Start date and time is invalid';
  }

  if (accessType === 'TEMPORARY') {
    if (!endAt) {
      errors.endAt = 'End date and time is required for temporary access';
    } else if (Number.isNaN(new Date(endAt).getTime())) {
      errors.endAt = 'End date and time is invalid';
    } else if (startAt && new Date(endAt) <= new Date(startAt)) {
      errors.endAt = 'End must be after start';
    }
  }

  if (!reason.trim()) {
    errors.reason = 'Reason is required';
  }

  return errors;
}

export default function AccessRequestForm({ target, onSuccess }: AccessRequestFormProps) {
  const [accessType, setAccessType] = useState<AccessType | ''>('');
  const [startAt, setStartAt] = useState('');
  const [endAt, setEndAt] = useState('');
  const [reason, setReason] = useState('');
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitError, setSubmitError] = useState('');
  const [resultMessage, setResultMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitError('');
    setResultMessage('');

    const validationErrors = validateForm(accessType, startAt, endAt, reason);
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
      };

      const request = await accessRequestApi.create(payload);

      if (request.status === 'APPROVED') {
        setResultMessage('Access approved');
      } else if (request.status === 'PENDING') {
        setResultMessage('Access request submitted for approval');
      } else {
        setResultMessage(`Request status: ${request.status}`);
      }

      setAccessType('');
      setStartAt('');
      setEndAt('');
      setReason('');
      onSuccess?.(request);
    } catch (error) {
      setSubmitError(getErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="card access-form-card">
      <h2>Request Access to {target.name}</h2>
      <p className="text-muted">Target type: {target.type}</p>

      {resultMessage && <div className="alert alert-success">{resultMessage}</div>}
      {submitError && <div className="alert alert-error">{submitError}</div>}

      <form onSubmit={handleSubmit} noValidate>
        <div className="form-group">
          <label htmlFor="accessType">Access type</label>
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
          <label htmlFor="startAt">Start date and time</label>
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
            <label htmlFor="endAt">End date and time</label>
            <input
              id="endAt"
              type="datetime-local"
              value={endAt}
              onChange={(e) => setEndAt(e.target.value)}
            />
            {errors.endAt && <span className="field-error">{errors.endAt}</span>}
          </div>
        )}

        <div className="form-group">
          <label htmlFor="reason">Reason</label>
          <textarea
            id="reason"
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Explain why you need access"
          />
          {errors.reason && <span className="field-error">{errors.reason}</span>}
        </div>

        <button type="submit" className="btn btn-primary" disabled={submitting}>
          {submitting ? 'Submitting...' : 'Submit request'}
        </button>
      </form>
    </section>
  );
}

export { validateForm };
