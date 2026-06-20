import { formatDistance } from '../../services/location.service';

interface DistanceBadgeProps {
  distanceKm: number;
  className?: string;
}

export const DistanceBadge = ({ distanceKm, className = '' }: DistanceBadgeProps) => {
  if (!isFinite(distanceKm)) return null;
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full ${className}`}
      style={{
        background: 'rgba(163,249,91,0.08)',
        border: '1px solid rgba(163,249,91,0.18)',
        fontSize: '11px',
        color: 'var(--color-primary-fixed)',
        fontWeight: 600,
        whiteSpace: 'nowrap',
      }}
    >
      <span className="material-symbols-outlined" style={{ fontSize: '12px' }}>near_me</span>
      {formatDistance(distanceKm)}
    </span>
  );
};
