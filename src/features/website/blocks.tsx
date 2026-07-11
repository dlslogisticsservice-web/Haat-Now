import React from 'react';
import { Star, Clock, Bike, Zap, Search } from 'lucide-react';
import type { WebsiteBlock, WebsiteCta, MerchantCard, DealCard } from '../../services/website.service';
import { WIcon, foodIconName } from './icons';

// ─────────────────────────────────────────────────────────────────────────────
// HaaT · Premium marketplace render layer (Visual Excellence v2).
// Every block renders from DESIGN TOKENS (var(--…)) so a theme/brand change re-skins
// the whole site with no rebuild. Motion is GPU-only (transform/opacity) and fully
// reduced-motion safe — no heavy libraries, Lighthouse-friendly. The content contract
// (WebsiteBlock) is unchanged: this file transforms only the visual experience.
// ─────────────────────────────────────────────────────────────────────────────

const sectionWrap: React.CSSProperties = { maxWidth: 1200, margin: '0 auto', padding: '0 24px' };

// Token helpers — one source of truth for the premium surface language.
const T = {
  primary: 'var(--color-primary-fixed, #a3f95b)',
  onPrimary: 'var(--color-on-primary-fixed, #0c2000)',
  accent: 'var(--color-tertiary-fixed, #6ee7ff)',
  bg: 'var(--color-background, #0a0f0c)',
  surf: 'var(--color-surface-container, #10160f)',
  surfHigh: 'var(--color-surface-container-high, #141a17)',
  on: 'var(--color-on-surface, #e8ebe3)',
  onVar: 'var(--color-on-surface-variant, #a7b0a6)',
  line: 'var(--color-outline-variant, #2a3330)',
  cardR: 'var(--card-radius, 20px)',
  btnR: 'var(--button-radius, 14px)',
};
// Hairline that adapts to the brand primary — gives depth without hard edges.
const hairline = `1px solid color-mix(in srgb, ${T.line} 82%, transparent)`;
const softShadow = '0 1px 2px rgba(0,0,0,.20), 0 12px 32px -12px rgba(0,0,0,.45)';

const Link: React.FC<{ href: string; label: string; primary?: boolean; large?: boolean; onNav: (p: string) => void }> = ({ href, label, primary = true, large, onNav }) => (
  <a href={href} onClick={e => { if (href.startsWith('/')) { e.preventDefault(); onNav(href); } }}
    className={primary ? 'hn-btn hn-btn-primary' : 'hn-btn hn-btn-ghost'}
    style={{
      display: 'inline-flex', alignItems: 'center', gap: 8, padding: large ? '15px 30px' : '13px 24px',
      borderRadius: T.btnR, fontWeight: 800, fontSize: large ? 16 : 15, cursor: 'pointer', textDecoration: 'none',
      background: primary ? T.primary : 'color-mix(in srgb, var(--color-surface, #0d120e) 60%, transparent)',
      color: primary ? T.onPrimary : T.on,
      border: primary ? 'none' : hairline,
      boxShadow: primary ? `0 8px 24px -8px color-mix(in srgb, ${T.primary} 70%, transparent)` : 'none',
      backdropFilter: primary ? undefined : 'blur(8px)',
    }}>{label}{primary && <span aria-hidden="true" style={{ fontSize: '1.05em', lineHeight: 1 }}>→</span>}</a>
);

// Small uppercase kicker that sits above section headings — a premium editorial signature.
const Eyebrow: React.FC<{ children: React.ReactNode; center?: boolean }> = ({ children, center }) => (
  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, margin: center ? '0 auto' : undefined, fontSize: 12.5, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: T.primary }}>
    <span aria-hidden="true" style={{ width: 22, height: 2, borderRadius: 2, background: `linear-gradient(90deg, ${T.primary}, transparent)` }} />
    {children}
  </span>
);

const SectionHead: React.FC<{ eyebrow?: string; heading: string; subtitle?: string; center?: boolean; action?: React.ReactNode }> = ({ eyebrow, heading, subtitle, center, action }) => (
  <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', textAlign: center ? 'center' : 'start' }}>
    <div style={{ margin: center ? '0 auto' : undefined, maxWidth: center ? 640 : undefined }}>
      {eyebrow && <div style={{ marginBottom: 12 }}><Eyebrow center={center}>{eyebrow}</Eyebrow></div>}
      <h2 style={hStyle}>{heading}</h2>
      {subtitle && <p style={{ color: T.onVar, marginTop: 8, fontSize: 16, lineHeight: 1.55, maxWidth: 620, marginInline: center ? 'auto' : undefined }}>{subtitle}</p>}
    </div>
    {action}
  </div>
);

