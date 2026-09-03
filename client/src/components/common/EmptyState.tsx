interface EmptyStateProps {
  message: string;
}

export default function EmptyState({ message }: EmptyStateProps) {
  return (
    <div className="state-message state-empty">
      <p>{message}</p>
    </div>
  );
}
