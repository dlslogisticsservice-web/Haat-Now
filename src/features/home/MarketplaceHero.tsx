import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { CATEGORY_IMAGES, type CategoryKey } from '../../utils/categoryImages';
import { useAppConfig } from '../../contexts/AppConfigContext';

interface Slide {
  cat: CategoryKey;
  titleAr: string; titleEn: string;
  subAr: string;   subEn: string;
  accent: string;
}

// 8 marketplace verticals — image-led, NOT a fintech/bank card.
const SLIDES: Slide[] = [
  { cat: 'restaurant',  titleAr: 'مطاعم تشتهيها',   titleEn: 'Restaurants',  subAr: 'ألذ الأطباق توصلك سريعاً',      subEn: 'Top dishes, delivered fast',        accent: 'rgba(163,249,91,0.45)' },
  { cat: 'market',      titleAr: 'سوبر ماركت',       titleEn: 'Supermarket',  subAr: 'كل احتياجات بيتك بضغطة واحدة',  subEn: 'Everything your home needs',        accent: 'rgba(80,200,140,0.40)' },
  { cat: 'pharmacy',    titleAr: 'صيدليات',          titleEn: 'Pharmacies',   subAr: 'أدويتك وصحتك إلى باب بيتك',     subEn: 'Health & medicine to your door',    accent: 'rgba(90,180,255,0.38)' },
  { cat: 'coffee',      titleAr: 'قهوتك المفضّلة',   titleEn: 'Coffee',       subAr: 'سخّن يومك بأجود المشروبات',     subEn: 'Brew your perfect day',             accent: 'rgba(210,165,90,0.42)' },
  { cat: 'electronics', titleAr: 'إلكترونيات',       titleEn: 'Electronics',  subAr: 'أحدث الأجهزة بين يديك',         subEn: 'The latest tech, in your hands',    accent: 'rgba(120,160,255,0.40)' },
  { cat: 'flowers',     titleAr: 'زهور وباقات',      titleEn: 'Flowers',      subAr: 'لمسة جمال تُفرح من تحب',        subEn: 'Bouquets that say it all',          accent: 'rgba(255,120,170,0.40)' },
  { cat: 'gifts',       titleAr: 'هدايا فاخرة',      titleEn: 'Gifts',        subAr: 'فاجئ من تحب بأرقى الهدايا',     subEn: 'Surprise someone special',          accent: 'rgba(200,140,255,0.40)' },
  { cat: 'sweets',      titleAr: 'حلويات',           titleEn: 'Desserts',     subAr: 'أحلى اللحظات تبدأ بقطعة حلا',   subEn: 'Sweeten every moment',              accent: 'rgba(255,170,110,0.40)' },
];

const ROTATE_MS = 6000;

