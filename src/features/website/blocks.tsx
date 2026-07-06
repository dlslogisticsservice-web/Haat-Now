import React from 'react';
import type { WebsiteBlock, WebsiteCta } from '../../services/website.service';

// All blocks render from DESIGN TOKENS (var(--…)) so a theme/brand change re-skins the whole site — no rebuild.
const sectionWrap: React.CSSProperties = { maxWidth: 1120, margin: '0 auto', padding: '0 20px' };

const Link: React.FC<{ href: string; label: string; primary?: boolean; onNav: (p: string) => void }> = ({ href, label, primary = true, onNav }) => (
  <a href={href} onClick={e => { if (href.startsWith('/')) { e.preventDefault(); onNav(href); } }}
    style={{
      display: 'inline-block', padding: '12px 22px', borderRadius: 'var(--button-radius, 12px)', fontWeight: 700, cursor: 'pointer',
      background: primary ? 'var(--color-primary-fixed, #a3f95b)' : 'transparent',
      color: primary ? 'var(--color-on-primary-fixed, #0c2000)' : 'var(--color-on-surface, #e8ebe3)',
      border: primary ? 'none' : '1px solid var(--color-outline-variant, #2a3330)', textDecoration: 'none',
    }}>{label}</a>
);

export const BlockRenderer: React.FC<{ block: WebsiteBlock; onNav: (path: string) => void }> = ({ block, onNav }) => {
  const link = (href: string, label: string, primary = true) => <Link href={href} label={label} primary={primary} onNav={onNav} />;

  switch (block.type) {
    case 'hero': {
      const bg = block.bgImage, vid = block.bgVideo;
      const onMedia = !!(bg || vid);
      const overlay = block.overlay ?? (onMedia ? 0.5 : 0);
      const left = block.layout === 'left';
      const ctas: WebsiteCta[] = block.ctas && block.ctas.length ? block.ctas : (block.cta ? [{ label: block.cta.label, href: block.cta.href, style: 'primary' }] : []);
      const txt = onMedia ? '#ffffff' : 'var(--color-on-surface, #e8ebe3)';
      const sub = onMedia ? 'rgba(255,255,255,0.88)' : 'var(--color-on-surface-variant, #a7b0a6)';
      // Themed gradient wash when no media is supplied — a premium, self-contained hero.
      const wash = 'radial-gradient(1200px 480px at 20% -10%, color-mix(in srgb, var(--color-primary-fixed, #a3f95b) 26%, transparent), transparent 60%), radial-gradient(900px 420px at 100% 0%, color-mix(in srgb, var(--color-tertiary-fixed, #6ee7ff) 20%, transparent), transparent 55%)';
      return (
        <section className="hn-hero" style={{ position: 'relative', padding: 'clamp(56px, 9vw, 104px) 0 clamp(44px, 7vw, 80px)', textAlign: left ? 'start' : 'center', overflow: 'hidden' }}>
          {vid && <video src={vid} autoPlay muted loop playsInline aria-hidden="true" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />}
          {!vid && bg && <div aria-hidden="true" style={{ position: 'absolute', inset: 0, background: `url(${bg}) center/cover no-repeat` }} />}
          {onMedia && <div aria-hidden="true" style={{ position: 'absolute', inset: 0, background: `rgba(0,0,0,${overlay})` }} />}
          {!onMedia && <div aria-hidden="true" style={{ position: 'absolute', inset: 0, background: wash }} />}
          <div className="hn-fade" style={{ ...sectionWrap, position: 'relative', maxWidth: left ? 1120 : 860 }}>
            <h1 style={{ fontSize: 'clamp(32px, 6vw, 56px)', fontWeight: 900, lineHeight: 1.04, letterSpacing: '-0.02em', color: txt, margin: 0 }}>{block.title}</h1>
            {block.subtitle && <p style={{ fontSize: 'clamp(16px, 2.5vw, 21px)', color: sub, maxWidth: 700, margin: left ? '18px 0 0' : '18px auto 0' }}>{block.subtitle}</p>}
            {block.search && <HeroSearch placeholder={block.searchPlaceholder} action={block.searchAction} center={!left} onNav={onNav} />}
            {block.chips && block.chips.length > 0 && (
              <div style={{ marginTop: 18, display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: left ? 'flex-start' : 'center' }}>
                {block.chips.map(c => (
                  <a key={c.path} href={c.path} onClick={e => { if (c.path.startsWith('/')) { e.preventDefault(); onNav(c.path); } }}
                    className="hn-chip" style={{ padding: '8px 14px', borderRadius: 999, fontSize: 13, fontWeight: 700, textDecoration: 'none', color: onMedia ? '#fff' : 'var(--color-on-surface, #e8ebe3)', background: onMedia ? 'rgba(255,255,255,0.16)' : 'var(--color-surface-container-high, #141a17)', border: '1px solid var(--color-outline-variant, #2a3330)' }}>{c.label}</a>
                ))}
              </div>
            )}
            {ctas.length > 0 && <div style={{ marginTop: 28, display: 'flex', gap: 12, justifyContent: left ? 'flex-start' : 'center', flexWrap: 'wrap' }}>{ctas.map((c, i) => <React.Fragment key={i}>{link(c.href, c.label, c.style !== 'secondary')}</React.Fragment>)}</div>}
          </div>
        </section>
      );
    }
    case 'features':
      return (
        <section style={{ padding: '40px 0' }}>
          <div style={sectionWrap}>
            {block.heading && <h2 style={hStyle}>{block.heading}</h2>}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginTop: 20 }}>
              {block.items.map((it, i) => (
                <div key={i} className="hn-lift" style={cardStyle}>
                  {it.icon && <div aria-hidden="true" style={{ fontSize: 26, marginBottom: 10 }}>{it.icon}</div>}
                  <h3 style={{ fontSize: 18, fontWeight: 700, color: 'var(--color-on-surface, #e8ebe3)', margin: 0 }}>{it.title}</h3>
                  <p style={{ color: 'var(--color-on-surface-variant, #a7b0a6)', marginTop: 8, fontSize: 14 }}>{it.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      );
    case 'cards':
      return (
        <section style={{ padding: '40px 0' }}>
          <div style={sectionWrap}>
            {block.heading && <h2 style={hStyle}>{block.heading}</h2>}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16, marginTop: 20 }}>
              {block.items.map((it, i) => {
                const inner = (
                  <div style={{ ...cardStyle, padding: 0, overflow: 'hidden', height: '100%' }}>
                    {it.image && <img src={it.image} alt="" style={{ width: '100%', aspectRatio: '16/9', objectFit: 'cover', display: 'block' }} />}
                    <div style={{ padding: 18 }}>
                      <h3 style={{ fontSize: 17, fontWeight: 700, color: 'var(--color-on-surface, #e8ebe3)', margin: 0 }}>{it.title}</h3>
                      <p style={{ color: 'var(--color-on-surface-variant, #a7b0a6)', marginTop: 6, fontSize: 14 }}>{it.body}</p>
                    </div>
                  </div>
                );
                return it.href ? <a key={i} href={it.href} onClick={e => { if (it.href!.startsWith('/')) { e.preventDefault(); onNav(it.href!); } }} style={{ textDecoration: 'none' }}>{inner}</a> : <div key={i}>{inner}</div>;
              })}
            </div>
          </div>
        </section>
      );
    case 'stats':
      return (
        <section style={{ padding: '48px 0' }}>
          <div style={sectionWrap}>
            {block.heading && <h2 style={{ ...hStyle, textAlign: 'center' }}>{block.heading}</h2>}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 16, marginTop: 20 }}>
              {block.items.map((it, i) => (
                <div key={i} style={{ ...cardStyle, textAlign: 'center' }}>
                  <p style={{ fontSize: 'clamp(28px,4vw,40px)', fontWeight: 800, color: 'var(--color-primary-fixed, #a3f95b)', margin: 0 }}>{it.value}</p>
                  <p style={{ color: 'var(--color-on-surface-variant, #a7b0a6)', marginTop: 4, fontSize: 13 }}>{it.label}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      );
    case 'testimonials':
      return (
        <section style={{ padding: '40px 0' }}>
          <div style={sectionWrap}>
            {block.heading && <h2 style={hStyle}>{block.heading}</h2>}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16, marginTop: 20 }}>
              {block.items.map((t, i) => (
                <div key={i} style={cardStyle}>
                  <p style={{ color: 'var(--color-on-surface, #e8ebe3)', fontSize: 15, lineHeight: 1.6, margin: 0 }}>“{t.quote}”</p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 14 }}>
                    {t.avatar && <img src={t.avatar} alt="" style={{ width: 36, height: 36, borderRadius: 999, objectFit: 'cover' }} />}
                    <div><p style={{ fontWeight: 700, fontSize: 13, color: 'var(--color-on-surface, #e8ebe3)', margin: 0 }}>{t.author}</p>{t.role && <p style={{ fontSize: 11, color: 'var(--color-on-surface-variant, #a7b0a6)', margin: 0 }}>{t.role}</p>}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      );
    case 'partners':
      return (
        <section style={{ padding: '36px 0' }}>
          <div style={sectionWrap}>
            {block.heading && <h2 style={{ ...hStyle, fontSize: 20, textAlign: 'center' }}>{block.heading}</h2>}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 28, alignItems: 'center', justifyContent: 'center', marginTop: 18, opacity: 0.85 }}>
              {block.logos.map((src, i) => <img key={i} src={src} alt="" style={{ height: 34, objectFit: 'contain' }} />)}
            </div>
          </div>
        </section>
      );
    case 'app_download':
      return (
        <section style={{ padding: '48px 0' }}>
          <div style={{ ...sectionWrap }}>
            <div style={{ ...cardStyle, background: 'var(--color-surface-container-high, #141a17)', display: 'flex', flexWrap: 'wrap', gap: 24, alignItems: 'center', justifyContent: 'space-between', padding: 32 }}>
              <div style={{ flex: 1, minWidth: 240 }}>
                <h2 style={{ ...hStyle, marginTop: 0 }}>{block.heading}</h2>
                {block.subtitle && <p style={{ color: 'var(--color-on-surface-variant, #a7b0a6)', marginTop: 8 }}>{block.subtitle}</p>}
                <div style={{ display: 'flex', gap: 12, marginTop: 18, flexWrap: 'wrap' }}>
                  {block.iosUrl && <a href={block.iosUrl} target="_blank" rel="noreferrer" style={storeBtn}> App Store</a>}
                  {block.androidUrl && <a href={block.androidUrl} target="_blank" rel="noreferrer" style={storeBtn}>▶ Google Play</a>}
                </div>
              </div>
              {block.image && <img src={block.image} alt="" style={{ maxHeight: 220, borderRadius: 16 }} />}
            </div>
          </div>
        </section>
      );
    case 'cta':
      return (
        <section style={{ padding: '48px 0' }}>
          <div style={{ ...sectionWrap }}>
            <div style={{ ...cardStyle, textAlign: 'center', padding: 40, background: 'var(--color-surface-container-high, #141a17)' }}>
              <h2 style={{ ...hStyle, marginTop: 0 }}>{block.title}</h2>
              {block.subtitle && <p style={{ color: 'var(--color-on-surface-variant, #a7b0a6)', marginTop: 8 }}>{block.subtitle}</p>}
              <div style={{ marginTop: 20 }}>{link(block.button.href, block.button.label)}</div>
            </div>
          </div>
        </section>
      );
    case 'richtext':
      return (
        <section style={{ padding: '40px 0' }}>
          <div style={{ ...sectionWrap, maxWidth: 760 }}>
            {block.heading && <h2 style={hStyle}>{block.heading}</h2>}
            <p style={{ color: 'var(--color-on-surface-variant, #c4ccbf)', fontSize: 16, lineHeight: 1.7, marginTop: 12, whiteSpace: 'pre-wrap' }}>{block.body}</p>
          </div>
        </section>
      );
    case 'gallery':
      return (
        <section style={{ padding: '40px 0' }}>
          <div style={sectionWrap}>
            {block.heading && <h2 style={hStyle}>{block.heading}</h2>}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12, marginTop: 16 }}>
              {block.images.map((src, i) => <img key={i} src={src} alt="" style={{ width: '100%', borderRadius: 'var(--card-radius, 16px)', objectFit: 'cover', aspectRatio: '4/3' }} />)}
            </div>
          </div>
        </section>
      );
    case 'faq':
      return (
        <section style={{ padding: '40px 0' }}>
          <div style={{ ...sectionWrap, maxWidth: 820 }}>
            {block.heading && <h2 style={hStyle}>{block.heading}</h2>}
            <div style={{ marginTop: 16, display: 'grid', gap: 12 }}>
              {block.items.map((f, i) => (
                <div key={i} style={cardStyle}>
                  <p style={{ fontWeight: 700, color: 'var(--color-on-surface, #e8ebe3)', margin: 0 }}>{f.q}</p>
                  <p style={{ color: 'var(--color-on-surface-variant, #a7b0a6)', marginTop: 6, fontSize: 14 }}>{f.a}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      );
    case 'contact':
      return (
        <section style={{ padding: '40px 0' }}>
          <div style={{ ...sectionWrap, maxWidth: 620 }}>
            {block.heading && <h2 style={hStyle}>{block.heading}</h2>}
            <div style={{ ...cardStyle, marginTop: 16, display: 'grid', gap: 10 }}>
              {block.email && <p style={rowStyle}><span style={lblStyle}>Email</span><a href={`mailto:${block.email}`} style={{ color: 'var(--color-primary-fixed, #a3f95b)' }}>{block.email}</a></p>}
              {block.phone && <p style={rowStyle}><span style={lblStyle}>Phone</span><span style={{ color: 'var(--color-on-surface, #e8ebe3)' }}>{block.phone}</span></p>}
              {block.address && <p style={rowStyle}><span style={lblStyle}>Address</span><span style={{ color: 'var(--color-on-surface, #e8ebe3)' }}>{block.address}</span></p>}
            </div>
          </div>
        </section>
      );
    case 'categories':
      return (
        <section style={{ padding: '36px 0' }}>
          <div style={sectionWrap}>
            {block.heading && <SectionHead heading={block.heading} subtitle={block.subtitle} />}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(116px, 1fr))', gap: 12, marginTop: 18 }}>
              {block.items.map((c, i) => (
                <a key={i} href={c.href} onClick={e => { if (c.href.startsWith('/')) { e.preventDefault(); onNav(c.href); } }}
                  className="hn-lift" aria-label={c.label}
                  style={{ ...cardStyle, padding: '18px 12px', textAlign: 'center', textDecoration: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                  <span aria-hidden="true" style={{ width: 52, height: 52, borderRadius: 16, display: 'grid', placeItems: 'center', fontSize: 26, background: c.tint || 'var(--color-surface-container-high, #141a17)' }}>{c.emoji || '🍽️'}</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-on-surface, #e8ebe3)' }}>{c.label}</span>
                </a>
              ))}
            </div>
          </div>
        </section>
      );
    case 'deals':
      return (
        <section style={{ padding: '32px 0' }}>
          <div style={sectionWrap}>
            {block.heading && <SectionHead heading={block.heading} subtitle={block.subtitle} />}
            <div className="hn-rail" style={{ display: 'grid', gridAutoFlow: 'column', gridAutoColumns: 'minmax(240px, 1fr)', gap: 14, marginTop: 18, overflowX: 'auto', paddingBottom: 6, scrollSnapType: 'x mandatory' }}>
              {block.items.map((d, i) => {
                const cover = (
                  <div style={{ position: 'relative', height: 132, background: gradientFor(d.merchant || d.title), display: 'grid', placeItems: 'center' }}>
                    <span aria-hidden="true" style={{ fontSize: 44, filter: 'drop-shadow(0 4px 10px rgba(0,0,0,.35))' }}>{d.emoji || '🎁'}</span>
                    {d.discount && <span style={badge('promo')}>{d.discount}</span>}
                    {typeof d.endsInMin === 'number' && d.endsInMin > 0 && <Countdown minutes={d.endsInMin} />}
                  </div>
                );
                const body = (
                  <div style={{ padding: 14 }}>
                    <h3 style={{ fontSize: 15, fontWeight: 800, color: 'var(--color-on-surface, #e8ebe3)', margin: 0 }}>{d.title}</h3>
                    {d.merchant && <p style={{ color: 'var(--color-on-surface-variant, #a7b0a6)', fontSize: 13, margin: '4px 0 0' }}>{d.merchant}</p>}
                    {d.code && <p style={{ marginTop: 8 }}><span style={{ ...badge('code'), position: 'static' }}>Code {d.code}</span></p>}
                  </div>
                );
                const inner = <div className="hn-lift" style={{ ...cardStyle, padding: 0, overflow: 'hidden', scrollSnapAlign: 'start' }}>{cover}{body}</div>;
                return d.href
                  ? <a key={i} href={d.href} onClick={e => { if (d.href!.startsWith('/')) { e.preventDefault(); onNav(d.href!); } }} style={{ textDecoration: 'none' }}>{inner}</a>
                  : <div key={i}>{inner}</div>;
              })}
            </div>
          </div>
        </section>
      );
    case 'merchants': {
      const rail = block.layout === 'rail';
      const gridStyle: React.CSSProperties = rail
        ? { display: 'grid', gridAutoFlow: 'column', gridAutoColumns: 'minmax(230px, 1fr)', gap: 14, overflowX: 'auto', paddingBottom: 6, scrollSnapType: 'x mandatory' }
        : { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: 14 };
      return (
        <section style={{ padding: '28px 0' }}>
          <div style={sectionWrap}>
            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 }}>
              {block.heading && <SectionHead heading={block.heading} subtitle={block.subtitle} />}
              {block.viewAll && <a href={block.viewAll.href} onClick={e => { if (block.viewAll!.href.startsWith('/')) { e.preventDefault(); onNav(block.viewAll!.href); } }} style={{ color: 'var(--color-primary-fixed, #a3f95b)', fontSize: 13, fontWeight: 700, textDecoration: 'none', whiteSpace: 'nowrap' }}>{block.viewAll.label} →</a>}
            </div>
            <div className={rail ? 'hn-rail' : undefined} style={{ ...gridStyle, marginTop: 18 }}>
              {block.items.map((m, i) => <MerchantTile key={i} m={m} snap={rail} onNav={onNav} />)}
            </div>
          </div>
        </section>
      );
    }
    case 'steps':
      return (
        <section style={{ padding: '44px 0' }}>
          <div style={sectionWrap}>
            {block.heading && <SectionHead heading={block.heading} subtitle={block.subtitle} center />}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginTop: 22 }}>
              {block.items.map((s, i) => (
                <div key={i} className="hn-lift" style={{ ...cardStyle, textAlign: 'center' }}>
                  <div aria-hidden="true" style={{ width: 46, height: 46, borderRadius: 999, margin: '0 auto', display: 'grid', placeItems: 'center', fontSize: 22, background: 'color-mix(in srgb, var(--color-primary-fixed, #a3f95b) 18%, transparent)', color: 'var(--color-primary-fixed, #a3f95b)', fontWeight: 800 }}>{s.icon || i + 1}</div>
                  <h3 style={{ fontSize: 16, fontWeight: 800, color: 'var(--color-on-surface, #e8ebe3)', marginTop: 12 }}>{s.title}</h3>
                  <p style={{ color: 'var(--color-on-surface-variant, #a7b0a6)', marginTop: 6, fontSize: 14 }}>{s.body}</p>
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

// ── Marketplace helpers ─────────────────────────────────────────────────────────
const SectionHead: React.FC<{ heading: string; subtitle?: string; center?: boolean }> = ({ heading, subtitle, center }) => (
  <div style={{ textAlign: center ? 'center' : 'start', margin: center ? '0 auto' : undefined, maxWidth: center ? 640 : undefined }}>
    <h2 style={hStyle}>{heading}</h2>
    {subtitle && <p style={{ color: 'var(--color-on-surface-variant, #a7b0a6)', marginTop: 6, fontSize: 15 }}>{subtitle}</p>}
  </div>
);

const HeroSearch: React.FC<{ placeholder?: string; action?: string; center?: boolean; onNav: (p: string) => void }> = ({ placeholder, action = '/restaurants', center, onNav }) => {
  const [q, setQ] = React.useState('');
  const submit = (e: React.FormEvent) => { e.preventDefault(); const to = q.trim() ? `${action}?q=${encodeURIComponent(q.trim())}` : action; onNav(to); };
  return (
    <form role="search" onSubmit={submit} style={{ marginTop: 26, display: 'flex', gap: 8, maxWidth: 560, marginInline: center ? 'auto' : undefined, background: 'var(--color-surface-container, #10160f)', border: '1px solid var(--color-outline-variant, #2a3330)', borderRadius: 'var(--button-radius, 14px)', padding: 6, boxShadow: '0 10px 30px rgba(0,0,0,.18)' }}>
      <span aria-hidden="true" style={{ display: 'grid', placeItems: 'center', paddingInlineStart: 10, fontSize: 16 }}>🔎</span>
      <input value={q} onChange={e => setQ(e.target.value)} aria-label="Search for restaurants, groceries and stores" placeholder={placeholder || 'Search restaurants, groceries, pharmacies…'}
        style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', color: 'var(--color-on-surface, #e8ebe3)', fontSize: 15, padding: '10px 4px' }} />
      <button type="submit" style={{ padding: '11px 20px', borderRadius: 'var(--button-radius, 12px)', border: 'none', cursor: 'pointer', fontWeight: 800, background: 'var(--color-primary-fixed, #a3f95b)', color: 'var(--color-on-primary-fixed, #0c2000)' }}>Search</button>
    </form>
  );
};

const MerchantTile: React.FC<{ m: import('../../services/website.service').MerchantCard; snap?: boolean; onNav: (p: string) => void }> = ({ m, snap, onNav }) => {
  const inner = (
    <div className="hn-lift" style={{ ...cardStyle, padding: 0, overflow: 'hidden', opacity: m.closed ? 0.72 : 1, scrollSnapAlign: snap ? 'start' : undefined }}>
      <div style={{ position: 'relative', height: 124, background: m.image ? `url(${m.image}) center/cover` : gradientFor(m.name), display: 'grid', placeItems: 'center' }}>
        {!m.image && <span aria-hidden="true" style={{ fontSize: 42, filter: 'drop-shadow(0 4px 10px rgba(0,0,0,.35))' }}>{m.emoji || '🍴'}</span>}
        {m.promo && <span style={badge('promo')}>{m.promo}</span>}
        {m.badge && <span style={badge('info')}>{m.badge}</span>}
        {m.closed && <span style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', background: 'rgba(0,0,0,.45)', color: '#fff', fontWeight: 800, fontSize: 13, letterSpacing: 0.5 }}>Closed</span>}
      </div>
      <div style={{ padding: 14 }}>
        <h3 style={{ fontSize: 15, fontWeight: 800, color: 'var(--color-on-surface, #e8ebe3)', margin: 0 }}>{m.name}</h3>
        {m.cuisine && <p style={{ color: 'var(--color-on-surface-variant, #a7b0a6)', fontSize: 13, margin: '3px 0 0' }}>{m.cuisine}</p>}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 10, fontSize: 12.5, color: 'var(--color-on-surface-variant, #a7b0a6)' }}>
          {typeof m.rating === 'number' && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, color: 'var(--color-on-surface, #e8ebe3)', fontWeight: 700 }}>★ {m.rating.toFixed(1)}{m.reviews ? <span style={{ fontWeight: 500, color: 'var(--color-on-surface-variant, #a7b0a6)' }}>({m.reviews}+)</span> : null}</span>}
          {m.eta && <span>· {m.eta}</span>}
          {m.fee && <span>· {m.fee}</span>}
          {m.distance && <span>· {m.distance}</span>}
        </div>
      </div>
    </div>
  );
  return m.href
    ? <a href={m.href} aria-label={m.name} onClick={e => { if (m.href!.startsWith('/')) { e.preventDefault(); onNav(m.href!); } }} style={{ textDecoration: 'none' }}>{inner}</a>
    : <div>{inner}</div>;
};

/** Live flash-deal countdown (mm:ss / hh:mm). Respects unmount cleanup. */
const Countdown: React.FC<{ minutes: number }> = ({ minutes }) => {
  const [left, setLeft] = React.useState(minutes * 60);
  React.useEffect(() => { const id = setInterval(() => setLeft(s => (s > 0 ? s - 1 : 0)), 1000); return () => clearInterval(id); }, []);
  const h = Math.floor(left / 3600), m = Math.floor((left % 3600) / 60), s = left % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  const label = h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
  return <span style={{ position: 'absolute', bottom: 8, insetInlineStart: 8, padding: '3px 8px', borderRadius: 8, fontSize: 11, fontWeight: 800, background: 'rgba(0,0,0,.6)', color: '#fff' }} aria-label={`Ends in ${label}`}>⏱ {label}</span>;
};

/** Deterministic premium gradient from a string (no external images needed). */
function gradientFor(seed: string): string {
  let h = 0; for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) % 360;
  return `linear-gradient(135deg, hsl(${h} 62% 42%), hsl(${(h + 40) % 360} 66% 30%))`;
}

function badge(kind: 'promo' | 'info' | 'code'): React.CSSProperties {
  const base: React.CSSProperties = { position: 'absolute', top: 8, insetInlineStart: 8, padding: '3px 9px', borderRadius: 999, fontSize: 11, fontWeight: 800 };
  if (kind === 'info') return { ...base, insetInlineStart: 'auto', insetInlineEnd: 8, background: 'rgba(0,0,0,.6)', color: '#fff' };
  if (kind === 'code') return { ...base, background: 'var(--color-surface-container-high, #141a17)', color: 'var(--color-on-surface, #e8ebe3)', border: '1px dashed var(--color-outline-variant, #2a3330)' };
  return { ...base, background: 'var(--color-primary-fixed, #a3f95b)', color: 'var(--color-on-primary-fixed, #0c2000)' };
}

/** Injected once by the public site shell — hover/lift/fade micro-interactions (reduced-motion safe). */
export const BlockStyles: React.FC = () => (
  <style>{`
    .hn-lift { transition: transform .18s ease, box-shadow .18s ease; }
    .hn-lift:hover { transform: translateY(-4px); box-shadow: 0 14px 40px rgba(0,0,0,.18); }
    .hn-chip { transition: transform .15s ease, background .15s ease; }
    .hn-chip:hover { transform: translateY(-1px); }
    .hn-rail { scrollbar-width: thin; }
    .hn-rail::-webkit-scrollbar { height: 8px; }
    .hn-rail::-webkit-scrollbar-thumb { background: var(--color-outline-variant, #2a3330); border-radius: 999px; }
    .hn-fade { animation: hn-fade-in .5s ease both; }
    @keyframes hn-fade-in { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
    @media (prefers-reduced-motion: reduce) { .hn-lift, .hn-chip, .hn-fade { transition: none !important; animation: none !important; } }
  `}</style>
);

const hStyle: React.CSSProperties = { fontSize: 'clamp(22px, 4vw, 30px)', fontWeight: 800, color: 'var(--color-on-surface, #e8ebe3)', margin: 0 };
const cardStyle: React.CSSProperties = { background: 'var(--color-surface-container, #10160f)', border: '1px solid var(--color-outline-variant, #2a3330)', borderRadius: 'var(--card-radius, 16px)', padding: 20 };
const rowStyle: React.CSSProperties = { display: 'flex', gap: 12, margin: 0, alignItems: 'center' };
const lblStyle: React.CSSProperties = { color: 'var(--color-on-surface-variant, #a7b0a6)', fontSize: 12, width: 72, textTransform: 'uppercase', letterSpacing: 0.5 };
const storeBtn: React.CSSProperties = { padding: '10px 18px', borderRadius: 12, background: 'var(--color-on-surface, #e8ebe3)', color: 'var(--color-background, #111417)', fontWeight: 700, textDecoration: 'none', fontSize: 14 };
