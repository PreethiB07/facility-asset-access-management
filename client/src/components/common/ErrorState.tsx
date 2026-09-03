import { Link } from 'react-router-dom';

interface ErrorStateProps {
  title?: string;
  message: string;
  onRetry?: () => void;
  backTo?: string;
  backLabel?: string;
}

export default function ErrorState({
  title = 'Something went wrong',
  message,
  onRetry,
  backTo,
  backLabel = 'Go back',
}: ErrorStateProps) {
  return (
    <div className="error-state" role="alert">
      <h2>{title}</h2>
      <p>{message}</p>
      <div className="error-state-actions">
        {onRetry && (
          <button type="button" className="btn btn-secondary btn-sm" onClick={onRetry}>
            Try again
          </button>
        )}
        {backTo && (
          <Link to={backTo} className="btn btn-secondary btn-sm">
            {backLabel}
          </Link>
        )}
      </div>
    </div>
  );
}
