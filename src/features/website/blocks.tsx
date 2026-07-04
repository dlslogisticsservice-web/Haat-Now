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
      const overlay = block.overlay ?? (bg || vid ? 0.5 : 0);
      const left = block.layout === 'left';
      const onMedia = !!(bg || vid);
      const ctas: WebsiteCta[] = block.ctas && block.ctas.length ? block.ctas : (block.cta ? [{ label: block.cta.label, href: block.cta.href, style: 'primary' }] : []);
      const txt = onMedia ? '#ffffff' : 'var(--color-on-surface, #e8ebe3)';
      const sub = onMedia ? 'rgba(255,255,255,0.86)' : 'var(--color-on-surface-variant, #a7b0a6)';
      return (
        <section style={{ position: 'relative', padding: '96px 0 80px', textAlign: left ? 'start' : 'center', overflow: 'hidden' }}>
          {vid && <video src={vid} autoPlay muted loop playsInline style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />}
          {!vid && bg && <div style={{ position: 'absolute', inset: 0, background: `url(${bg}) center/cover no-repeat` }} />}
          {onMedia && <div style={{ position: 'absolute', inset: 0, background: `rgba(0,0,0,${overlay})` }} />}
          <div style={{ ...sectionWrap, position: 'relative', maxWidth: left ? 1120 : 820 }}>
            <h1 style={{ fontSize: 'clamp(32px, 6vw, 56px)', fontWeight: 800, lineHeight: 1.05, color: txt, margin: 0 }}>{block.title}</h1>
            {block.subtitle && <p style={{ fontSize: 'clamp(16px, 2.5vw, 20px)', color: sub, maxWidth: 680, margin: left ? '18px 0 0' : '18px auto 0' }}>{block.subtitle}</p>}
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
                <div key={i} style={cardStyle}>
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
    default:
      return null;
  }
};

const hStyle: React.CSSProperties = { fontSize: 'clamp(22px, 4vw, 30px)', fontWeight: 800, color: 'var(--color-on-surface, #e8ebe3)', margin: 0 };
const cardStyle: React.CSSProperties = { background: 'var(--color-surface-container, #10160f)', border: '1px solid var(--color-outline-variant, #2a3330)', borderRadius: 'var(--card-radius, 16px)', padding: 20 };
const rowStyle: React.CSSProperties = { display: 'flex', gap: 12, margin: 0, alignItems: 'center' };
const lblStyle: React.CSSProperties = { color: 'var(--color-on-surface-variant, #a7b0a6)', fontSize: 12, width: 72, textTransform: 'uppercase', letterSpacing: 0.5 };
const storeBtn: React.CSSProperties = { padding: '10px 18px', borderRadius: 12, background: 'var(--color-on-surface, #e8ebe3)', color: 'var(--color-background, #111417)', fontWeight: 700, textDecoration: 'none', fontSize: 14 };
