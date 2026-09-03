interface ApprovalBadgeProps {
  requiresApproval: boolean;
}

export default function ApprovalBadge({ requiresApproval }: ApprovalBadgeProps) {
  return (
    <span className={`badge ${requiresApproval ? 'badge-approval-required' : 'badge-approval-auto'}`}>
      {requiresApproval ? 'APPROVAL REQUIRED' : 'AUTO APPROVE'}
    </span>
  );
}