export const BlockRenderer: React.FC<{ block: WebsiteBlock; onNav: (path: string) => void }> = ({ block, onNav }) => {
  const link = (href: string, label: string, primary = true, large = false) => <Link href={href} label={label} primary={primary} large={large} onNav={onNav} />;

  switch (block.type) {
    case 'hero': {
      const bg = block.bgImage, vid = block.bgVideo;
      const onMedia = !!(bg || vid);
      const overlay = block.overlay ?? (onMedia ? 0.55 : 0);
      const left = block.layout === 'left';
      const ctas: WebsiteCta[] = block.ctas && block.ctas.length ? block.ctas : (block.cta ? [{ label: block.cta.label, href: block.cta.href, style: 'primary' }] : []);
      const txt = onMedia ? '#ffffff' : T.on;
      const sub = onMedia ? 'rgba(255,255,255,0.9)' : T.onVar;
      return (
        <section className="hn-hero" style={{ position: 'relative', padding: left ? 'clamp(52px,7vw,88px) 0 clamp(40px,5vw,64px)' : 'clamp(72px,10vw,132px) 0 clamp(52px,7vw,92px)', textAlign: left ? 'start' : 'center', overflow: 'hidden' }}>
          {vid && <video src={vid} autoPlay muted loop playsInline aria-hidden="true" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />}
          {!vid && bg && <div aria-hidden="true" style={{ position: 'absolute', inset: 0, background: `url(${bg}) center/cover no-repeat` }} />}
          {onMedia && <div aria-hidden="true" style={{ position: 'absolute', inset: 0, background: `linear-gradient(180deg, rgba(0,0,0,${overlay * 0.7}), rgba(0,0,0,${overlay}))` }} />}
          {!onMedia && (
            <>
              <div aria-hidden="true" className="hn-orb hn-orb-a" />
              <div aria-hidden="true" className="hn-orb hn-orb-b" />
              <div aria-hidden="true" style={{ position: 'absolute', inset: 0, background: 'radial-gradient(120% 80% at 50% -20%, color-mix(in srgb, var(--color-primary-fixed,#a3f95b) 8%, transparent), transparent 60%)', maskImage: 'radial-gradient(120% 100% at 50% 0%, #000, transparent 75%)' }} />
              <div aria-hidden="true" className="hn-grid-fade" />
            </>
          )}
          <div className="hn-fade" style={{ ...sectionWrap, position: 'relative', maxWidth: left ? 1200 : 900 }}>
            {block.chips && !left && (
              <div className="hn-fade-1" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '7px 14px', borderRadius: 999, marginBottom: 22, fontSize: 13, fontWeight: 700, color: onMedia ? '#fff' : T.on, background: onMedia ? 'rgba(255,255,255,0.14)' : `color-mix(in srgb, ${T.primary} 12%, transparent)`, border: onMedia ? '1px solid rgba(255,255,255,0.25)' : `1px solid color-mix(in srgb, ${T.primary} 32%, transparent)`, backdropFilter: 'blur(8px)' }}>
                <span aria-hidden="true" style={{ width: 8, height: 8, borderRadius: 999, background: T.primary, boxShadow: `0 0 12px ${T.primary}` }} />
                Launching soon in your city
              </div>
            )}
            <h1 className="hn-fade-1" style={{ fontSize: left ? 'clamp(30px,5.5vw,50px)' : 'clamp(36px,7vw,72px)', fontWeight: 900, lineHeight: 1.02, letterSpacing: '-0.03em', color: txt, margin: 0, maxWidth: left ? 720 : undefined }}>{renderHeroTitle(block.title, onMedia)}</h1>
            {block.subtitle && <p className="hn-fade-2" style={{ fontSize: 'clamp(16px,2.2vw,21px)', lineHeight: 1.55, color: sub, maxWidth: 640, margin: left ? '20px 0 0' : '20px auto 0' }}>{block.subtitle}</p>}
            {block.search && <div className="hn-fade-2"><HeroSearch placeholder={block.searchPlaceholder} action={block.searchAction} center={!left} onMedia={onMedia} onNav={onNav} /></div>}
            {block.chips && block.chips.length > 0 && (
              <div className="hn-fade-3" style={{ marginTop: 18, display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: left ? 'flex-start' : 'center' }}>
                {block.chips.map(c => (
                  <a key={c.path} href={c.path} onClick={e => { if (c.path.startsWith('/')) { e.preventDefault(); onNav(c.path); } }}
                    className="hn-chip" style={{ padding: '9px 16px', borderRadius: 999, fontSize: 14, fontWeight: 700, textDecoration: 'none', color: onMedia ? '#fff' : T.on, background: onMedia ? 'rgba(255,255,255,0.14)' : T.surfHigh, border: hairline }}>{c.label}</a>
                ))}
              </div>
            )}
            {ctas.length > 0 && <div className="hn-fade-3" style={{ marginTop: 30, display: 'flex', gap: 14, justifyContent: left ? 'flex-start' : 'center', flexWrap: 'wrap' }}>{ctas.map((c, i) => <React.Fragment key={i}>{link(c.href, c.label, c.style !== 'secondary', true)}</React.Fragment>)}</div>}
            {!left && <TrustRow onMedia={onMedia} />}
          </div>
        </section>
      );
    }
    case 'features':
      return (
        <section style={{ padding: 'clamp(40px,6vw,72px) 0' }}>
          <div style={sectionWrap}>
            {block.heading && <SectionHead eyebrow="Why HaaT" heading={block.heading} />}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: 18, marginTop: 32 }}>
              {block.items.map((it, i) => (
                <div key={i} className="hn-lift" style={{ ...cardStyle, position: 'relative', overflow: 'hidden' }}>
                  <span aria-hidden="true" style={{ position: 'absolute', inset: 0, background: `radial-gradient(120% 100% at 0% 0%, color-mix(in srgb, ${T.primary} 8%, transparent), transparent 55%)`, opacity: 0.9 }} />
                  {it.icon && <div style={{ position: 'relative', width: 52, height: 52, borderRadius: 15, display: 'grid', placeItems: 'center', color: T.primary, marginBottom: 16, background: `color-mix(in srgb, ${T.primary} 14%, transparent)`, border: `1px solid color-mix(in srgb, ${T.primary} 28%, transparent)` }}><WIcon name={it.icon} size={24} /></div>}
                  <h3 style={{ position: 'relative', fontSize: 18, fontWeight: 800, color: T.on, margin: 0, letterSpacing: '-0.01em' }}>{it.title}</h3>
                  <p style={{ position: 'relative', color: T.onVar, marginTop: 8, fontSize: 14.5, lineHeight: 1.6 }}>{it.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      );
    case 'cards': {
      // Premium action cards — when items have no image they render as bold gradient CTA cards
      // (used by "Grow with us"); with images they become editorial media cards.
      const hasImages = block.items.some(it => it.image);
      return (
        <section style={{ padding: 'clamp(40px,6vw,72px) 0' }}>
          <div style={sectionWrap}>
            {block.heading && <SectionHead eyebrow="Join the movement" heading={block.heading} />}
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fit, minmax(${hasImages ? 260 : 280}px, 1fr))`, gap: 18, marginTop: 32 }}>
              {block.items.map((it, i) => {
                const inner = hasImages ? (
                  <div className="hn-media-card" style={{ ...cardStyle, padding: 0, overflow: 'hidden', height: '100%' }}>
                    {it.image && <div style={{ overflow: 'hidden' }}><img className="hn-zoom" src={it.image} alt={it.title} loading="lazy" decoding="async" style={{ width: '100%', aspectRatio: '16/10', objectFit: 'cover', display: 'block' }} /></div>}
                    <div style={{ padding: 20 }}>
                      <h3 style={{ fontSize: 18, fontWeight: 800, color: T.on, margin: 0 }}>{it.title}</h3>
                      <p style={{ color: T.onVar, marginTop: 8, fontSize: 14.5, lineHeight: 1.6 }}>{it.body}</p>
                    </div>
                  </div>
                ) : (
                  <div className="hn-lift" style={{ position: 'relative', height: '100%', overflow: 'hidden', borderRadius: T.cardR, padding: 26, background: `linear-gradient(155deg, ${T.surfHigh}, var(--color-surface-container, #10160f))`, border: hairline, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 22, minHeight: 180 }}>
                    <span aria-hidden="true" style={{ position: 'absolute', top: -40, right: -40, width: 140, height: 140, borderRadius: 999, background: `radial-gradient(circle, color-mix(in srgb, ${T.primary} 22%, transparent), transparent 70%)` }} />
                    <div style={{ position: 'relative' }}>
                      <h3 style={{ fontSize: 20, fontWeight: 800, color: T.on, margin: 0, letterSpacing: '-0.01em' }}>{it.title.replace(/\s*→\s*$/, '')}</h3>
                      <p style={{ color: T.onVar, marginTop: 10, fontSize: 15, lineHeight: 1.6 }}>{it.body}</p>
                    </div>
                    <span className="hn-arrow" aria-hidden="true" style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', gap: 8, fontWeight: 800, color: T.primary }}>Learn more →</span>
                  </div>
                );
                return it.href ? <a key={i} href={it.href} onClick={e => { if (it.href!.startsWith('/')) { e.preventDefault(); onNav(it.href!); } }} style={{ textDecoration: 'none' }}>{inner}</a> : <div key={i}>{inner}</div>;
              })}
            </div>
          </div>
        </section>
      );
    }
    case 'stats':
      return (
        <section style={{ padding: 'clamp(40px,6vw,72px) 0' }}>
          <div style={sectionWrap}>
            <div style={{ ...cardStyle, padding: 'clamp(28px,4vw,44px)', background: `linear-gradient(155deg, ${T.surfHigh}, var(--color-surface-container, #10160f))` }}>
              {block.heading && <h2 style={{ ...hStyle, textAlign: 'center', fontSize: 'clamp(20px,3vw,26px)' }}>{block.heading}</h2>}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 20, marginTop: 24 }}>
                {block.items.map((it, i) => (
                  <div key={i} style={{ textAlign: 'center' }}>
                    <p style={{ fontSize: 'clamp(30px,4.5vw,46px)', fontWeight: 900, letterSpacing: '-0.03em', margin: 0, background: `linear-gradient(180deg, ${T.on}, ${T.primary})`, WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }}>{it.value}</p>
                    <p style={{ color: T.onVar, marginTop: 6, fontSize: 13.5, fontWeight: 600 }}>{it.label}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      );
    case 'testimonials':
      return (
        <section style={{ padding: 'clamp(40px,6vw,72px) 0' }}>
          <div style={sectionWrap}>
            {block.heading && <SectionHead eyebrow="Loved locally" heading={block.heading} />}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 18, marginTop: 32 }}>
              {block.items.map((t, i) => (
                <figure key={i} className="hn-lift" style={{ ...cardStyle, margin: 0 }}>
                  <div aria-hidden="true" style={{ fontSize: 40, lineHeight: 0.6, color: T.primary, fontFamily: 'Georgia, serif' }}>“</div>
                  <blockquote style={{ color: T.on, fontSize: 16, lineHeight: 1.65, margin: '6px 0 0' }}>{t.quote}</blockquote>
                  <figcaption style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 18 }}>
                    {t.avatar ? <img src={t.avatar} alt="" loading="lazy" style={{ width: 40, height: 40, borderRadius: 999, objectFit: 'cover' }} /> : <span aria-hidden="true" style={{ width: 40, height: 40, borderRadius: 999, display: 'grid', placeItems: 'center', fontWeight: 800, background: `color-mix(in srgb, ${T.primary} 16%, transparent)`, color: T.primary }}>{t.author.charAt(0)}</span>}
                    <div><p style={{ fontWeight: 800, fontSize: 14, color: T.on, margin: 0 }}>{t.author}</p>{t.role && <p style={{ fontSize: 12, color: T.onVar, margin: 0 }}>{t.role}</p>}</div>
                  </figcaption>
                </figure>
              ))}
            </div>
          </div>
        </section>
      );
    case 'partners':
      return (
        <section style={{ padding: 'clamp(28px,4vw,44px) 0' }}>
          <div style={sectionWrap}>
            {block.heading && <p style={{ textAlign: 'center', fontSize: 13, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: T.onVar, margin: 0 }}>{block.heading}</p>}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 36, alignItems: 'center', justifyContent: 'center', marginTop: 20, opacity: 0.7 }}>
              {block.logos.map((src, i) => <img key={i} src={src} alt={`Partner ${i + 1}`} loading="lazy" decoding="async" style={{ height: 30, objectFit: 'contain', filter: 'grayscale(1) brightness(1.6)' }} />)}
            </div>
          </div>
        </section>
      );
    case 'app_download':
      return (
        <section style={{ padding: 'clamp(40px,6vw,72px) 0' }}>
          <div style={sectionWrap}>
            <div style={{ position: 'relative', overflow: 'hidden', borderRadius: T.cardR, border: hairline, background: `linear-gradient(135deg, color-mix(in srgb, ${T.primary} 16%, var(--color-surface-container-high,#141a17)), var(--color-surface-container,#10160f))`, display: 'flex', flexWrap: 'wrap', gap: 28, alignItems: 'center', justifyContent: 'space-between', padding: 'clamp(28px,4vw,48px)' }}>
              <span aria-hidden="true" className="hn-orb hn-orb-b" style={{ opacity: 0.5 }} />
              <div style={{ position: 'relative', flex: 1, minWidth: 260 }}>
                <Eyebrow>Get the app</Eyebrow>
                <h2 style={{ ...hStyle, marginTop: 12 }}>{block.heading}</h2>
                {block.subtitle && <p style={{ color: T.onVar, marginTop: 10, fontSize: 16, lineHeight: 1.55, maxWidth: 460 }}>{block.subtitle}</p>}
                <div style={{ display: 'flex', gap: 12, marginTop: 22, flexWrap: 'wrap' }}>
                  {block.iosUrl && <a href={block.iosUrl} target="_blank" rel="noreferrer" style={storeBtn}> App Store</a>}
                  {block.androidUrl && <a href={block.androidUrl} target="_blank" rel="noreferrer" style={storeBtn}>▶ Google Play</a>}
                  {!block.iosUrl && !block.androidUrl && <span style={{ ...storeBtn, opacity: 0.7, display: 'inline-flex', alignItems: 'center', gap: 8 }}><Zap size={16} />Coming soon</span>}
                </div>
              </div>
              {block.image && <img src={block.image} alt={block.heading} loading="lazy" decoding="async" style={{ position: 'relative', maxHeight: 260, borderRadius: 20 }} />}
            </div>
          </div>
        </section>
      );
    case 'cta':
      return (
        <section style={{ padding: 'clamp(44px,6vw,80px) 0' }}>
          <div style={sectionWrap}>
            <div style={{ position: 'relative', overflow: 'hidden', textAlign: 'center', padding: 'clamp(36px,5vw,64px) clamp(24px,4vw,48px)', borderRadius: T.cardR, border: `1px solid color-mix(in srgb, ${T.primary} 30%, transparent)`, background: `radial-gradient(120% 120% at 50% 0%, color-mix(in srgb, ${T.primary} 14%, transparent), var(--color-surface-container,#10160f) 70%)` }}>
              <span aria-hidden="true" className="hn-orb hn-orb-a" style={{ opacity: 0.4 }} />
              <h2 style={{ ...hStyle, position: 'relative', marginTop: 0, fontSize: 'clamp(26px,4.5vw,40px)' }}>{block.title}</h2>
              {block.subtitle && <p style={{ position: 'relative', color: T.onVar, marginTop: 12, fontSize: 17, maxWidth: 540, marginInline: 'auto' }}>{block.subtitle}</p>}
              <div style={{ position: 'relative', marginTop: 26, display: 'flex', justifyContent: 'center' }}>{link(block.button.href, block.button.label, true, true)}</div>
            </div>
          </div>
        </section>
      );
    case 'richtext':
      return (
        <section style={{ padding: 'clamp(36px,5vw,56px) 0' }}>
          <div style={{ ...sectionWrap, maxWidth: 780 }}>
            {block.heading && <h2 style={hStyle}>{block.heading}</h2>}
            <p style={{ color: 'var(--color-on-surface, #c4ccbf)', fontSize: 17, lineHeight: 1.75, marginTop: 14, whiteSpace: 'pre-wrap' }}>{block.body}</p>
          </div>
        </section>
      );
    case 'gallery':
      return (
        <section style={{ padding: 'clamp(36px,5vw,56px) 0' }}>
          <div style={sectionWrap}>
            {block.heading && <SectionHead heading={block.heading} />}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 14, marginTop: 24 }}>
              {block.images.map((src, i) => <div key={i} style={{ overflow: 'hidden', borderRadius: T.cardR }}><img className="hn-zoom" src={src} alt={block.heading ? `${block.heading} — ${i + 1}` : `Gallery image ${i + 1}`} loading="lazy" decoding="async" style={{ width: '100%', objectFit: 'cover', aspectRatio: '4/3', display: 'block' }} /></div>)}
            </div>
          </div>
        </section>
      );
    case 'faq':
      return (
        <section style={{ padding: 'clamp(40px,6vw,72px) 0' }}>
          <div style={{ ...sectionWrap, maxWidth: 860 }}>
            {block.heading && <SectionHead eyebrow="Good to know" heading={block.heading} />}
            <div style={{ marginTop: 28, display: 'grid', gap: 12 }}>
              {block.items.map((f, i) => (
                <details key={i} className="hn-faq" style={{ ...cardStyle, padding: 0 }}>
                  <summary style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, cursor: 'pointer', listStyle: 'none', padding: '18px 20px', fontWeight: 700, fontSize: 16, color: T.on }}>
                    {f.q}<span className="hn-faq-plus" aria-hidden="true" style={{ flexShrink: 0, color: T.primary, fontSize: 22, lineHeight: 1, transition: 'transform .2s ease' }}>+</span>
                  </summary>
                  <p style={{ color: T.onVar, margin: 0, padding: '0 20px 18px', fontSize: 15, lineHeight: 1.6 }}>{f.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>
      );
    case 'contact':
      return (
        <section style={{ padding: 'clamp(36px,5vw,56px) 0' }}>
          <div style={{ ...sectionWrap, maxWidth: 640 }}>
            {block.heading && <SectionHead heading={block.heading} />}
            <div style={{ ...cardStyle, marginTop: 24, display: 'grid', gap: 4 }}>
              {block.email && <ContactRow label="Email" node={<a href={`mailto:${block.email}`} style={{ color: T.primary, fontWeight: 600, textDecoration: 'none' }}>{block.email}</a>} />}
              {block.phone && <ContactRow label="Phone" node={<span style={{ color: T.on }}>{block.phone}</span>} />}
              {block.address && <ContactRow label="Address" node={<span style={{ color: T.on }}>{block.address}</span>} />}
            </div>
          </div>
        </section>
      );
    case 'categories':
      return (
        <section style={{ padding: 'clamp(32px,5vw,56px) 0' }}>
          <div style={sectionWrap}>
            {block.heading && <SectionHead eyebrow="Explore" heading={block.heading} subtitle={block.subtitle} />}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(124px, 1fr))', gap: 14, marginTop: 28 }}>
              {block.items.map((c, i) => (
                <a key={i} href={c.href} onClick={e => { if (c.href.startsWith('/')) { e.preventDefault(); onNav(c.href); } }}
                  className="hn-cat" aria-label={c.label}
                  style={{ ...cardStyle, padding: '22px 12px', textAlign: 'center', textDecoration: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
                  <span className="hn-cat-icon" style={{ width: 58, height: 58, borderRadius: 18, display: 'grid', placeItems: 'center', color: T.on, background: c.tint || `color-mix(in srgb, ${T.primary} 12%, ${T.surfHigh})`, border: `1px solid color-mix(in srgb, ${T.primary} 20%, transparent)`, transition: 'transform .2s ease' }}><WIcon name={c.icon || foodIconName(c.label)} size={26} strokeWidth={1.8} /></span>
                  <span style={{ fontSize: 14, fontWeight: 700, color: T.on }}>{c.label}</span>
                </a>
              ))}
            </div>
          </div>
        </section>
      );
    case 'deals':
      return (
        <section style={{ padding: 'clamp(32px,5vw,52px) 0' }}>
          <div style={sectionWrap}>
            {block.heading && <SectionHead eyebrow="Limited time" heading={block.heading} subtitle={block.subtitle} />}
            <div className="hn-rail" role="group" aria-label={block.heading || 'Offers'} tabIndex={0} style={{ display: 'grid', gridAutoFlow: 'column', gridAutoColumns: 'minmax(272px, 1fr)', gap: 16, marginTop: 26, overflowX: 'auto', paddingBottom: 10, scrollSnapType: 'x mandatory' }}>
              {block.items.map((d, i) => <DealTile key={i} d={d} onNav={onNav} />)}
            </div>
          </div>
        </section>
      );
    case 'merchants':
      return <MerchantsBlock block={block} onNav={onNav} />;
    case 'waitlist':
      return (
        <section style={{ padding: 'clamp(44px,6vw,80px) 0' }}>
          <div style={{ ...sectionWrap, maxWidth: 680 }}>
            <div style={{ position: 'relative', overflow: 'hidden', textAlign: 'center', padding: 'clamp(32px,5vw,52px)', borderRadius: T.cardR, border: `1px solid color-mix(in srgb, ${T.primary} 26%, transparent)`, background: `radial-gradient(120% 140% at 50% -20%, color-mix(in srgb, ${T.primary} 14%, transparent), var(--color-surface-container,#10160f) 65%)` }}>
              <span aria-hidden="true" className="hn-orb hn-orb-a" style={{ opacity: 0.4 }} />
              <div style={{ position: 'relative' }}>
                {block.badge && <div style={{ marginBottom: 16 }}><span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 14px', borderRadius: 999, fontSize: 12.5, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', background: `color-mix(in srgb, ${T.primary} 18%, transparent)`, color: T.primary, border: `1px solid color-mix(in srgb, ${T.primary} 34%, transparent)` }}><span aria-hidden="true" style={{ width: 7, height: 7, borderRadius: 999, background: T.primary, boxShadow: `0 0 10px ${T.primary}` }} />{block.badge}</span></div>}
                {block.heading && <h2 style={{ ...hStyle, textAlign: 'center', fontSize: 'clamp(26px,4.5vw,38px)' }}>{block.heading}</h2>}
                {block.subtitle && <p style={{ color: T.onVar, marginTop: 12, fontSize: 16.5, lineHeight: 1.55, maxWidth: 500, marginInline: 'auto' }}>{block.subtitle}</p>}
                <Waitlist placeholder={block.placeholder} cta={block.cta} note={block.note} />
              </div>
            </div>
          </div>
        </section>
      );
    case 'steps':
      return (
        <section style={{ padding: 'clamp(44px,6vw,80px) 0' }}>
          <div style={sectionWrap}>
            <SectionHead eyebrow="How it works" heading={block.heading || ''} subtitle={block.subtitle} center />
            <div className="hn-steps" style={{ position: 'relative', display: 'grid', gridTemplateColumns: `repeat(auto-fit, minmax(220px, 1fr))`, gap: 20, marginTop: 40 }}>
              {block.items.map((s, i) => (
                <div key={i} style={{ position: 'relative', textAlign: 'center' }}>
                  <div aria-hidden="true" style={{ position: 'relative', width: 62, height: 62, borderRadius: 20, margin: '0 auto', display: 'grid', placeItems: 'center', fontSize: 28, background: `color-mix(in srgb, ${T.primary} 14%, ${T.surfHigh})`, border: `1px solid color-mix(in srgb, ${T.primary} 28%, transparent)`, boxShadow: `0 10px 30px -12px color-mix(in srgb, ${T.primary} 50%, transparent)` }}>
                    {s.icon ? <WIcon name={s.icon} size={26} /> : i + 1}
                    <span style={{ position: 'absolute', top: -8, right: -8, width: 24, height: 24, borderRadius: 999, display: 'grid', placeItems: 'center', fontSize: 12, fontWeight: 900, background: T.primary, color: T.onPrimary }}>{i + 1}</span>
                  </div>
                  <h3 style={{ fontSize: 18, fontWeight: 800, color: T.on, marginTop: 16, letterSpacing: '-0.01em' }}>{s.title}</h3>
                  <p style={{ color: T.onVar, marginTop: 8, fontSize: 15, lineHeight: 1.6, maxWidth: 280, marginInline: 'auto' }}>{s.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      );
    default:
      return null;
  }
};

// ── Hero helpers ────────────────────────────────────────────────────────────────
// Emphasise the final phrase of a hero title with the brand gradient (editorial accent).
function renderHeroTitle(title: string, onMedia: boolean): React.ReactNode {
  if (onMedia) return title;
  const parts = title.split('—');
  if (parts.length === 2) {
    return <>{parts[0]}<span style={{ background: `linear-gradient(120deg, ${T.primary}, ${T.accent})`, WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }}>— {parts[1].trim()}</span></>;
  }
  return title;
}

const TrustRow: React.FC<{ onMedia: boolean }> = ({ onMedia }) => {
  const col = onMedia ? 'rgba(255,255,255,0.9)' : T.onVar;
  const items = [{ icon: 'cash', label: 'Cash on delivery' }, { icon: 'pin', label: 'Live order tracking' }, { icon: 'delivery', label: 'Fast local delivery' }];
  return (
    <div style={{ marginTop: 34, display: 'flex', gap: 22, flexWrap: 'wrap', justifyContent: 'center' }}>
      {items.map(it => (
        <span key={it.label} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 600, color: col }}>
          <WIcon name={it.icon} size={17} />{it.label}
        </span>
      ))}
    </div>
  );
};

/** Pre-launch waitlist / Notify-me. Client-only: stores the email locally and confirms. */
const Waitlist: React.FC<{ placeholder?: string; cta?: string; note?: string }> = ({ placeholder, cta, note }) => {
  const [email, setEmail] = React.useState('');
  const [done, setDone] = React.useState(false);
  const valid = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim());
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid) return;
    try {
      const key = 'haat_waitlist_emails';
      const list: string[] = JSON.parse(localStorage.getItem(key) || '[]');
      if (!list.includes(email.trim().toLowerCase())) list.push(email.trim().toLowerCase());
      localStorage.setItem(key, JSON.stringify(list));
    } catch { /* private mode — still confirm */ }
    setDone(true);
  };
  if (done) return (
    <div role="status" style={{ marginTop: 24, padding: 20, borderRadius: T.cardR, background: `color-mix(in srgb, ${T.primary} 12%, transparent)`, border: `1px solid color-mix(in srgb, ${T.primary} 26%, transparent)` }}>
      <p style={{ fontWeight: 800, fontSize: 18, color: T.on, margin: 0, display: 'inline-flex', alignItems: 'center', gap: 8 }}><WIcon name="celebrate" size={18} color={T.primary} />You're on the list</p>
      <p style={{ color: T.onVar, fontSize: 14.5, margin: '6px 0 0' }}>We'll email you the moment HaaT Now goes live in your city.</p>
    </div>
  );
  return (
    <form onSubmit={submit} style={{ marginTop: 26 }}>
      <div className="hn-field" style={{ display: 'flex', gap: 8, maxWidth: 480, margin: '0 auto', background: 'var(--color-surface-container, #10160f)', border: hairline, borderRadius: T.btnR, padding: 7, boxShadow: softShadow }}>
        <input type="email" required value={email} onChange={e => setEmail(e.target.value)} aria-label="Email address"
          placeholder={placeholder || 'you@email.com'}
          style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', color: T.on, fontSize: 15, padding: '11px 14px' }} />
        <button type="submit" disabled={!valid} className="hn-btn-primary" style={{ padding: '12px 22px', borderRadius: 'calc(var(--button-radius, 14px) - 3px)', border: 'none', cursor: valid ? 'pointer' : 'not-allowed', opacity: valid ? 1 : 0.5, fontWeight: 800, background: T.primary, color: T.onPrimary, whiteSpace: 'nowrap' }}>{cta || 'Notify me'}</button>
      </div>
      {note && <p style={{ color: T.onVar, fontSize: 12.5, marginTop: 12 }}>{note}</p>}
    </form>
  );
};

