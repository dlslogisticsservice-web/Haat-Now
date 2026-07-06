import React, { useEffect, useMemo, useState } from 'react';
import {
  resolvePublicRequest, resolveSite, applyBrand, resolvePage, buildSeo, applySeo, trackPageview,
} from './runtime';
import { BlockRenderer, BlockStyles } from './blocks';
import { loadLiveCommerce, type LiveCommerce } from './commerce';
import type { WebsiteBlock } from '../../services/website.service';

/** Replace merchants/deals blocks with LIVE catalog data (reused services), rotating the
 *  live merchant list across sections so themed rails stay distinct. Curated content is kept
 *  whenever live data is empty (sandbox / no catalog) — the established graceful fallback. */
function hydrateSections(sections: WebsiteBlock[], live: LiveCommerce): WebsiteBlock[] {
  if (live.merchants.length === 0 && live.deals.length === 0) return sections;
  let merchantBlock = 0;
  return sections.map(b => {
    if (b.type === 'merchants' && live.merchants.length > 0) {
      const size = b.layout === 'rail' ? 10 : 12;
      const start = (merchantBlock++ * 4) % live.merchants.length;
      const items = Array.from({ length: Math.min(size, live.merchants.length) }, (_v, i) => live.merchants[(start + i) % live.merchants.length]);
      return { ...b, items };
    }
    if (b.type === 'deals' && live.deals.length > 0) return { ...b, items: live.deals };
    return b;
  });
}

// Per-section responsive visibility rules + a11y (skip link, focus ring) — injected once.
const RESP_CSS = `@media(min-width:1024px){.hd{display:none!important}}@media(min-width:641px) and (max-width:1023px){.ht{display:none!important}}@media(max-width:640px){.hm{display:none!important}}
.hn-skip{position:absolute;left:-9999px;top:0;z-index:100;padding:10px 16px;border-radius:0 0 12px 0;background:var(--color-primary-fixed,#a3f95b);color:var(--color-on-primary-fixed,#0c2000);font-weight:800;text-decoration:none}
.hn-skip:focus{left:0}
#public_site :focus-visible{outline:2px solid var(--color-primary-fixed,#a3f95b);outline-offset:2px;border-radius:6px}`;
const visClass = (v?: { desktop?: boolean; tablet?: boolean; mobile?: boolean }): string =>
  !v ? '' : [v.desktop === false ? 'hd' : '', v.tablet === false ? 'ht' : '', v.mobile === false ? 'hm' : ''].filter(Boolean).join(' ');

/**
 * Public Website Runtime — renders a tenant's published website inside the existing SPA.
 * Mounted (from main.tsx) only when the request targets a tenant site (?site=<slug> in sandbox/dev,
 * or a subdomain / custom domain in production). Reuses the theme engine, tenant spine, website.service
 * content, and the monitoring analytics seam. Publishing/brand changes update instantly (no rebuild).
 */