export function MarketplaceHero({ onShop }: { onShop?: (cat: CategoryKey) => void }) {
  const { lang, dt } = useAppConfig();
  const [idx, setIdx] = useState(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const go = (next: number) => setIdx((next + SLIDES.length) % SLIDES.length);

  const start = () => {
    stop();
    timer.current = setInterval(() => setIdx(i => (i + 1) % SLIDES.length), ROTATE_MS);
  };
  const stop = () => { if (timer.current) { clearInterval(timer.current); timer.current = null; } };

  useEffect(() => { start(); return stop; }, []);

  return (
    <section className="mb-3" id="home_hero" style={{ position: 'relative', zIndex: 2 }}>
      <div
        className="glass-shine"
        onMouseEnter={stop}
        onMouseLeave={start}
        style={{
          position: 'relative', height: '232px', borderRadius: '24px', overflow: 'hidden',
          border: '1px solid rgba(255,255,255,0.10)',
          boxShadow: '0 22px 55px rgba(0,0,0,0.65), inset 0 1px 0 rgba(255,255,255,0.12)',
        }}
        dir={lang === 'ar' ? 'rtl' : 'ltr'}
      >
        {SLIDES.map((s, i) => {
          const active = i === idx;
          const title = lang === 'ar' ? s.titleAr : s.titleEn;
          const sub   = lang === 'ar' ? (s.cat === 'restaurant' ? dt('nearest') : s.subAr) : s.subEn;
          return (
            <div
              key={s.cat}
              aria-hidden={!active}
              style={{
                position: 'absolute', inset: 0,
                opacity: active ? 1 : 0,
                transition: 'opacity 700ms ease',
                pointerEvents: active ? 'auto' : 'none',
              }}
            >
              <img
                src={CATEGORY_IMAGES[s.cat].cover}
                alt={title}
                className={active ? 'hero-kenburns' : ''}
                loading={i === 0 ? 'eager' : 'lazy'}
                decoding="async"
                style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
              />
              {/* accent glow */}
              <div style={{ position: 'absolute', top: '-40px', insetInlineStart: '-30px', width: '240px', height: '240px', borderRadius: '50%', background: s.accent, filter: 'blur(70px)', opacity: 0.9, pointerEvents: 'none' }} />
              {/* legibility scrim (text side) */}
              <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to inline-start, rgba(6,9,11,0.95) 0%, rgba(6,9,11,0.55) 42%, rgba(6,9,11,0.10) 80%)' }} />
              {/* top sheen */}
              <div style={{ position: 'absolute', top: 0, insetInline: '8%', height: '1px', background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.28), transparent)' }} />
              {/* text column */}
              <div style={{ position: 'absolute', insetInlineEnd: 0, top: 0, bottom: 0, width: '62%', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '8px', padding: '20px 18px' }}>
                <span style={{ alignSelf: 'flex-start', padding: '3px 11px', borderRadius: '99px', border: '1px solid rgba(163,249,91,0.5)', color: 'var(--color-primary-fixed)', fontSize: '10px', fontWeight: 700, letterSpacing: '0.05em', boxShadow: '0 0 12px rgba(163,249,91,0.25)' }}>
                  HAAT NOW
                </span>
                <p style={{ fontSize: '26px', fontWeight: 900, color: '#f2f4f6', lineHeight: 1.05, letterSpacing: '-0.03em', margin: 0, textShadow: '0 2px 14px rgba(0,0,0,0.6)' }}>{title}</p>
                <p style={{ fontSize: '13px', color: 'rgba(190,196,202,0.92)', margin: 0, lineHeight: 1.45 }}>{sub}</p>
                <button
                  onClick={() => onShop?.(s.cat)}
                  className="animate-pulse-glow"
                  style={{ alignSelf: 'flex-start', marginTop: '4px', height: '38px', padding: '0 22px', borderRadius: '19px', background: 'var(--color-primary-fixed)', border: 'none', color: '#0c2000', fontSize: '13px', fontWeight: 800, cursor: 'pointer', boxShadow: '0 0 20px rgba(163,249,91,0.5)' }}
                >
                  {lang === 'ar' ? dt('orderCta') : 'Shop now'}
                </button>
              </div>
            </div>
          );
        })}

        {/* Arrows */}
        <button aria-label="prev" onClick={() => { go(idx - 1); start(); }}
          style={arrowStyle('start')}><ChevronRight size={18} color="#fff" strokeWidth={2.5} /></button>
        <button aria-label="next" onClick={() => { go(idx + 1); start(); }}
          style={arrowStyle('end')}><ChevronLeft size={18} color="#fff" strokeWidth={2.5} /></button>

        {/* Dots */}
        <div style={{ position: 'absolute', bottom: '10px', insetInlineStart: 0, insetInlineEnd: 0, display: 'flex', justifyContent: 'center', gap: '6px', zIndex: 3 }}>
          {SLIDES.map((_, i) => (
            <button key={i} aria-label={`slide ${i + 1}`} onClick={() => { setIdx(i); start(); }}
              style={{ width: i === idx ? '20px' : '6px', height: '5px', borderRadius: '3px', border: 'none', cursor: 'pointer', padding: 0, background: i === idx ? 'var(--color-primary-fixed)' : 'rgba(255,255,255,0.35)', boxShadow: i === idx ? '0 0 8px rgba(163,249,91,0.6)' : 'none', transition: 'all 0.3s ease' }} />
          ))}
        </div>
      </div>
    </section>
  );
}

function arrowStyle(side: 'start' | 'end'): React.CSSProperties {
  return {
    position: 'absolute', top: '50%', transform: 'translateY(-50%)',
    [side === 'start' ? 'insetInlineStart' : 'insetInlineEnd']: '8px',
    width: '32px', height: '32px', borderRadius: '50%', zIndex: 3,
    background: 'rgba(8,12,16,0.55)', border: '1px solid rgba(255,255,255,0.15)',
    backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center',
    cursor: 'pointer',
  } as React.CSSProperties;
}