const HeroSearch: React.FC<{ placeholder?: string; action?: string; center?: boolean; onMedia?: boolean; onNav: (p: string) => void }> = ({ placeholder, action = '/restaurants', center, onNav }) => {
  const [q, setQ] = React.useState('');
  const submit = (e: React.FormEvent) => { e.preventDefault(); const to = q.trim() ? `${action}?q=${encodeURIComponent(q.trim())}` : action; onNav(to); };
  return (
    <form role="search" onSubmit={submit} className="hn-field" style={{ marginTop: 30, display: 'flex', gap: 8, maxWidth: 600, marginInline: center ? 'auto' : undefined, background: 'color-mix(in srgb, var(--color-surface-container, #10160f) 78%, transparent)', border: hairline, borderRadius: T.btnR, padding: 8, boxShadow: '0 18px 50px -18px rgba(0,0,0,.6)', backdropFilter: 'blur(14px) saturate(1.3)', WebkitBackdropFilter: 'blur(14px) saturate(1.3)' }}>
      <span style={{ display: 'grid', placeItems: 'center', paddingInlineStart: 12, color: T.onVar }}><Search size={18} /></span>
      <input value={q} onChange={e => setQ(e.target.value)} aria-label="Search for restaurants, groceries and stores" placeholder={placeholder || 'Search restaurants, groceries, pharmacies…'}
        style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', color: T.on, fontSize: 16, padding: '12px 4px' }} />
      <button type="submit" className="hn-btn-primary" style={{ padding: '13px 26px', borderRadius: 'calc(var(--button-radius, 14px) - 4px)', border: 'none', cursor: 'pointer', fontWeight: 800, fontSize: 15, background: T.primary, color: T.onPrimary }}>Search</button>
    </form>
  );
};

