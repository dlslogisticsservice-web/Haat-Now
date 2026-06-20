import { useState } from 'react';
import { Bike, Store, Crown, Zap, LayoutGrid, Sparkles, ChevronLeft, Rocket } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

const LIME = '#a3f95b';

interface Slide {
  id: string;
  Icon: LucideIcon;
  orbA: string;
  orbB: string;
  bgTint: string;
  badge: string;
  BadgeIcon: LucideIcon;
  title: string;
  description: string;
}

const SLIDES: Slide[] = [
  {
    id: 'delivery',
    Icon: Bike,
    orbA: 'rgba(163,249,91,0.22)',
    orbB: 'rgba(163,249,91,0.08)',
    bgTint: 'radial-gradient(ellipse 110% 55% at 50% -10%, rgba(10,38,6,0.95) 0%, rgba(11,14,17,0) 70%)',
    badge: 'سريع الفائق',
    BadgeIcon: Zap,
    title: 'توصيل في 30 دقيقة',
    description: 'أسرع توصيل في المدينة. اطلب الآن واستمتع بوجبتك الفاخرة طازجة على باب منزلك.',
  },
  {
    id: 'selection',
    Icon: Store,
    orbA: 'rgba(163,249,91,0.18)',
    orbB: 'rgba(163,249,91,0.06)',
    bgTint: 'radial-gradient(ellipse 110% 55% at 50% -10%, rgba(8,30,8,0.95) 0%, rgba(11,14,17,0) 70%)',
    badge: 'كل شيء هنا',
    BadgeIcon: LayoutGrid,
    title: 'مطاعم، سوبر ماركت، صيدلية',
    description: 'كل ما تحتاجه في تطبيق واحد. أشهى المطاعم، البقالة اليومية، والأدوية بنقرة واحدة.',
  },
  {
    id: 'rewards',
    Icon: Crown,
    orbA: 'rgba(163,249,91,0.25)',
    orbB: 'rgba(163,249,91,0.10)',
    bgTint: 'radial-gradient(ellipse 110% 55% at 50% -10%, rgba(12,40,8,0.95) 0%, rgba(11,14,17,0) 70%)',
    badge: 'Platinum Member',
    BadgeIcon: Sparkles,
    title: 'نقاط مكافآت حصرية',
    description: 'اكسب نقاطاً مع كل طلب واستمتع بخصومات حصرية وعروض Platinum لا مثيل لها.',
  },
];

