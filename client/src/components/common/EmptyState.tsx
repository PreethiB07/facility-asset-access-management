import { Link } from 'react-router-dom';

interface EmptyStateProps {
  title: string;
  message: string;
  actionLabel?: string;
  actionTo?: string;
  onAction?: () => void;
}

export default function EmptyState({
  title,
  message,
  actionLabel,
  actionTo,
  onAction,
}: EmptyStateProps) {
  return (
    <div className="empty-state">
      <h2>{title}</h2>
      <p>{message}</p>
      {actionLabel && actionTo && (
        <Link to={actionTo} className="btn btn-secondary btn-sm">
          {actionLabel}
        </Link>
      )}
      {actionLabel && onAction && !actionTo && (
        <button type="button" className="btn btn-secondary btn-sm" onClick={onAction}>
          {actionLabel}
        </button>
      )}
    </div>
  );
}