// ── Merchant cards (multiple premium layouts) ────────────────────────────────────
const MetaRow: React.FC<{ m: MerchantCard }> = ({ m }) => (
  <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginTop: 12, fontSize: 13, color: T.onVar }}>
    {typeof m.rating === 'number' && (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 9px', borderRadius: 999, fontWeight: 800, color: T.on, background: T.surfHigh, border: hairline }}>
        <Star size={13} fill="#ffc93c" color="#ffc93c" />{m.rating.toFixed(1)}{m.reviews ? <span style={{ fontWeight: 500, color: T.onVar }}>({m.reviews}+)</span> : null}
      </span>
    )}
    {m.eta && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Clock size={13} />{m.eta}</span>}
    {m.fee && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: /free/i.test(m.fee) ? T.primary : T.onVar, fontWeight: /free/i.test(m.fee) ? 700 : 500 }}><Bike size={13} />{m.fee}</span>}
    {m.distance && <span>· {m.distance}</span>}
  </div>
);

const CardCover: React.FC<{ m: MerchantCard; height: number }> = ({ m, height }) => (
  <div className="hn-cover" style={{ position: 'relative', height, background: m.image ? undefined : gradientFor(m.name), display: 'grid', placeItems: 'center', overflow: 'hidden' }}>
    {m.image && <img className="hn-zoom" src={m.image} alt={m.name} loading="lazy" decoding="async" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />}
    {!m.image && <WIcon name={foodIconName(`${m.name} ${m.cuisine || ''}`)} size={46} color="#ffffff" strokeWidth={1.5} style={{ filter: 'drop-shadow(0 6px 14px rgba(0,0,0,.4))' }} />}
    <span aria-hidden="true" style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(0,0,0,.05) 40%, rgba(0,0,0,.4))' }} />
    {m.promo && <span style={badge('promo')}>{m.promo}</span>}
    {m.badge && <span style={badge('info')}>{m.badge}</span>}
    {m.closed && <span style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', background: 'rgba(0,0,0,.5)', backdropFilter: 'blur(1px)', color: '#fff', fontWeight: 800, fontSize: 14, letterSpacing: 0.5 }}>Closed</span>}
  </div>
);

