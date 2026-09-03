import type { AccessRequestStatus } from '../../types';

interface StatusBadgeProps {
  status: AccessRequestStatus;
}

const STATUS_CLASS: Record<AccessRequestStatus, string> = {
  PENDING: 'badge-pending',
  APPROVED: 'badge-approved',
  REJECTED: 'badge-rejected',
};

export default function StatusBadge({ status }: StatusBadgeProps) {
  return <span className={`badge ${STATUS_CLASS[status]}`}>{status}</span>;
}