export const PublicSiteApp: React.FC = () => {
  const req = useMemo(() => resolvePublicRequest(window.location), []);
  const [path, setPath] = useState(req.path);
  const [tick, setTick] = useState(0);              // bump → re-read published content (instant publish)

  const { tenant, site } = useMemo(() => resolveSite(req), [req, tick]);

  // Brand runtime — apply the tenant's theme/brand via the ONE theme engine.
  useEffect(() => { applyBrand(tenant); }, [tenant, tick]);

  // Instant updates: publish event (same tab) + storage event (cross-tab). No rebuild, no redeploy.
  useEffect(() => {
    const onChange = () => setTick(t => t + 1);
    const onStorage = (e: StorageEvent) => { if (e.key === 'haat_sb_website_v1') onChange(); };
    window.addEventListener('haat:website', onChange as EventListener);
    window.addEventListener('storage', onStorage);
    return () => { window.removeEventListener('haat:website', onChange as EventListener); window.removeEventListener('storage', onStorage); };
  }, []);

  // Client-side navigation (reload-safe: keeps ?site= in sandbox).
  const navigate = (to: string) => {
    setPath(to);
    const url = req.slug ? `?site=${req.slug}&path=${encodeURIComponent(to)}${req.preview ? '&preview=1' : ''}` : to;
    try { window.history.pushState({}, '', url); window.scrollTo(0, 0); } catch { /* ignore */ }
  };
  useEffect(() => {
    const onPop = () => setPath(resolvePublicRequest(window.location).path);
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const resolved = site ? resolvePage(site, path) : { notFound: true as const };

  // Live commerce: hydrate discovery blocks from the reused catalog services. Scoped to the
  // flagship HaaT site (homeService.getFeed lists all branches, not tenant-scoped), and only
  // applied when the live catalog returns data — otherwise curated content stays.
  const [live, setLive] = useState<LiveCommerce | null>(null);
  const isFlagshipSite = !!site && (/haat/i.test(site.slug) || /haat\s*now/i.test(site.siteName));
  useEffect(() => {
    if (!isFlagshipSite || live) return;
    let active = true;
    loadLiveCommerce().then(r => { if (active && (r.merchants.length > 0 || r.deals.length > 0)) setLive(r); }).catch(() => { /* keep curated */ });
    return () => { active = false; };
  }, [isFlagshipSite, live]);

  // SEO + analytics runtime per page.
  useEffect(() => {
    if (!site) return;
    const seo = resolved.post ? resolved.post.seo : resolved.page?.seo;
    const title = resolved.post ? resolved.post.title : resolved.page?.title;
    applySeo(buildSeo(site, { seo, title, host: req.host, path, brand: tenant || {} }));
    trackPageview(site, path);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [site, path, tick]);

  const bg: React.CSSProperties = { minHeight: '100vh', background: 'var(--color-background, #0a0f0c)', color: 'var(--color-on-surface, #e8ebe3)', fontFamily: 'var(--font-family, Cairo, system-ui, sans-serif)' };

  if (!site) return (
    <div id="public_site_notfound" style={{ ...bg, display: 'grid', placeItems: 'center', textAlign: 'center', padding: 24 }}>
      <div>
        <h1 style={{ fontSize: 28, fontWeight: 800 }}>Site not found</h1>
        <p style={{ color: 'var(--color-on-surface-variant, #a7b0a6)', marginTop: 8 }}>No website is published for this address.</p>
      </div>
    </div>
  );

  // Tenant runtime — website status + maintenance mode.
  if (site.status !== 'published' || site.maintenance) return (
    <div id="public_site_maintenance" style={{ ...bg, display: 'grid', placeItems: 'center', textAlign: 'center', padding: 24 }}>
      <div>
        {tenant?.logo_url ? <img src={tenant.logo_url} alt="" style={{ height: 40, marginBottom: 16 }} /> : null}
        <h1 style={{ fontSize: 30, fontWeight: 800 }}>{site.siteName}</h1>
        <p style={{ color: 'var(--color-on-surface-variant, #a7b0a6)', marginTop: 10, maxWidth: 420 }}>
          {site.maintenance ? 'We are performing scheduled maintenance. We’ll be back shortly.' : 'This website is coming soon.'}
        </p>
      </div>
    </div>
  );

  return (
    <div id="public_site" style={bg}>
      <style>{RESP_CSS}</style>
      <BlockStyles />
      <a href="#site_main" className="hn-skip">Skip to content</a>
      {req.preview && (
        <div id="preview_banner" style={{ background: '#fbbf24', color: '#1a1400', textAlign: 'center', fontSize: 12, fontWeight: 800, padding: '4px 8px' }}>
          PREVIEW — showing the unpublished draft. Publish in the Website Center to go live.
        </div>
      )}
      {/* Header / navigation */}
      <header style={{ position: 'sticky', top: 0, zIndex: 10, backdropFilter: 'blur(8px)', background: 'color-mix(in srgb, var(--color-background, #0a0f0c) 82%, transparent)', borderBottom: '1px solid var(--color-outline-variant, #2a3330)' }}>
        <div style={{ maxWidth: 1120, margin: '0 auto', padding: '12px 20px', display: 'flex', alignItems: 'center', gap: 16 }}>
          <a href="/" onClick={e => { e.preventDefault(); navigate('/'); }} style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none', color: 'inherit' }}>
            {tenant?.logo_url ? <img src={tenant.logo_url} alt="" style={{ height: 28 }} /> : <span style={{ width: 28, height: 28, borderRadius: 8, background: 'var(--color-primary-fixed, #a3f95b)' }} />}
            <strong style={{ fontSize: 17 }}>{site.siteName}</strong>
          </a>
          <nav id="site_nav" style={{ marginInlineStart: 'auto', display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {site.navigation.map(n => {
              const active = path.replace(/\/+$/, '') === n.path.replace(/\/+$/, '');
              return (
                <a key={n.path} href={n.path} onClick={e => { e.preventDefault(); navigate(n.path); }}
                  style={{ padding: '8px 12px', borderRadius: 10, fontSize: 14, fontWeight: 600, textDecoration: 'none', color: active ? 'var(--color-on-surface, #e8ebe3)' : 'var(--color-on-surface-variant, #a7b0a6)', background: active ? 'var(--color-surface-container-high, #141a17)' : 'transparent' }}>{n.label}</a>
              );
            })}
          </nav>
        </div>
      </header>

      {/* Main content */}
      <main id="site_main" tabIndex={-1} aria-label="Main content" style={{ outline: 'none' }}>
        {resolved.notFound && (
          <section style={{ maxWidth: 760, margin: '0 auto', padding: '80px 20px', textAlign: 'center' }}>
            <h1 style={{ fontSize: 40, fontWeight: 800 }}>404</h1>
            <p style={{ color: 'var(--color-on-surface-variant, #a7b0a6)', marginTop: 8 }}>This page could not be found.</p>
            <a href="/" onClick={e => { e.preventDefault(); navigate('/'); }} style={{ color: 'var(--color-primary-fixed, #a3f95b)', marginTop: 16, display: 'inline-block' }}>← Back home</a>
          </section>
        )}

        {resolved.post && (
          <article style={{ maxWidth: 760, margin: '0 auto', padding: '56px 20px' }}>
            <a href="/blog" onClick={e => { e.preventDefault(); navigate('/blog'); }} style={{ color: 'var(--color-on-surface-variant, #a7b0a6)', fontSize: 13 }}>← Blog</a>
            <h1 style={{ fontSize: 'clamp(28px,5vw,42px)', fontWeight: 800, marginTop: 12 }}>{resolved.post.title}</h1>
            <p style={{ color: 'var(--color-on-surface-variant, #a7b0a6)', marginTop: 8, fontSize: 13 }}>{resolved.post.author} · {new Date(resolved.post.publishedAt).toLocaleDateString()}</p>
            <div style={{ marginTop: 8 }}>{resolved.post.body.map((b, i) => <BlockRenderer key={i} block={b} onNav={navigate} />)}</div>
          </article>
        )}

        {resolved.page && resolved.page.kind === 'blog_index' && (
          <section style={{ maxWidth: 900, margin: '0 auto', padding: '56px 20px' }}>
            <h1 style={{ fontSize: 'clamp(26px,4vw,36px)', fontWeight: 800 }}>{site.siteName} Blog</h1>
            <div style={{ display: 'grid', gap: 14, marginTop: 24 }}>
              {site.blog.map(post => (
                <a key={post.id} id={`post_${post.slug}`} href={`/blog/${post.slug}`} onClick={e => { e.preventDefault(); navigate(`/blog/${post.slug}`); }}
                  style={{ textDecoration: 'none', background: 'var(--color-surface-container, #10160f)', border: '1px solid var(--color-outline-variant, #2a3330)', borderRadius: 'var(--card-radius, 16px)', padding: 20, display: 'block' }}>
                  <h2 style={{ fontSize: 19, fontWeight: 700, color: 'var(--color-on-surface, #e8ebe3)', margin: 0 }}>{post.title}</h2>
                  <p style={{ color: 'var(--color-on-surface-variant, #a7b0a6)', marginTop: 6, fontSize: 14 }}>{post.excerpt}</p>
                  <span style={{ color: 'var(--color-primary-fixed, #a3f95b)', fontSize: 13, marginTop: 8, display: 'inline-block' }}>Read more →</span>
                </a>
              ))}
            </div>
          </section>
        )}

        {resolved.page && resolved.page.kind !== 'blog_index' && (
          <div>{(live ? hydrateSections(resolved.page.sections, live) : resolved.page.sections).filter(s => s.enabled !== false).map((b, i) => (
            <div key={i} className={visClass(b.visibility)}><BlockRenderer block={b} onNav={navigate} /></div>
          ))}</div>
        )}
      </main>

      {/* Footer */}
      <footer style={{ borderTop: '1px solid var(--color-outline-variant, #2a3330)', marginTop: 40 }}>
        <div style={{ maxWidth: 1120, margin: '0 auto', padding: '40px 20px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 24 }}>
            <div>
              <strong style={{ fontSize: 16 }}>{site.siteName}</strong>
              <p style={{ color: 'var(--color-on-surface-variant, #a7b0a6)', fontSize: 13, marginTop: 8 }}>{site.seoDefaults.description}</p>
            </div>
            {site.footer.columns.map((col, i) => (
              <div key={i}>
                <p style={{ fontWeight: 700, fontSize: 13, textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--color-on-surface-variant, #a7b0a6)' }}>{col.title}</p>
                <ul style={{ listStyle: 'none', padding: 0, margin: '10px 0 0', display: 'grid', gap: 6 }}>
                  {col.links.map(l => <li key={l.path}><a href={l.path} onClick={e => { e.preventDefault(); navigate(l.path); }} style={{ color: 'var(--color-on-surface, #cfd6c9)', fontSize: 14, textDecoration: 'none' }}>{l.label}</a></li>)}
                </ul>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'space-between', alignItems: 'center', marginTop: 28, paddingTop: 16, borderTop: '1px solid var(--color-outline-variant, #2a3330)' }}>
            <span style={{ color: 'var(--color-on-surface-variant, #a7b0a6)', fontSize: 13 }}>{site.footer.copyright}</span>
            <div style={{ display: 'flex', gap: 14 }}>
              {site.footer.legalLinks.map(l => <a key={l.path} href={l.path} onClick={e => { e.preventDefault(); navigate(l.path); }} style={{ color: 'var(--color-on-surface-variant, #a7b0a6)', fontSize: 13, textDecoration: 'none' }}>{l.label}</a>)}
            </div>
          </div>
        </div>
      </footer>

      {site.cookie.enabled && <CookieBanner slug={site.slug} onPrivacy={() => navigate(site.cookie.policyPath)} />}
    </div>
  );
};

const CookieBanner: React.FC<{ slug: string; onPrivacy: () => void }> = ({ slug, onPrivacy }) => {
  const key = `haat_cookie_ok_${slug}`;
  const [dismissed, setDismissed] = useState(() => { try { return localStorage.getItem(key) === '1'; } catch { return false; } });
  if (dismissed) return null;
  return (
    <div id="cookie_banner" style={{ position: 'fixed', insetInline: 16, bottom: 16, zIndex: 50, background: 'var(--color-surface-container-high, #141a17)', border: '1px solid var(--color-outline-variant, #2a3330)', borderRadius: 'var(--card-radius, 16px)', padding: 16, display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', justifyContent: 'center', maxWidth: 720, margin: '0 auto' }}>
      <span style={{ fontSize: 13, color: 'var(--color-on-surface-variant, #a7b0a6)' }}>We use cookies to improve your experience. See our <a href="#" onClick={e => { e.preventDefault(); onPrivacy(); }} style={{ color: 'var(--color-primary-fixed, #a3f95b)' }}>privacy policy</a>.</span>
      <button onClick={() => { try { localStorage.setItem(key, '1'); } catch { /* ignore */ } setDismissed(true); }}
        style={{ padding: '8px 18px', borderRadius: 'var(--button-radius, 12px)', border: 'none', cursor: 'pointer', fontWeight: 700, background: 'var(--color-primary-fixed, #a3f95b)', color: 'var(--color-on-primary-fixed, #0c2000)' }}>Accept</button>
    </div>
  );
};