// Parse the leading number out of an ETA string like "20–30 min" → 20 (for sort/filter).
function etaMin(m: MerchantCard): number { const n = (m.eta || '').match(/\d+/); return n ? Number(n[0]) : 999; }
type MerchFilter = 'all' | 'offers' | 'free' | 'top' | 'fast';
const MERCH_FILTERS: { k: MerchFilter; label: string }[] = [
  { k: 'all', label: 'All' }, { k: 'offers', label: 'Offers' }, { k: 'free', label: 'Free delivery' }, { k: 'top', label: 'Top rated' }, { k: 'fast', label: 'Fast' },
];
type MerchSort = 'recommended' | 'rating' | 'eta';

/** Merchants section — Featured card + grid/rail, with client-side discovery filter + sort on the
 *  existing card fields (grid layout only). No new data source; reuses the curated/live items. */
const MerchantsBlock: React.FC<{ block: Extract<WebsiteBlock, { type: 'merchants' }>; onNav: (p: string) => void }> = ({ block, onNav }) => {
  const rail = block.layout === 'rail';
  const [filter, setFilter] = React.useState<MerchFilter>('all');
  const [sort, setSort] = React.useState<MerchSort>('recommended');
  const showControls = !rail && block.items.length >= 6;

  const matches = (m: MerchantCard): boolean => {
    switch (filter) {
      case 'offers': return !!m.promo;
      case 'free': return /free/i.test(m.fee || '');
      case 'top': return (m.rating ?? 0) >= 4.7;
      case 'fast': return etaMin(m) <= 25;
      default: return true;
    }
  };
  let items = showControls ? block.items.filter(matches) : block.items;
  if (showControls && sort !== 'recommended') items = [...items].sort((a, b) => sort === 'rating' ? (b.rating ?? 0) - (a.rating ?? 0) : etaMin(a) - etaMin(b));

  const useFeatured = !rail && !showControls && items.length >= 4; // keep the editorial hero for small curated grids
  const gridStyle: React.CSSProperties = rail
    ? { display: 'grid', gridAutoFlow: 'column', gridAutoColumns: 'minmax(248px, 1fr)', gap: 16, overflowX: 'auto', paddingBottom: 10, scrollSnapType: 'x mandatory' }
    : { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(248px, 1fr))', gap: 16 };
  const chip = (active: boolean): React.CSSProperties => ({ padding: '8px 14px', borderRadius: 999, fontSize: 13, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap', border: active ? `1px solid ${T.primary}` : hairline, background: active ? `color-mix(in srgb, ${T.primary} 16%, transparent)` : T.surfHigh, color: active ? T.primary : T.on });

  return (
    <section style={{ padding: 'clamp(28px,4vw,44px) 0' }}>
      <div style={sectionWrap}>
        <SectionHead
          eyebrow={rail ? 'Featured' : undefined}
          heading={block.heading || ''}
          subtitle={block.subtitle}
          action={block.viewAll && <a href={block.viewAll.href} onClick={e => { if (block.viewAll!.href.startsWith('/')) { e.preventDefault(); onNav(block.viewAll!.href); } }} className="hn-arrow" style={{ color: T.primary, fontSize: 14, fontWeight: 800, textDecoration: 'none', whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: 6 }}>{block.viewAll.label} →</a>}
        />
        {showControls && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 20, flexWrap: 'wrap' }}>
            <div role="group" aria-label="Filter" className="hn-rail" style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 2, flex: 1, minWidth: 0 }}>
              {MERCH_FILTERS.map(f => <button key={f.k} onClick={() => setFilter(f.k)} aria-pressed={filter === f.k} className="hn-chip" style={chip(filter === f.k)}>{f.label}</button>)}
            </div>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: T.onVar }}>
              <span>Sort</span>
              <select aria-label="Sort merchants" value={sort} onChange={e => setSort(e.target.value as MerchSort)} style={{ padding: '8px 10px', borderRadius: 10, border: hairline, background: T.surfHigh, color: T.on, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                <option value="recommended">Recommended</option><option value="rating">Top rated</option><option value="eta">Fastest</option>
              </select>
            </label>
          </div>
        )}
        {useFeatured && <div style={{ marginTop: 26 }}><FeaturedMerchant m={items[0]} onNav={onNav} /></div>}
        {items.length === 0 ? (
          <p style={{ marginTop: 22, padding: '28px 0', textAlign: 'center', color: T.onVar }}>No stores match this filter yet — try another.</p>
        ) : (
          <div className={rail ? 'hn-rail' : undefined} role={rail ? 'group' : undefined} aria-label={rail ? (block.heading || 'Merchants') : undefined} tabIndex={rail ? 0 : undefined} style={{ ...gridStyle, marginTop: useFeatured ? 16 : (showControls ? 18 : 26) }}>
            {(useFeatured ? items.slice(1) : items).map((m, i) => <MerchantTile key={i} m={m} snap={rail} onNav={onNav} />)}
          </div>
        )}
      </div>
    </section>
  );
};

