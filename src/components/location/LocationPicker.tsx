import { useState } from 'react';

export interface PickedLocation {
  latitude: number;
  longitude: number;
  addressLine: string;
}

interface LocationPickerProps {
  initialAddress?: string;
  onConfirm: (location: PickedLocation) => void;
  onCancel?: () => void;
}

// Static map placeholder — Google Maps integration goes here in a future phase.
// The component exposes the same interface that a live map picker would use,
// so callers require no changes when the real map is wired.
const MAP_PLACEHOLDER = 'https://lh3.googleusercontent.com/aida-public/AB6AXuBGElXF80FqXsSBy_lETRDhEMvfpJEnisJCKyNYTwOuL6Dda0IlzC8QuXWiBDjX_A9_fRwumQfK_8pTd1TTvXSRpBSGBYnHbo0pm6BH8ETWhgD9TKiQY1dRNsjgnH0y3kE3PFTpUVt5baqvZSyLRR-3TvqOLD6SjfdTdhislXrwngNvVjTrRBlcidWwnOYPB8yYFWulkaOGFn4BfS-qlWbHMgUbJUz6ne0tbIZW6l33nTpSVDYpOHD-sXf9SKaD-PaX5m3USXE6XOEk';

// Riyadh city center — default pin before user adjusts
const DEFAULT_LAT = 24.7136;
const DEFAULT_LNG = 46.6753;

export const LocationPicker = ({ initialAddress = '', onConfirm, onCancel }: LocationPickerProps) => {
  const [addressLine, setAddressLine] = useState(initialAddress);
  const [isLocating,  setIsLocating]  = useState(false);
  const [locError,    setLocError]    = useState('');
  const [lat, setLat] = useState<number>(DEFAULT_LAT);
  const [lng, setLng] = useState<number>(DEFAULT_LNG);

  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      setLocError('تحديد الموقع غير مدعوم في هذا المتصفح');
      return;
    }
    setIsLocating(true);
    setLocError('');
    navigator.geolocation.getCurrentPosition(
      pos => {
        setLat(pos.coords.latitude);
        setLng(pos.coords.longitude);
        setIsLocating(false);
      },
      () => {
        setLocError('تعذّر تحديد موقعك. يُرجى إدخال العنوان يدوياً.');
        setIsLocating(false);
      },
      { timeout: 8000, enableHighAccuracy: true },
    );
  };

  const handleConfirm = () => {
    if (!addressLine.trim()) return;
    onConfirm({ latitude: lat, longitude: lng, addressLine: addressLine.trim() });
  };

  return (
    <div className="glass-panel rounded-2xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.1)' }}>

      {/* Map placeholder */}
      <div className="relative" style={{ height: '180px' }}>
        <img src={MAP_PLACEHOLDER} alt="خريطة" className="w-full h-full object-cover" style={{ filter: 'grayscale(60%) brightness(0.5)' }} />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="flex flex-col items-center gap-2">
            <span
              className="material-symbols-outlined"
              style={{ fontSize: '36px', color: 'var(--color-primary-fixed)', fontVariationSettings: "'FILL' 1", filter: 'drop-shadow(0 0 8px rgba(163,249,91,0.6))' }}
            >
              location_on
            </span>
            <span
              className="px-3 py-1 rounded-full text-xs font-bold"
              style={{ background: 'rgba(163,249,91,0.15)', border: '1px solid rgba(163,249,91,0.3)', color: 'var(--color-primary-fixed)' }}
            >
              الخريطة التفاعلية قريباً
            </span>
          </div>
        </div>
        {/* Coordinates chip */}
        <div
          className="absolute bottom-3 left-3 px-2 py-1 rounded-lg"
          style={{ background: 'rgba(17,20,23,0.85)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.1)' }}
        >
          <span style={{ color: 'var(--color-on-surface-variant)', fontSize: '10px', fontFamily: 'monospace' }}>
            {lat.toFixed(4)}, {lng.toFixed(4)}
          </span>
        </div>
      </div>

      {/* Controls */}
      <div className="p-4 space-y-3 text-right">
        <button
          type="button"
          onClick={handleUseCurrentLocation}
          disabled={isLocating}
          className="w-full flex items-center justify-center gap-2 h-10 rounded-xl cursor-pointer transition-all active:scale-95"
          style={{
            background: 'rgba(163,249,91,0.08)',
            border: '1px solid rgba(163,249,91,0.2)',
            color: 'var(--color-primary-fixed)',
            fontSize: '13px',
            fontWeight: 600,
          }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: '16px', fontVariationSettings: "'FILL' 1" }}>
            {isLocating ? 'pending' : 'my_location'}
          </span>
          {isLocating ? 'جاري تحديد موقعك...' : 'استخدام موقعي الحالي'}
        </button>

        {locError && (
          <p style={{ color: 'var(--color-error)', fontSize: '12px' }}>{locError}</p>
        )}

        <input
          type="text"
          placeholder="أدخل العنوان التفصيلي..."
          value={addressLine}
          onChange={e => setAddressLine(e.target.value)}
          className="w-full h-11 px-4 rounded-xl"
          style={{
            background: 'var(--color-surface-container-highest)',
            border: '1px solid rgba(255,255,255,0.1)',
            color: 'white',
            fontSize: '14px',
            outline: 'none',
          }}
          dir="rtl"
        />

        <div className="flex gap-2">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 h-11 rounded-xl cursor-pointer transition-all active:scale-95"
              style={{
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.1)',
                color: 'var(--color-on-surface-variant)',
                fontSize: '14px',
                fontWeight: 600,
              }}
            >
              إلغاء
            </button>
          )}
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!addressLine.trim()}
            className="flex-1 h-11 rounded-xl cursor-pointer transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
            style={{
              background: 'var(--color-primary-fixed)',
              color: '#0c2000',
              fontSize: '14px',
              fontWeight: 700,
              border: 'none',
            }}
          >
            تأكيد الموقع
          </button>
        </div>
      </div>
    </div>
  );
};
