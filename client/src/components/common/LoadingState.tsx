import Spinner from './Spinner';

interface LoadingStateProps {
  message?: string;
}

export default function LoadingState({ message = 'Loading...' }: LoadingStateProps) {
  return (
    <div className="state-panel" role="status" aria-live="polite">
      <Spinner label={message} />
      <p>{message}</p>
    </div>
  );
}