const MerchantTile: React.FC<{ m: MerchantCard; snap?: boolean; onNav: (p: string) => void }> = ({ m, snap, onNav }) => {
  const inner = (
    <div className="hn-lift hn-media-card" style={{ ...cardStyle, padding: 0, overflow: 'hidden', opacity: m.closed ? 0.72 : 1, scrollSnapAlign: snap ? 'start' : undefined, height: '100%' }}>
      <CardCover m={m} height={140} />
      <div style={{ padding: 16 }}>
        <h3 style={{ fontSize: 16, fontWeight: 800, color: T.on, margin: 0, letterSpacing: '-0.01em' }}>{m.name}</h3>
        {m.cuisine && <p style={{ color: T.onVar, fontSize: 13.5, margin: '4px 0 0' }}>{m.cuisine}</p>}
        <MetaRow m={m} />
      </div>
    </div>
  );
  return m.href
    ? <a href={m.href} aria-label={m.name} onClick={e => { if (m.href!.startsWith('/')) { e.preventDefault(); onNav(m.href!); } }} style={{ textDecoration: 'none' }}>{inner}</a>
    : <div>{inner}</div>;
};

/** Full-width editorial "featured" card — the marquee merchant treatment (large layout). */
const FeaturedMerchant: React.FC<{ m: MerchantCard; onNav: (p: string) => void }> = ({ m, onNav }) => {
  const inner = (
    <div className="hn-lift hn-media-card" style={{ ...cardStyle, padding: 0, overflow: 'hidden', display: 'grid', gridTemplateColumns: 'minmax(0, 1.1fr) minmax(0, 1fr)', minHeight: 232 }}>
      <div className="hn-featured-media"><CardCover m={m} height={232} /></div>
      <div style={{ padding: 'clamp(20px,3vw,32px)', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, alignSelf: 'flex-start', padding: '5px 12px', borderRadius: 999, fontSize: 11.5, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', background: `color-mix(in srgb, ${T.primary} 16%, transparent)`, color: T.primary, marginBottom: 14 }}><Star size={12} fill={T.primary} color={T.primary} />Featured</span>
        <h3 style={{ fontSize: 'clamp(22px,3vw,30px)', fontWeight: 900, color: T.on, margin: 0, letterSpacing: '-0.02em' }}>{m.name}</h3>
        {m.cuisine && <p style={{ color: T.onVar, fontSize: 15.5, margin: '8px 0 0' }}>{m.cuisine}</p>}
        <MetaRow m={m} />
        {m.href && <span className="hn-arrow" aria-hidden="true" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginTop: 20, fontWeight: 800, color: T.primary }}>View menu →</span>}
      </div>
    </div>
  );
  return m.href
    ? <a href={m.href} aria-label={m.name} onClick={e => { if (m.href!.startsWith('/')) { e.preventDefault(); onNav(m.href!); } }} style={{ textDecoration: 'none' }}>{inner}</a>
    : <div>{inner}</div>;
};

