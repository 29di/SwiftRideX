const STATUS_CLASS_MAP = {
  REQUESTED: 'status-requested',
  ACCEPTED: 'status-accepted',
  STARTED: 'status-started',
  COMPLETED: 'status-completed',
  CANCELLED: 'status-cancelled',
};

export default function StatusBadge({ status }) {
  const normalizedStatus = String(status || 'REQUESTED').toUpperCase();
  const className = STATUS_CLASS_MAP[normalizedStatus] || STATUS_CLASS_MAP.REQUESTED;

  return <span className={`status-pill ${className}`}>{normalizedStatus}</span>;
}