export function OnboardingScreen({ onComplete }: { onComplete: () => void }) {
  const [current, setCurrent] = useState(0);
  const [exiting, setExiting] = useState(false);

  const goNext = () => {
    if (current === SLIDES.length - 1) {
      localStorage.setItem('haat_onboarding_done', '1');
      onComplete();
    } else {
      setExiting(true);
      setTimeout(() => {
        setCurrent(c => c + 1);
        setExiting(false);
      }, 220);
    }
  };

  const skip = () => {
    localStorage.setItem('haat_onboarding_done', '1');
    onComplete();
  };

  const slide = SLIDES[current];
  const isLast = current === SLIDES.length - 1;

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 9998,
        display: 'flex', flexDirection: 'column',
        background: '#0b0e11', overflow: 'hidden',
      }}
    >
      {/* ── Background atmospheric gradient ── */}
      <div
        style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          background: slide.bgTint,
          transition: 'background 0.5s ease',
        }}
      />

      {/* Primary lime orb — top center */}
      <div
        style={{
          position: 'absolute', top: '-8%', left: '50%',
          transform: 'translateX(-50%)',
          width: '420px', height: '420px', borderRadius: '50%',
          background: slide.orbA,
          filter: 'blur(100px)',
          pointerEvents: 'none',
          animation: 'subtle-float 5s ease-in-out infinite',
          transition: 'background 0.5s ease',
        }}
      />
      {/* Secondary orb — bottom ambient */}
      <div
        style={{
          position: 'absolute', bottom: '22%', left: '50%',
          transform: 'translateX(-50%)',
          width: '240px', height: '240px', borderRadius: '50%',
          background: slide.orbB,
          filter: 'blur(70px)',
          pointerEvents: 'none',
          transition: 'background 0.5s ease',
        }}
      />
      {/* Corner micro-orbs */}
      <div style={{ position: 'absolute', top: '30%', left: '-5%', width: '120px', height: '120px', borderRadius: '50%', background: 'rgba(163,249,91,0.07)', filter: 'blur(50px)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', top: '25%', right: '-5%', width: '100px', height: '100px', borderRadius: '50%', background: 'rgba(163,249,91,0.05)', filter: 'blur(40px)', pointerEvents: 'none' }} />

      {/* ── Header: brand + skip ── */}
      <div
        style={{
          position: 'relative', zIndex: 2,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '56px 24px 0',
        }}
      >
        <span style={{ fontSize: '16px', fontWeight: 900, letterSpacing: '-0.02em' }}>
          <span style={{
            background: 'linear-gradient(180deg, #e8e9eb 0%, #b1b2b4 55%, #7d7f83 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.7))',
          }}>HAAT</span>
          <span style={{ color: LIME, textShadow: '0 0 16px rgba(163,249,91,0.5)' }}>NOW</span>
        </span>
        <button
          onClick={skip}
          style={{
            background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '20px', padding: '6px 14px',
            color: 'rgba(255,255,255,0.45)', fontSize: '13px', fontFamily: 'inherit',
            cursor: 'pointer',
          }}
        >
          تخطي
        </button>
      </div>

      {/* ── Hero icon zone ── */}
      <div
        style={{
          flex: 1, position: 'relative', zIndex: 2,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          paddingTop: '12px',
        }}
      >
        {/* Z3 metallic card — the icon's home */}
        <div
          className="animate-float"
          style={{
            opacity: exiting ? 0 : 1,
            transform: exiting ? 'scale(0.88) translateY(16px)' : 'scale(1) translateY(0)',
            transition: 'opacity 0.22s ease, transform 0.22s ease',
          }}
        >
          <div
            style={{
              width: '148px', height: '148px', borderRadius: '44px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'linear-gradient(180deg, #24282c 0%, #15181b 100%)',
              borderTop:    '1px solid rgba(255,255,255,0.14)',
              borderLeft:   '1px solid rgba(255,255,255,0.07)',
              borderRight:  '1px solid rgba(255,255,255,0.07)',
              borderBottom: '1px solid rgba(255,255,255,0.03)',
              boxShadow: `0 10px 40px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.09), 0 0 70px ${slide.orbA}`,
              position: 'relative', overflow: 'hidden',
            }}
          >
            {/* Inner specular spotlight */}
            <div
              style={{
                position: 'absolute', inset: 0, borderRadius: '44px',
                background: 'radial-gradient(ellipse 80% 55% at 50% 0%, rgba(255,255,255,0.10) 0%, transparent 65%)',
                pointerEvents: 'none',
              }}
            />
            {/* Glass shine sweep */}
            <div
              style={{
                position: 'absolute', inset: 0, borderRadius: '44px', overflow: 'hidden',
                pointerEvents: 'none',
              }}
            >
              <div
                style={{
                  position: 'absolute', top: '-50%', left: '-60%',
                  width: '60%', height: '200%',
                  background: 'linear-gradient(115deg, transparent 30%, rgba(255,255,255,0.08) 50%, transparent 70%)',
                  transform: 'rotate(8deg)',
                  animation: 'shine 6s ease-in-out infinite',
                }}
              />
            </div>
            <slide.Icon
              size={72}
              color="#c8cacc"
              strokeWidth={1.5}
              style={{
                filter: [
                  'drop-shadow(0 -1px 1px rgba(255,255,255,0.6))',
                  'drop-shadow(0 3px 6px rgba(0,0,0,0.9))',
                  'drop-shadow(0 1px 2px rgba(0,0,0,0.6))',
                ].join(' '),
                position: 'relative', zIndex: 1,
              }}
            />
          </div>
        </div>
      </div>

      {/* ── Bottom glass panel ── */}
      <div
        style={{
          position: 'relative', zIndex: 2,
          background: 'linear-gradient(180deg, rgba(18,22,26,0.94) 0%, rgba(11,14,17,0.98) 100%)',
          backdropFilter: 'blur(36px) saturate(180%)',
          WebkitBackdropFilter: 'blur(36px) saturate(180%)',
          borderTop: '1px solid rgba(255,255,255,0.08)',
          borderRadius: '28px 28px 0 0',
          padding: '22px 28px 52px',
          boxShadow: '0 -28px 60px rgba(0,0,0,0.45)',
        }}
      >
        {/* Top highlight line */}
        <div
          style={{
            position: 'absolute', top: 0, left: '15%', right: '15%', height: '1px',
            background: 'linear-gradient(90deg, transparent, rgba(163,249,91,0.35), rgba(255,255,255,0.18), rgba(163,249,91,0.35), transparent)',
            pointerEvents: 'none',
          }}
        />

        {/* Progress dots */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: '6px', marginBottom: '18px' }}>
          {SLIDES.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrent(i)}
              style={{
                height: '6px',
                width: i === current ? '26px' : '6px',
                borderRadius: '3px',
                background: i === current ? LIME : 'rgba(255,255,255,0.18)',
                border: 'none', padding: 0, cursor: 'pointer',
                transition: 'all 280ms cubic-bezier(0.4,0,0.2,1)',
                boxShadow: i === current ? '0 0 10px rgba(163,249,91,0.55)' : 'none',
              }}
            />
          ))}
        </div>

        {/* Badge chip */}
        <div
          style={{
            display: 'inline-flex', alignItems: 'center', gap: '5px',
            padding: '5px 13px', borderRadius: '99px', marginBottom: '14px',
            background: 'rgba(163,249,91,0.09)', border: '1px solid rgba(163,249,91,0.28)',
            color: LIME, fontSize: '11px', fontWeight: 700, letterSpacing: '0.04em',
            opacity: exiting ? 0 : 1, transition: 'opacity 0.22s ease',
          }}
        >
          <slide.BadgeIcon size={12} strokeWidth={2.5} />
          {slide.badge}
        </div>

        {/* Title */}
        <h1
          dir="rtl"
          style={{
            fontSize: '27px', fontWeight: 800, color: '#f2f4f6',
            letterSpacing: '-0.02em', lineHeight: 1.22,
            margin: '0 0 10px',
            opacity: exiting ? 0 : 1,
            transform: exiting ? 'translateY(10px)' : 'translateY(0)',
            transition: 'opacity 0.22s ease, transform 0.22s ease',
          }}
        >
          {slide.title}
        </h1>

        {/* Description */}
        <p
          dir="rtl"
          style={{
            fontSize: '14px', color: 'rgba(255,255,255,0.48)',
            lineHeight: 1.65, margin: '0 0 22px',
            opacity: exiting ? 0 : 1,
            transition: 'opacity 0.22s ease',
          }}
        >
          {slide.description}
        </p>

        {/* CTA */}
        <button
          onClick={goNext}
          className="onboarding-cta"
          style={{
            background: `linear-gradient(135deg, #a3f95b 0%, #88dc41 100%)`,
            boxShadow: '0 0 28px rgba(163,249,91,0.4), 0 4px 20px rgba(0,0,0,0.35)',
          }}
        >
          <span style={{ color: '#0c2000', fontSize: '16px', fontWeight: 800 }}>
            {isLast ? 'ابدأ التجربة' : 'التالي'}
          </span>
          {isLast
            ? <Rocket size={20} color="#0c2000" strokeWidth={2.5} />
            : <ChevronLeft size={20} color="#0c2000" strokeWidth={2.5} />
          }
        </button>
      </div>
    </div>
  );
}