const DealTile: React.FC<{ d: DealCard; onNav: (p: string) => void }> = ({ d, onNav }) => {
  const inner = (
    <div className="hn-lift" style={{ ...cardStyle, padding: 0, overflow: 'hidden', scrollSnapAlign: 'start', height: '100%' }}>
      <div style={{ position: 'relative', height: 140, background: d.image ? undefined : gradientFor(d.merchant || d.title), display: 'grid', placeItems: 'center', overflow: 'hidden' }}>
        {d.image && <img className="hn-zoom" src={d.image} alt={d.title} loading="lazy" decoding="async" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />}
        {!d.image && <WIcon name="gift" size={44} color="#ffffff" strokeWidth={1.5} style={{ filter: 'drop-shadow(0 6px 14px rgba(0,0,0,.4))' }} />}
        <span aria-hidden="true" style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, transparent 40%, rgba(0,0,0,.35))' }} />
        {d.discount && <span style={badge('promo')}>{d.discount}</span>}
        {typeof d.endsInMin === 'number' && d.endsInMin > 0 && <Countdown minutes={d.endsInMin} />}
      </div>
      <div style={{ padding: 16 }}>
        <h3 style={{ fontSize: 16, fontWeight: 800, color: T.on, margin: 0, letterSpacing: '-0.01em' }}>{d.title}</h3>
        {d.merchant && <p style={{ color: T.onVar, fontSize: 13.5, margin: '4px 0 0' }}>{d.merchant}</p>}
        {d.code && <p style={{ marginTop: 12 }}><span style={{ ...badge('code'), position: 'static', display: 'inline-flex' }}>Code {d.code}</span></p>}
      </div>
    </div>
  );
  return d.href
    ? <a href={d.href} onClick={e => { if (d.href!.startsWith('/')) { e.preventDefault(); onNav(d.href!); } }} style={{ textDecoration: 'none' }}>{inner}</a>
    : <div>{inner}</div>;
};

const ContactRow: React.FC<{ label: string; node: React.ReactNode }> = ({ label, node }) => (
  <div style={{ display: 'flex', gap: 14, alignItems: 'center', padding: '12px 0', borderBottom: `1px solid color-mix(in srgb, ${T.line} 50%, transparent)` }}>
    <span style={{ color: T.onVar, fontSize: 12, width: 76, textTransform: 'uppercase', letterSpacing: 0.6, fontWeight: 700 }}>{label}</span>{node}
  </div>
);

/** Live flash-deal countdown (mm:ss / hh:mm). Respects unmount cleanup. */
const Countdown: React.FC<{ minutes: number }> = ({ minutes }) => {
  const [left, setLeft] = React.useState(minutes * 60);
  React.useEffect(() => { const id = setInterval(() => setLeft(s => (s > 0 ? s - 1 : 0)), 1000); return () => clearInterval(id); }, []);
  const h = Math.floor(left / 3600), m = Math.floor((left % 3600) / 60), s = left % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  const label = h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
  return <span style={{ position: 'absolute', bottom: 10, insetInlineStart: 10, display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 999, fontSize: 11.5, fontWeight: 800, background: 'rgba(0,0,0,.62)', backdropFilter: 'blur(6px)', color: '#fff' }} aria-label={`Ends in ${label}`}><Clock size={12} />{label}</span>;
};

