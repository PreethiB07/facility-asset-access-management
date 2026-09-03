interface LoadingStateProps {
  message?: string;
}

export default function LoadingState({ message = 'Loading...' }: LoadingStateProps) {
  return (
    <div className="state-message" role="status" aria-live="polite">
      <p>{message}</p>
    </div>
  );
}
