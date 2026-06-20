import { DistanceBadge } from './DistanceBadge';
import { EtaBadge } from './EtaBadge';

interface LocationCardProps {
  label: string;
  addressLine?: string | null;
  zoneName?: string | null;
  distanceKm?: number | null;
  etaMinutes?: number | null;
  isDefault?: boolean;
  onClick?: () => void;
}

export const LocationCard = ({
  label,
  addressLine,
  zoneName,
  distanceKm,
  etaMinutes,
  isDefault,
  onClick,
}: LocationCardProps) => {
  return (
    <div
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      className={`glass-panel rounded-xl p-4 text-right${onClick ? ' cursor-pointer transition-all hover:border-[rgba(163,249,91,0.25)]' : ''}`}
      style={{ border: isDefault ? '1px solid rgba(163,249,91,0.3)' : '1px solid rgba(255,255,255,0.08)' }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          {(distanceKm != null && isFinite(distanceKm)) && (
            <div className="flex items-center gap-1.5">
              <DistanceBadge distanceKm={distanceKm} />
              {(etaMinutes != null && isFinite(etaMinutes)) && (
                <EtaBadge etaMinutes={etaMinutes} />
              )}
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-end gap-2 mb-1">
            {isDefault && (
              <span
                className="px-2 py-0.5 rounded-full"
                style={{ background: 'rgba(163,249,91,0.12)', color: 'var(--color-primary-fixed)', fontSize: '10px', fontWeight: 700, border: '1px solid rgba(163,249,91,0.25)' }}
              >
                الافتراضي
              </span>
            )}
            <p className="font-bold truncate" style={{ color: 'var(--color-on-surface)', fontSize: '14px' }}>
              {label}
            </p>
          </div>
          {zoneName && (
            <p className="truncate" style={{ color: 'var(--color-primary-fixed)', fontSize: '12px' }}>
              {zoneName}
            </p>
          )}
          {addressLine && (
            <p className="truncate mt-0.5" style={{ color: 'var(--color-on-surface-variant)', fontSize: '12px' }}>
              {addressLine}
            </p>
          )}
        </div>

        <div
          className="flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center"
          style={{ background: 'rgba(163,249,91,0.08)', border: '1px solid rgba(163,249,91,0.15)' }}
        >
          <span
            className="material-symbols-outlined"
            style={{ fontSize: '18px', color: 'var(--color-primary-fixed)', fontVariationSettings: "'FILL' 1" }}
          >
            location_on
          </span>
        </div>
      </div>
    </div>
  );
};