/** Deterministic premium gradient from a string (no external images needed). */
function gradientFor(seed: string): string {
  let h = 0; for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) % 360;
  return `linear-gradient(135deg, hsl(${h} 64% 44%), hsl(${(h + 42) % 360} 68% 30%))`;
}

function badge(kind: 'promo' | 'info' | 'code'): React.CSSProperties {
  const base: React.CSSProperties = { position: 'absolute', top: 12, insetInlineStart: 12, padding: '5px 11px', borderRadius: 999, fontSize: 11.5, fontWeight: 800, letterSpacing: 0.2 };
  if (kind === 'info') return { ...base, insetInlineStart: 'auto', insetInlineEnd: 12, background: 'rgba(0,0,0,.6)', backdropFilter: 'blur(6px)', color: '#fff', border: '1px solid rgba(255,255,255,0.18)' };
  if (kind === 'code') return { ...base, position: 'static', background: T.surfHigh, color: T.on, border: `1px dashed color-mix(in srgb, ${T.primary} 50%, ${T.line})` };
  return { ...base, background: T.primary, color: T.onPrimary, boxShadow: `0 6px 16px -6px color-mix(in srgb, ${T.primary} 80%, transparent)` };
}

/** Injected once by the public site shell — motion + micro-interactions (reduced-motion safe). */
export const BlockStyles: React.FC = () => (
  <style>{`
    .hn-lift { transition: transform .22s cubic-bezier(.22,1,.36,1), box-shadow .22s ease, border-color .22s ease; will-change: transform; }
    .hn-lift:hover { transform: translateY(-5px); box-shadow: 0 22px 50px -20px rgba(0,0,0,.55); border-color: color-mix(in srgb, var(--color-primary-fixed,#a3f95b) 40%, var(--color-outline-variant,#2a3330)); }
    .hn-media-card .hn-cover, .hn-media-card > div:first-child { overflow: hidden; }
    .hn-zoom { transition: transform .5s cubic-bezier(.22,1,.36,1); will-change: transform; }
    .hn-media-card:hover .hn-zoom, a:hover > .hn-media-card .hn-zoom { transform: scale(1.07); }
    .hn-chip, .hn-cat-icon { transition: transform .18s ease, background .18s ease, border-color .18s ease; }
    .hn-chip:hover { transform: translateY(-2px); border-color: color-mix(in srgb, var(--color-primary-fixed,#a3f95b) 45%, transparent); }
    .hn-cat:hover .hn-cat-icon { transform: translateY(-3px) scale(1.05); }
    .hn-arrow span, .hn-arrow { transition: gap .18s ease; }
    a:hover > * .hn-arrow, .hn-arrow:hover { gap: 12px; }
    .hn-btn { transition: transform .12s ease, box-shadow .2s ease, filter .18s ease; }
    .hn-btn:hover { transform: translateY(-2px); }
    .hn-btn-primary:hover { filter: brightness(1.04); box-shadow: 0 12px 32px -10px color-mix(in srgb, var(--color-primary-fixed,#a3f95b) 75%, transparent); }
    .hn-btn:active { transform: translateY(0) scale(.98); }
    .hn-field:focus-within { border-color: color-mix(in srgb, var(--color-primary-fixed,#a3f95b) 55%, transparent) !important; box-shadow: 0 0 0 4px color-mix(in srgb, var(--color-primary-fixed,#a3f95b) 14%, transparent); }
    .hn-rail { scrollbar-width: thin; scroll-padding: 0 24px; }
    .hn-rail::-webkit-scrollbar { height: 8px; }
    .hn-rail::-webkit-scrollbar-thumb { background: var(--color-outline-variant, #2a3330); border-radius: 999px; }
    .hn-rail::-webkit-scrollbar-track { background: transparent; }
    .hn-faq summary::-webkit-details-marker { display: none; }
    .hn-faq[open] .hn-faq-plus { transform: rotate(45deg); }
    .hn-orb { position: absolute; border-radius: 999px; filter: blur(60px); pointer-events: none; z-index: 0; }
    .hn-orb-a { width: 460px; height: 460px; top: -160px; left: -120px; background: radial-gradient(circle, color-mix(in srgb, var(--color-primary-fixed,#a3f95b) 42%, transparent), transparent 68%); animation: hn-drift-a 22s ease-in-out infinite alternate; }
    .hn-orb-b { width: 420px; height: 420px; top: -120px; right: -140px; background: radial-gradient(circle, color-mix(in srgb, var(--color-tertiary-fixed,#6ee7ff) 30%, transparent), transparent 68%); animation: hn-drift-b 26s ease-in-out infinite alternate; }
    .hn-grid-fade { position: absolute; inset: 0; z-index: 0; background-image: linear-gradient(color-mix(in srgb, var(--color-outline-variant,#2a3330) 40%, transparent) 1px, transparent 1px), linear-gradient(90deg, color-mix(in srgb, var(--color-outline-variant,#2a3330) 40%, transparent) 1px, transparent 1px); background-size: 56px 56px; mask-image: radial-gradient(90% 70% at 50% 0%, #000, transparent 70%); -webkit-mask-image: radial-gradient(90% 70% at 50% 0%, #000, transparent 70%); opacity: .5; }
    @keyframes hn-drift-a { to { transform: translate(60px, 40px) scale(1.12); } }
    @keyframes hn-drift-b { to { transform: translate(-50px, 50px) scale(1.08); } }
    .hn-fade { animation: hn-fade-in .6s cubic-bezier(.22,1,.36,1) both; }
    .hn-fade-1 { animation: hn-fade-in .6s cubic-bezier(.22,1,.36,1) both; animation-delay: .05s; }
    .hn-fade-2 { animation: hn-fade-in .6s cubic-bezier(.22,1,.36,1) both; animation-delay: .14s; }
    .hn-fade-3 { animation: hn-fade-in .6s cubic-bezier(.22,1,.36,1) both; animation-delay: .24s; }
    @keyframes hn-fade-in { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: none; } }
    @media (max-width: 640px) { .hn-featured-media { display: none; } }
    @media (prefers-reduced-motion: reduce) {
      .hn-lift, .hn-chip, .hn-zoom, .hn-btn, .hn-cat-icon, .hn-arrow, .hn-fade, .hn-fade-1, .hn-fade-2, .hn-fade-3, .hn-orb { transition: none !important; animation: none !important; }
    }
  `}</style>
);

const hStyle: React.CSSProperties = { fontSize: 'clamp(24px, 4vw, 34px)', fontWeight: 900, letterSpacing: '-0.025em', color: T.on, margin: 0, lineHeight: 1.1 };
const cardStyle: React.CSSProperties = { background: T.surf, border: hairline, borderRadius: T.cardR, padding: 22, boxShadow: softShadow };
const storeBtn: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 8, padding: '12px 22px', borderRadius: 14, background: T.on, color: 'var(--color-background, #111417)', fontWeight: 800, textDecoration: 'none', fontSize: 14 };
