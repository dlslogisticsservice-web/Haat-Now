import React from 'react';
import type { WebsiteBlock } from '../../services/website.service';

// All blocks render from DESIGN TOKENS (var(--…)) so a theme/brand change re-skins the whole site — no rebuild.
const sectionWrap: React.CSSProperties = { maxWidth: 1120, margin: '0 auto', padding: '0 20px' };

export const BlockRenderer: React.FC<{ block: WebsiteBlock; onNav: (path: string) => void }> = ({ block, onNav }) => {
  const link = (href: string, label: string, primary = true) => (
    <a href={href} onClick={e => { if (href.startsWith('/')) { e.preventDefault(); onNav(href); } }}
      style={{
        display: 'inline-block', padding: '12px 22px', borderRadius: 'var(--button-radius, 12px)', fontWeight: 700, cursor: 'pointer',
        background: primary ? 'var(--color-primary-fixed, #a3f95b)' : 'transparent',
        color: primary ? 'var(--color-on-primary-fixed, #0c2000)' : 'var(--color-on-surface, #e8ebe3)',
        border: primary ? 'none' : '1px solid var(--color-outline-variant, #2a3330)', textDecoration: 'none',
      }}>{label}</a>
  );

  switch (block.type) {
    case 'hero':
      return (
        <section style={{ padding: '72px 0 56px', textAlign: 'center' }}>
          <div style={sectionWrap}>
            <h1 style={{ fontSize: 'clamp(32px, 6vw, 56px)', fontWeight: 800, lineHeight: 1.05, color: 'var(--color-on-surface, #e8ebe3)', margin: 0 }}>{block.title}</h1>
            {block.subtitle && <p style={{ fontSize: 'clamp(16px, 2.5vw, 20px)', color: 'var(--color-on-surface-variant, #a7b0a6)', maxWidth: 680, margin: '18px auto 0' }}>{block.subtitle}</p>}
            {block.cta && <div style={{ marginTop: 28 }}>{link(block.cta.href, block.cta.label)}</div>}
          </div>
        </section>
      );
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
    default:
      return null;
  }
};

const hStyle: React.CSSProperties = { fontSize: 'clamp(22px, 4vw, 30px)', fontWeight: 800, color: 'var(--color-on-surface, #e8ebe3)', margin: 0 };
const cardStyle: React.CSSProperties = { background: 'var(--color-surface-container, #10160f)', border: '1px solid var(--color-outline-variant, #2a3330)', borderRadius: 'var(--card-radius, 16px)', padding: 20 };
const rowStyle: React.CSSProperties = { display: 'flex', gap: 12, margin: 0, alignItems: 'center' };
const lblStyle: React.CSSProperties = { color: 'var(--color-on-surface-variant, #a7b0a6)', fontSize: 12, width: 72, textTransform: 'uppercase', letterSpacing: 0.5 };
