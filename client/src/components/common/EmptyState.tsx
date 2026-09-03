import { Link } from 'react-router-dom';

interface EmptyStateProps {
  message: string;
  actionLabel?: string;
  actionTo?: string;
}

export default function EmptyState({ message, actionLabel, actionTo }: EmptyStateProps) {
  return (
    <div className="state-message state-empty">
      <p>{message}</p>
      {actionLabel && actionTo && (
        <Link to={actionTo} className="btn btn-secondary btn-sm empty-action">
          {actionLabel}
        </Link>
      )}
    </div>
  );
}
