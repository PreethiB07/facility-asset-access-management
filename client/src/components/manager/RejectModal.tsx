import { useState, type FormEvent } from 'react';
import { getErrorMessage } from '../../utils/errors';

interface RejectModalProps {
  requestId: string;
  onCancel: () => void;
  onReject: (requestId: string, reason: string) => Promise<void>;
}

export default function RejectModal({ requestId, onCancel, onReject }: RejectModalProps) {
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!reason.trim()) {
      setError('Rejection reason is required');
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      await onReject(requestId, reason.trim());
    } catch (err) {
      setError(getErrorMessage(err));
      setSubmitting(false);
    }
  }

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="reject-title">
      <div className="modal">
        <h2 id="reject-title">Reject Access Request</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="rejectionReason">
              Reason <span className="required-indicator">*</span>
            </label>
            <textarea
              id="rejectionReason"
              rows={4}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Explain why this request is being rejected"
              autoFocus
            />
            {error && (
              <span className="field-error" role="alert">
                {error}
              </span>
            )}
          </div>
          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onCancel} disabled={submitting}>
              Cancel
            </button>
            <button type="submit" className="btn btn-danger" disabled={submitting}>
              {submitting ? 'Rejecting...' : 'Reject Request'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
