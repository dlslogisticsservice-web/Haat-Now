import { formatEta } from '../../services/location.service';

interface EtaBadgeProps {
  etaMinutes: number;
  className?: string;
}

export const EtaBadge = ({ etaMinutes, className = '' }: EtaBadgeProps) => {
  if (!isFinite(etaMinutes)) return null;
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full ${className}`}
      style={{
        background: 'rgba(96,165,250,0.08)',
        border: '1px solid rgba(96,165,250,0.2)',
        fontSize: '11px',
        color: '#60a5fa',
        fontWeight: 600,
        whiteSpace: 'nowrap',
      }}
    >
      <span className="material-symbols-outlined" style={{ fontSize: '12px' }}>schedule</span>
      {formatEta(etaMinutes)}
    </span>
  );
};
