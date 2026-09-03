interface ResourceStatusBadgeProps {
  active: boolean;
}

export default function ResourceStatusBadge({ active }: ResourceStatusBadgeProps) {
  return (
    <span className={`badge ${active ? 'badge-active' : 'badge-inactive'}`}>
      {active ? 'ACTIVE' : 'INACTIVE'}
    </span>
  );
}
