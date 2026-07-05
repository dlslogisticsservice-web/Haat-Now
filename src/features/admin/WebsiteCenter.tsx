import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Globe, Eye, UploadCloud, RotateCcw, Plus, Trash2, ChevronUp, ChevronDown, History as HistoryIcon, Copy, GripVertical, Power, Monitor, Tablet, Smartphone, Download, Upload, ImageIcon, Pencil } from 'lucide-react';
import { WorkspaceHeader, SectionHeader, EmptyStateBox } from '../../components/admin/EnterpriseUI';
import { toast } from '../../components/ui/feedback';
import { tenantService } from '../../services/tenant.service';
import { platformService } from '../../platform/platform.service';
import { websiteService, type WebsiteSite, type WebsitePage, type WebsiteBlock, type WebsiteBlockType, type WebsiteCta, type BlogPost } from '../../services/website.service';
import { MediaPicker } from '../website/MediaPicker';
import { BlockRenderer } from '../website/blocks';

type Section = 'settings' | 'nav' | 'footer' | 'pages' | 'blog' | 'seo' | 'domain' | 'history';
const BLOCK_TYPES: WebsiteBlockType[] = ['hero', 'features', 'cards', 'stats', 'testimonials', 'partners', 'gallery', 'app_download', 'faq', 'contact', 'cta', 'richtext'];
const BLOCK_LABEL: Record<WebsiteBlockType, string> = { hero: 'Hero', features: 'Features', cards: 'Cards', stats: 'Statistics', testimonials: 'Testimonials', partners: 'Partners', gallery: 'Gallery', app_download: 'App Download', faq: 'FAQ', contact: 'Contact', cta: 'CTA', richtext: 'Rich text' };
// Reusable section templates — insert a pre-built set of sections (composed from the same block types).
const SECTION_TEMPLATES: { key: string; label: string; make: () => WebsiteBlockType[] }[] = [
  { key: 'saas', label: 'SaaS landing', make: () => ['hero', 'features', 'stats', 'testimonials', 'cta'] },
  { key: 'product', label: 'Product', make: () => ['hero', 'cards', 'gallery', 'app_download'] },
  { key: 'simple', label: 'Simple', make: () => ['hero', 'richtext', 'contact'] },
];

const card: React.CSSProperties = { background: 'var(--color-surface-container)', border: '1px solid var(--color-outline-variant)', borderRadius: 14 };
const inputStyle: React.CSSProperties = { width: '100%', background: 'var(--color-surface-container-high)', border: '1px solid var(--color-outline-variant)', borderRadius: 10, padding: '9px 11px', color: 'var(--color-on-surface)', fontSize: 14, outline: 'none' };

const Field: React.FC<{ label: string; value: string; onChange: (v: string) => void; textarea?: boolean; placeholder?: string; id?: string }> = ({ label, value, onChange, textarea, placeholder, id }) => (
  <label className="block">
    <span className="text-[11px] font-bold" style={{ color: 'var(--color-on-surface-variant)' }}>{label}</span>
    {textarea
      ? <textarea id={id} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} rows={4} style={{ ...inputStyle, resize: 'vertical', marginTop: 4 }} />
      : <input id={id} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} style={{ ...inputStyle, marginTop: 4 }} />}
  </label>
);
const Toggle: React.FC<{ label: string; checked: boolean; onChange: (v: boolean) => void; hint?: string; id?: string }> = ({ label, checked, onChange, hint, id }) => (
  <button id={id} onClick={() => onChange(!checked)} className="flex items-center justify-between w-full cursor-pointer" style={{ ...card, padding: '10px 12px' }}>
    <span className="text-left"><span className="text-sm font-semibold" style={{ color: 'var(--color-on-surface)' }}>{label}</span>{hint && <span className="block text-[11px]" style={{ color: 'var(--color-on-surface-variant)' }}>{hint}</span>}</span>
    <span style={{ width: 40, height: 22, borderRadius: 999, background: checked ? 'var(--color-primary-fixed)' : 'var(--color-outline-variant)', position: 'relative', flexShrink: 0 }}>
      <span style={{ position: 'absolute', top: 2, insetInlineStart: checked ? 20 : 2, width: 18, height: 18, borderRadius: 999, background: '#fff', transition: 'inset-inline-start .15s' }} />
    </span>
  </button>
);
const Btn: React.FC<{ onClick: () => void; children: React.ReactNode; primary?: boolean; danger?: boolean; id?: string }> = ({ onClick, children, primary, danger, id }) => (
  <button id={id} onClick={onClick} className="inline-flex items-center gap-1.5 cursor-pointer" style={{
    padding: '8px 14px', borderRadius: 10, fontSize: 13, fontWeight: 700, border: 'none',
    background: primary ? 'var(--color-primary-fixed)' : danger ? 'rgba(248,113,113,0.14)' : 'var(--color-surface-container-high)',
    color: primary ? 'var(--color-on-primary-fixed)' : danger ? '#f87171' : 'var(--color-on-surface)',
  }}>{children}</button>
);

export const WebsiteCenter: React.FC<{ lang: 'ar' | 'en' }> = ({ lang }) => {
  const L = (ar: string, en: string) => (lang === 'ar' ? ar : en);
  const [tenants, setTenants] = useState<any[]>([]);
  const [tenantId, setTenantId] = useState('');
  const [site, setSite] = useState<WebsiteSite | null>(null);
  const [section, setSection] = useState<Section>('settings');
  const [pageId, setPageId] = useState('');
  const [postId, setPostId] = useState('');
  const [versions, setVersions] = useState<{ version: number; at: string }[]>([]);

  useEffect(() => { tenantService.list().then(({ data }) => { const ts = (data as any[]) || []; setTenants(ts); if (ts[0]) setTenantId(String(ts[0].id)); }); }, []);
  const reload = (id = tenantId) => { if (!id) return; setSite(websiteService.getDraftSite(id)); setVersions(websiteService.listVersions(id)); };
  useEffect(() => { if (tenantId) reload(tenantId); /* eslint-disable-next-line */ }, [tenantId]);

  const analyticsProviders = useMemo(() => { try { return platformService.providers().filter(p => p.category === 'analytics'); } catch { return []; } }, []);

  if (!site) return (
    <div id="website_center">
      <WorkspaceHeader Icon={Globe} title={L('مركز الموقع', 'Website Center')} subtitle={L('إدارة مواقع المستأجرين', 'Manage tenant websites')} />
      <EmptyStateBox Icon={Globe} title={L('لا يوجد مستأجر', 'No tenant selected')} description={L('اختر مستأجراً لإدارة موقعه.', 'Select a tenant to manage its website.')} />
    </div>
  );

  const patch = (p: Partial<WebsiteSite>) => { setSite({ ...site, ...p }); websiteService.saveDraft(tenantId, p); };
  const publish = () => { websiteService.publish(tenantId); reload(); toast.success(L('تم النشر', 'Published — live now')); };
  const preview = () => { try { window.open(`?site=${site.slug}&preview=1`, '_blank'); } catch { /* ignore */ } };
  const rollback = (v: number) => { websiteService.rollback(tenantId, v); reload(); toast.success(L('تمت الاستعادة', 'Rolled back')); };
  const savePage = (page: WebsitePage) => { websiteService.updatePage(tenantId, page); reload(); };
  const selectedPage = site.pages.find(p => p.id === pageId) || null;
  const selectedPost = site.blog.find(b => b.id === postId) || null;

  const TABS: { k: Section; label: string }[] = [
    { k: 'settings', label: L('الإعدادات', 'Settings') },
    { k: 'nav', label: L('التنقل', 'Navigation') },
    { k: 'footer', label: L('التذييل', 'Footer') },
    { k: 'pages', label: L('الصفحات', 'Pages') },
    { k: 'blog', label: L('المدونة', 'Blog') },
    { k: 'seo', label: L('SEO والتحليلات', 'SEO & Analytics') },
    { k: 'domain', label: L('النطاق والحالة', 'Domain & Status') },
    { k: 'history', label: L('السجل', 'History') },
  ];

  return (
    <div id="website_center" className="space-y-4" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      <WorkspaceHeader Icon={Globe} title={L('مركز الموقع', 'Website Center')}
        subtitle={L('محرّرات مرئية · مسودة/نشر/معاينة/استعادة', 'Visual editors · draft / publish / preview / rollback')}
        actions={
          <div className="flex items-center gap-2">
            <select value={tenantId} onChange={e => { setTenantId(e.target.value); setPageId(''); setPostId(''); }} style={{ ...inputStyle, width: 'auto' }} id="website_tenant_select">
              {tenants.map(t => <option key={t.id} value={String(t.id)}>{t.brand_name || t.slug}</option>)}
            </select>
            <Btn onClick={preview} id="website_preview_btn"><Eye size={14} />{L('معاينة', 'Preview')}</Btn>
            <Btn onClick={publish} primary id="website_publish_btn"><UploadCloud size={14} />{L('نشر', 'Publish')}</Btn>
          </div>
        } />

      {/* Section tabs */}
      <div className="flex flex-wrap gap-1.5">
        {TABS.map(t => (
          <button key={t.k} onClick={() => setSection(t.k)} style={{
            padding: '6px 13px', borderRadius: 999, fontSize: 13, fontWeight: 700, border: 'none', cursor: 'pointer',
            background: section === t.k ? 'var(--color-primary-fixed)' : 'var(--color-surface-container-high)',
            color: section === t.k ? 'var(--color-on-primary-fixed)' : 'var(--color-on-surface-variant)',
          }}>{t.label}</button>
        ))}
      </div>

      {/* ── Settings ── */}
      {section === 'settings' && (
        <div style={{ ...card, padding: 16 }} className="space-y-3 max-w-xl">
          <Field label={L('اسم الموقع', 'Site name')} value={site.siteName} onChange={v => patch({ siteName: v })} id="ws_site_name" />
          <label className="block">
            <span className="text-[11px] font-bold" style={{ color: 'var(--color-on-surface-variant)' }}>{L('حالة الموقع', 'Website status')}</span>
            <select value={site.status} onChange={e => patch({ status: e.target.value as WebsiteSite['status'] })} style={{ ...inputStyle, marginTop: 4 }} id="ws_status">
              <option value="published">{L('منشور', 'Published')}</option>
              <option value="draft">{L('مسودة', 'Draft')}</option>
              <option value="suspended">{L('موقوف', 'Suspended')}</option>
            </select>
          </label>
          <Toggle label={L('وضع الصيانة', 'Maintenance mode')} hint={L('يعرض شاشة صيانة للزوّار', 'Shows a maintenance screen to visitors')} checked={site.maintenance} onChange={v => patch({ maintenance: v })} id="ws_maintenance" />
        </div>
      )}

      {/* ── Navigation ── */}
      {section === 'nav' && (
        <div style={{ ...card, padding: 16 }} className="space-y-2 max-w-2xl">
          <SectionHeader title={L('روابط التنقل', 'Navigation links')} action={<Btn onClick={() => patch({ navigation: [...site.navigation, { label: 'New', path: '/new' }] })} id="ws_nav_add"><Plus size={14} />{L('إضافة', 'Add')}</Btn>} />
          {site.navigation.map((n, i) => (
            <div key={i} className="flex items-center gap-2">
              <input value={n.label} onChange={e => patch({ navigation: site.navigation.map((x, j) => j === i ? { ...x, label: e.target.value } : x) })} placeholder={L('التسمية', 'Label')} style={inputStyle} />
              <input value={n.path} onChange={e => patch({ navigation: site.navigation.map((x, j) => j === i ? { ...x, path: e.target.value } : x) })} placeholder="/path" style={inputStyle} />
              <button onClick={() => i > 0 && patch({ navigation: swap(site.navigation, i, i - 1) })} style={iconBtn}><ChevronUp size={15} /></button>
              <button onClick={() => i < site.navigation.length - 1 && patch({ navigation: swap(site.navigation, i, i + 1) })} style={iconBtn}><ChevronDown size={15} /></button>
              <button onClick={() => patch({ navigation: site.navigation.filter((_, j) => j !== i) })} style={{ ...iconBtn, color: '#f87171' }}><Trash2 size={15} /></button>
            </div>
          ))}
        </div>
      )}

      {/* ── Footer ── */}
      {section === 'footer' && (
        <div style={{ ...card, padding: 16 }} className="space-y-4 max-w-2xl">
          <Field label={L('حقوق النشر', 'Copyright')} value={site.footer.copyright} onChange={v => patch({ footer: { ...site.footer, copyright: v } })} />
          {site.footer.columns.map((col, ci) => (
            <div key={ci} style={{ ...card, padding: 12 }} className="space-y-2">
              <div className="flex items-center gap-2">
                <input value={col.title} onChange={e => patch({ footer: { ...site.footer, columns: site.footer.columns.map((c, j) => j === ci ? { ...c, title: e.target.value } : c) } })} placeholder={L('عنوان العمود', 'Column title')} style={inputStyle} />
                <button onClick={() => patch({ footer: { ...site.footer, columns: site.footer.columns.filter((_, j) => j !== ci) } })} style={{ ...iconBtn, color: '#f87171' }}><Trash2 size={15} /></button>
              </div>
              {col.links.map((l, li) => (
                <div key={li} className="flex items-center gap-2 ps-3">
                  <input value={l.label} onChange={e => setColLink(patch, site, ci, li, { label: e.target.value })} placeholder={L('التسمية', 'Label')} style={inputStyle} />
                  <input value={l.path} onChange={e => setColLink(patch, site, ci, li, { path: e.target.value })} placeholder="/path" style={inputStyle} />
                  <button onClick={() => patch({ footer: { ...site.footer, columns: site.footer.columns.map((c, j) => j === ci ? { ...c, links: c.links.filter((_, k) => k !== li) } : c) } })} style={{ ...iconBtn, color: '#f87171' }}><Trash2 size={15} /></button>
                </div>
              ))}
              <Btn onClick={() => patch({ footer: { ...site.footer, columns: site.footer.columns.map((c, j) => j === ci ? { ...c, links: [...c.links, { label: 'Link', path: '/' }] } : c) } })}><Plus size={13} />{L('رابط', 'Link')}</Btn>
            </div>
          ))}
          <Btn onClick={() => patch({ footer: { ...site.footer, columns: [...site.footer.columns, { title: 'Column', links: [] }] } })} id="ws_footer_col_add"><Plus size={14} />{L('عمود', 'Column')}</Btn>
        </div>
      )}

      {/* ── Pages (visual block editor; covers home/landing/about/contact/help/privacy/terms/custom) ── */}
      {section === 'pages' && (
        <div className="grid md:grid-cols-[220px_1fr] gap-4">
          <div style={{ ...card, padding: 10 }} className="space-y-1">
            <Btn onClick={() => { const p = websiteService.addPage(tenantId, 'New page', 'new-page'); reload(); if (p) setPageId(p.id); }} id="ws_page_add"><Plus size={14} />{L('صفحة جديدة', 'New page')}</Btn>
            {site.pages.map(p => (
              <button key={p.id} onClick={() => setPageId(p.id)} className="w-full text-start px-2.5 py-2 rounded-lg text-sm cursor-pointer" style={{ background: pageId === p.id ? 'var(--color-surface-container-high)' : 'transparent', color: 'var(--color-on-surface)' }}>
                <span className="font-semibold">{p.title}</span><span className="text-[11px] block" style={{ color: 'var(--color-on-surface-variant)' }}>{p.path} · {p.kind}</span>
              </button>
            ))}
          </div>
          <div>
            {!selectedPage ? <EmptyStateBox Icon={Globe} title={L('اختر صفحة', 'Select a page')} description={L('اختر صفحة لتحرير محتواها بصرياً.', 'Pick a page to edit its content visually.')} />
              : <PageEditor page={selectedPage} onChange={savePage} onRemove={() => { websiteService.removePage(tenantId, selectedPage.id); setPageId(''); reload(); }} L={L} lang={lang} siteName={site.siteName} />}
          </div>
        </div>
      )}

      {/* ── Blog ── */}
      {section === 'blog' && (
        <div className="grid md:grid-cols-[220px_1fr] gap-4">
          <div style={{ ...card, padding: 10 }} className="space-y-1">
            <Btn onClick={() => { const post: BlogPost = { id: `b_${Date.now().toString(36)}`, slug: `post-${site.blog.length + 1}`, title: 'New post', excerpt: '', body: [{ type: 'richtext', body: '' }], author: site.siteName, publishedAt: new Date().toISOString(), tags: [], seo: {} }; websiteService.upsertPost(tenantId, post); reload(); setPostId(post.id); }} id="ws_post_add"><Plus size={14} />{L('مقال جديد', 'New post')}</Btn>
            {site.blog.map(b => (
              <button key={b.id} onClick={() => setPostId(b.id)} className="w-full text-start px-2.5 py-2 rounded-lg text-sm cursor-pointer" style={{ background: postId === b.id ? 'var(--color-surface-container-high)' : 'transparent', color: 'var(--color-on-surface)' }}>
                <span className="font-semibold">{b.title}</span><span className="text-[11px] block" style={{ color: 'var(--color-on-surface-variant)' }}>/blog/{b.slug}</span>
              </button>
            ))}
          </div>
          <div>
            {!selectedPost ? <EmptyStateBox Icon={Globe} title={L('اختر مقالاً', 'Select a post')} />
              : <PostEditor post={selectedPost} onChange={p => { websiteService.upsertPost(tenantId, p); reload(); }} onRemove={() => { websiteService.removePost(tenantId, selectedPost.id); setPostId(''); reload(); }} L={L} />}
          </div>
        </div>
      )}

      {/* ── SEO / OpenGraph / Analytics / Cookie ── */}
      {section === 'seo' && (
        <div style={{ ...card, padding: 16 }} className="space-y-3 max-w-xl">
          <SectionHeader title={L('SEO الافتراضي و OpenGraph', 'Default SEO & OpenGraph')} />
          <Field label={L('العنوان الافتراضي', 'Default title')} value={site.seoDefaults.title || ''} onChange={v => patch({ seoDefaults: { ...site.seoDefaults, title: v } })} id="ws_seo_title" />
          <Field label={L('الوصف الافتراضي', 'Default description')} value={site.seoDefaults.description || ''} onChange={v => patch({ seoDefaults: { ...site.seoDefaults, description: v } })} textarea />
          <Field label={L('صورة OpenGraph (رابط)', 'OpenGraph image URL')} value={site.seoDefaults.ogImage || ''} onChange={v => patch({ seoDefaults: { ...site.seoDefaults, ogImage: v } })} placeholder="https://…" />
          <SectionHeader title={L('التحليلات', 'Analytics')} />
          <label className="block">
            <span className="text-[11px] font-bold" style={{ color: 'var(--color-on-surface-variant)' }}>{L('مزوّد التحليلات', 'Analytics provider')}</span>
            <select value={site.analytics.providerId || ''} onChange={e => patch({ analytics: { ...site.analytics, providerId: e.target.value || undefined } })} style={{ ...inputStyle, marginTop: 4 }} id="ws_analytics_provider">
              <option value="">{L('لا شيء', 'None')}</option>
              {analyticsProviders.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </label>
          <Field label={L('معرّف القياس', 'Measurement ID')} value={site.analytics.measurementId || ''} onChange={v => patch({ analytics: { ...site.analytics, measurementId: v } })} placeholder="G-XXXX / …" />
          <SectionHeader title={L('لافتة الكوكيز', 'Cookie banner')} />
          <Toggle label={L('تفعيل لافتة الكوكيز', 'Enable cookie banner')} checked={site.cookie.enabled} onChange={v => patch({ cookie: { ...site.cookie, enabled: v } })} id="ws_cookie_toggle" />
          <Field label={L('رابط سياسة الكوكيز', 'Cookie policy path')} value={site.cookie.policyPath} onChange={v => patch({ cookie: { ...site.cookie, policyPath: v } })} placeholder="/privacy" />
        </div>
      )}

      {/* ── Domain / SSL / Status ── */}
      {section === 'domain' && (
        <div style={{ ...card, padding: 16 }} className="space-y-3 max-w-xl">
          <label className="block">
            <span className="text-[11px] font-bold" style={{ color: 'var(--color-on-surface-variant)' }}>{L('النطاق الفرعي (المنصّة)', 'Tenant subdomain (managed)')}</span>
            <input value={`${site.slug}.haatnow.app`} readOnly style={{ ...inputStyle, marginTop: 4, opacity: 0.7 }} />
          </label>
          <Field label={L('نطاق مخصّص', 'Custom domain')} value={site.customDomain || ''} onChange={v => patch({ customDomain: v || undefined })} placeholder="www.example.com" id="ws_custom_domain" />
          <label className="block">
            <span className="text-[11px] font-bold" style={{ color: 'var(--color-on-surface-variant)' }}>{L('حالة SSL', 'SSL status')}</span>
            <select value={site.sslStatus || 'none'} onChange={e => patch({ sslStatus: e.target.value as WebsiteSite['sslStatus'] })} style={{ ...inputStyle, marginTop: 4 }} id="ws_ssl_status">
              <option value="none">{L('لا يوجد', 'None')}</option>
              <option value="provisioning">{L('قيد الإصدار', 'Provisioning')}</option>
              <option value="active">{L('نشط', 'Active')}</option>
            </select>
          </label>
          <p className="text-[11px]" style={{ color: 'var(--color-on-surface-variant)' }}>
            {L('الأولوية وقت التشغيل: نطاق مخصّص ← نطاق فرعي ← مُعامل التطوير (‎?site=‎، ليس أساسياً).', 'Runtime priority: custom domain → subdomain → dev query param (?site=, non-primary).')}
          </p>
        </div>
      )}

      {/* ── History / Rollback ── */}
      {section === 'history' && (
        <div style={{ ...card, padding: 16 }} className="space-y-2 max-w-xl">
          <SectionHeader title={L('سجل الإصدارات', 'Version history')} />
          {versions.length === 0 ? <EmptyStateBox Icon={HistoryIcon} title={L('لا يوجد سجل بعد', 'No history yet')} description={L('كل نشر ينشئ نسخة قابلة للاستعادة.', 'Each publish creates a restorable version.')} />
            : versions.map(v => (
              <div key={v.version} className="flex items-center justify-between" style={{ ...card, padding: '10px 12px' }}>
                <span className="text-sm" style={{ color: 'var(--color-on-surface)' }}>v{v.version} · <span style={{ color: 'var(--color-on-surface-variant)' }}>{new Date(v.at).toLocaleString()}</span></span>
                <Btn onClick={() => rollback(v.version)} id={`ws_rollback_${v.version}`}><RotateCcw size={13} />{L('استعادة', 'Rollback')}</Btn>
              </div>
            ))}
        </div>
      )}
    </div>
  );
};

const iconBtn: React.CSSProperties = { width: 34, height: 34, borderRadius: 9, background: 'var(--color-surface-container-high)', border: 'none', color: 'var(--color-on-surface-variant)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 };
function swap<T>(arr: T[], i: number, j: number): T[] { const a = [...arr]; [a[i], a[j]] = [a[j], a[i]]; return a; }
function setColLink(patch: (p: any) => void, site: WebsiteSite, ci: number, li: number, part: { label?: string; path?: string }) {
  patch({ footer: { ...site.footer, columns: site.footer.columns.map((c, j) => j === ci ? { ...c, links: c.links.map((l, k) => k === li ? { ...l, ...part } : l) } : c) } });
}

// ── Visual page editor (block-based; no JSON) ─────────────────────────────────
// ── The visual Website Experience Builder (drag&drop · enable/duplicate/delete · visibility · device preview) ──
const PageEditor: React.FC<{ page: WebsitePage; onChange: (p: WebsitePage) => void; onRemove: () => void; L: (a: string, e: string) => string; lang: 'ar' | 'en'; siteName: string }> = ({ page, onChange, onRemove, L, lang, siteName }) => {
  const [device, setDevice] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');
  const [openIdx, setOpenIdx] = useState<number | null>(0);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const up = (patch: Partial<WebsitePage>) => onChange({ ...page, ...patch });
  const setBlock = (i: number, b: WebsiteBlock) => up({ sections: page.sections.map((x, j) => (j === i ? b : x)) });
  const addBlock = (t: WebsiteBlockType) => { up({ sections: [...page.sections, newBlock(t)] }); setOpenIdx(page.sections.length); setShowAdd(false); };
  const addTemplate = (types: WebsiteBlockType[]) => up({ sections: [...page.sections, ...types.map(newBlock)] });
  const dup = (i: number) => { const s = page.sections.slice(); s.splice(i + 1, 0, JSON.parse(JSON.stringify(s[i]))); up({ sections: s }); };
  const del = (i: number) => { up({ sections: page.sections.filter((_, j) => j !== i) }); setOpenIdx(null); };
  const move = (from: number, to: number) => { if (to < 0 || to >= page.sections.length) return; const s = page.sections.slice(); const [m] = s.splice(from, 1); s.splice(to, 0, m); up({ sections: s }); };
  const toggleEnabled = (i: number) => setBlock(i, { ...page.sections[i], enabled: page.sections[i].enabled === false ? true : false });
  const setVis = (i: number, key: 'desktop' | 'tablet' | 'mobile', on: boolean) => setBlock(i, { ...page.sections[i], visibility: { ...page.sections[i].visibility, [key]: on } });
  const exportLayout = () => { try { const blob = new Blob([JSON.stringify({ version: 1, kind: 'haat-page-layout', sections: page.sections }, null, 2)], { type: 'application/json' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `${(page.title || 'page').replace(/\s+/g, '-')}-layout.json`; a.click(); } catch { toast.error(L('تعذّر التصدير', 'Export failed')); } };
  const importLayout = (file?: File) => { if (!file) return; const r = new FileReader(); r.onload = () => { try { const j = JSON.parse(String(r.result)); if (Array.isArray(j.sections)) { up({ sections: j.sections }); toast.success(L('تم استيراد التصميم', 'Layout imported')); } else toast.error(L('ملف غير صالح', 'Invalid layout file')); } catch { toast.error(L('ملف غير صالح', 'Invalid file')); } }; r.readAsText(file); };

  const width = device === 'mobile' ? 390 : device === 'tablet' ? 768 : '100%';
  const visibleSections = page.sections.filter(s => s.enabled !== false).filter(s => { const v = s.visibility; if (!v) return true; return device === 'desktop' ? v.desktop !== false : device === 'tablet' ? v.tablet !== false : v.mobile !== false; });
  const devBtn = (d: typeof device, Icon: any) => <button onClick={() => setDevice(d)} style={{ ...iconBtn, background: device === d ? 'var(--color-primary-fixed)' : 'var(--color-surface-container-high)', color: device === d ? 'var(--color-on-primary-fixed)' : 'var(--color-on-surface-variant)' }} id={`preview_${d}`}><Icon size={15} /></button>;

  return (
    <div className="grid xl:grid-cols-[1fr_minmax(300px,40%)] gap-4">
      {/* Builder */}
      <div style={{ ...card, padding: 16 }} className="space-y-3" id="page_builder">
        <div className="flex items-center justify-between gap-2">
          <input value={page.title} onChange={e => up({ title: e.target.value })} style={inputStyle} id="ws_page_title" />
          <Btn onClick={onRemove} danger id="ws_page_remove"><Trash2 size={14} />{L('حذف', 'Delete')}</Btn>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Field label={L('المسار', 'Path')} value={page.path} onChange={v => up({ path: v })} />
          <label className="flex items-end gap-2 pb-1"><input type="checkbox" checked={page.nav} onChange={e => up({ nav: e.target.checked })} /> <span className="text-sm" style={{ color: 'var(--color-on-surface)' }}>{L('في التنقل', 'Show in nav')}</span></label>
        </div>
        <Field label={L('عنوان SEO للصفحة', 'Page SEO title')} value={page.seo.title || ''} onChange={v => up({ seo: { ...page.seo, title: v } })} />

        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-2">
          <Btn onClick={() => setShowAdd(v => !v)} primary id="ws_block_add"><Plus size={14} />{L('إضافة قسم', 'Add section')}</Btn>
          <select value="" onChange={e => { const t = SECTION_TEMPLATES.find(x => x.key === e.target.value); if (t) addTemplate(t.make()); }} style={{ ...inputStyle, width: 'auto' }} id="ws_template_add">
            <option value="">{L('قوالب أقسام…', 'Section templates…')}</option>
            {SECTION_TEMPLATES.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
          </select>
          <Btn onClick={() => fileRef.current?.click()} id="ws_import"><Upload size={13} />{L('استيراد', 'Import')}</Btn>
          <Btn onClick={exportLayout} id="ws_export"><Download size={13} />{L('تصدير', 'Export')}</Btn>
          <input ref={fileRef} type="file" accept="application/json" style={{ display: 'none' }} onChange={e => importLayout(e.target.files?.[0])} />
        </div>
        {showAdd && (
          <div id="section_palette" className="grid grid-cols-3 gap-1.5 p-2 rounded-xl" style={{ background: 'var(--color-surface-container-high)' }}>
            {BLOCK_TYPES.map(t => <button key={t} id={`add_${t}`} onClick={() => addBlock(t)} className="px-2 py-2 rounded-lg text-[12px] font-semibold cursor-pointer" style={{ background: 'var(--color-surface-container)', color: 'var(--color-on-surface)' }}>{BLOCK_LABEL[t]}</button>)}
          </div>
        )}

        {/* Section list — drag & drop */}
        <div id="section_list" className="space-y-2">
          {page.sections.map((b, i) => {
            const on = b.enabled !== false;
            const v = b.visibility || {};
            return (
              <div key={i} draggable onDragStart={() => setDragIdx(i)} onDragOver={e => e.preventDefault()} onDrop={() => { if (dragIdx !== null && dragIdx !== i) move(dragIdx, i); setDragIdx(null); }}
                id={`section_${i}`} style={{ ...card, padding: 0, opacity: on ? 1 : 0.55, outline: dragIdx === i ? '2px dashed var(--color-primary-fixed)' : 'none' }}>
                <div className="flex items-center gap-1.5 px-2.5 py-2">
                  <span style={{ cursor: 'grab', color: 'var(--color-on-surface-variant)' }} title={L('اسحب لإعادة الترتيب', 'Drag to reorder')}><GripVertical size={15} /></span>
                  <span className="text-[12px] font-bold flex-1" style={{ color: 'var(--color-on-surface)' }}>{BLOCK_LABEL[b.type]}</span>
                  <button onClick={() => toggleEnabled(i)} title={on ? L('تعطيل', 'Disable') : L('تفعيل', 'Enable')} id={`toggle_${i}`} style={{ ...iconBtn, color: on ? '#4ade80' : 'var(--color-on-surface-variant)' }}><Power size={14} /></button>
                  <button onClick={() => move(i, i - 1)} style={iconBtn}><ChevronUp size={14} /></button>
                  <button onClick={() => move(i, i + 1)} style={iconBtn}><ChevronDown size={14} /></button>
                  <button onClick={() => dup(i)} title={L('تكرار', 'Duplicate')} id={`dup_${i}`} style={iconBtn}><Copy size={14} /></button>
                  <button onClick={() => del(i)} title={L('حذف', 'Delete')} id={`del_${i}`} style={{ ...iconBtn, color: '#f87171' }}><Trash2 size={14} /></button>
                  <button onClick={() => setOpenIdx(openIdx === i ? null : i)} id={`edit_${i}`} style={{ ...iconBtn, background: openIdx === i ? 'var(--color-primary-fixed)' : 'var(--color-surface-container-high)', color: openIdx === i ? 'var(--color-on-primary-fixed)' : 'var(--color-on-surface-variant)' }}><Pencil size={14} /></button>
                </div>
                {openIdx === i && (
                  <div className="px-3 pb-3 space-y-2" style={{ borderTop: '1px solid var(--color-outline-variant)' }}>
                    <div className="pt-2"><BlockEditor block={b} onChange={nb => setBlock(i, nb)} L={L} lang={lang} /></div>
                    <div className="flex items-center gap-2 flex-wrap pt-1">
                      <span className="text-[11px] font-bold" style={{ color: 'var(--color-on-surface-variant)' }}>{L('الظهور', 'Visible on')}:</span>
                      {(['desktop', 'tablet', 'mobile'] as const).map(k => {
                        const vis = (v as any)[k] !== false;
                        return <button key={k} onClick={() => setVis(i, k, !vis)} id={`vis_${i}_${k}`} className="text-[11px] px-2 py-1 rounded-md cursor-pointer" style={{ background: vis ? 'rgba(74,222,128,0.14)' : 'var(--color-surface-container-high)', color: vis ? '#4ade80' : 'var(--color-on-surface-variant)' }}>{k}</button>;
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          {page.sections.length === 0 && <p className="text-[12px] text-center py-6" style={{ color: 'var(--color-on-surface-variant)' }}>{L('لا أقسام — أضف قسمًا أو قالبًا.', 'No sections — add one or a template.')}</p>}
        </div>
      </div>

      {/* Live device preview (reuses the public BlockRenderer; updates immediately) */}
      <div id="page_preview" className="space-y-2">
        <div className="flex items-center gap-1.5">
          {devBtn('desktop', Monitor)}{devBtn('tablet', Tablet)}{devBtn('mobile', Smartphone)}
          <span className="text-[11px] ms-1" style={{ color: 'var(--color-on-surface-variant)' }}>{L('معاينة مباشرة', 'Live preview')} · {device}</span>
        </div>
        <div style={{ ...card, padding: 12, background: 'var(--color-background)', overflow: 'auto', maxHeight: '70vh' }}>
          <div style={{ width, maxWidth: '100%', margin: '0 auto', background: 'var(--color-background)', border: '1px solid var(--color-outline-variant)', borderRadius: 10, overflow: 'hidden' }} id="preview_frame">
            <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--color-outline-variant)', fontWeight: 800, fontSize: 14, color: 'var(--color-on-surface)' }}>{siteName}</div>
            {visibleSections.length === 0 ? <p className="text-[12px] text-center py-8" style={{ color: 'var(--color-on-surface-variant)' }}>{L('لا شيء لعرضه على هذا الجهاز.', 'Nothing visible on this device.')}</p>
              : visibleSections.map((b, i) => <BlockRenderer key={i} block={b} onNav={() => {}} />)}
          </div>
        </div>
      </div>
    </div>
  );
};

const PostEditor: React.FC<{ post: BlogPost; onChange: (p: BlogPost) => void; onRemove: () => void; L: (a: string, e: string) => string }> = ({ post, onChange, onRemove, L }) => {
  const up = (patch: Partial<BlogPost>) => onChange({ ...post, ...patch });
  const body0 = post.body.find(b => b.type === 'richtext') as Extract<WebsiteBlock, { type: 'richtext' }> | undefined;
  return (
    <div style={{ ...card, padding: 16 }} className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <input value={post.title} onChange={e => up({ title: e.target.value })} style={inputStyle} id="ws_post_title" />
        <Btn onClick={onRemove} danger><Trash2 size={14} />{L('حذف', 'Delete')}</Btn>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Slug" value={post.slug} onChange={v => up({ slug: v })} />
        <Field label={L('الكاتب', 'Author')} value={post.author} onChange={v => up({ author: v })} />
      </div>
      <Field label={L('المقتطف', 'Excerpt')} value={post.excerpt} onChange={v => up({ excerpt: v })} textarea />
      <Field label={L('المحتوى', 'Body')} value={body0?.body || ''} onChange={v => up({ body: [{ type: 'richtext', body: v }] })} textarea />
    </div>
  );
};

function newBlock(t: WebsiteBlockType): WebsiteBlock {
  switch (t) {
    case 'hero': return { type: 'hero', title: 'Headline', subtitle: 'A short supporting subtitle.', layout: 'center', overlay: 0.5, ctas: [{ label: 'Get started', href: '/contact', style: 'primary' }] };
    case 'features': return { type: 'features', heading: 'Features', items: [{ title: 'Feature', body: 'Description' }] };
    case 'cards': return { type: 'cards', heading: 'Highlights', items: [{ title: 'Card', body: 'Description' }] };
    case 'stats': return { type: 'stats', heading: 'By the numbers', items: [{ value: '10k+', label: 'Customers' }] };
    case 'testimonials': return { type: 'testimonials', heading: 'What people say', items: [{ quote: 'Amazing service.', author: 'Jane Doe', role: 'Customer' }] };
    case 'partners': return { type: 'partners', heading: 'Trusted by', logos: [] };
    case 'gallery': return { type: 'gallery', heading: 'Gallery', images: [] };
    case 'app_download': return { type: 'app_download', heading: 'Get the app', subtitle: 'Order in one tap.', iosUrl: '', androidUrl: '' };
    case 'faq': return { type: 'faq', heading: 'FAQ', items: [{ q: 'Question?', a: 'Answer.' }] };
    case 'contact': return { type: 'contact', heading: 'Contact', email: '' };
    case 'cta': return { type: 'cta', title: 'Call to action', button: { label: 'Get started', href: '/contact' } };
    default: return { type: 'richtext', heading: '', body: '' };
  }
}

// Media field — reuses the Media Library picker (assets.service). No free-text media entry.
const MediaField: React.FC<{ label: string; value: string; kind?: 'image' | 'video'; onChange: (u: string) => void; lang: 'ar' | 'en' }> = ({ label, value, kind = 'image', onChange, lang }) => {
  const [open, setOpen] = useState(false);
  const L = (a: string, e: string) => (lang === 'ar' ? a : e);
  return (
    <div>
      <span className="text-[11px] font-bold" style={{ color: 'var(--color-on-surface-variant)' }}>{label}</span>
      <div className="flex items-center gap-2 mt-1">
        {value ? (kind === 'video' ? <span style={thumb}>▶</span> : <img src={value} alt="" style={{ ...thumb, objectFit: 'cover' } as any} />) : <span style={{ ...thumb, display: 'grid', placeItems: 'center', color: 'var(--color-on-surface-variant)' }}><ImageIcon size={16} /></span>}
        <button onClick={() => setOpen(true)} className="text-[12px] font-bold cursor-pointer" style={{ padding: '7px 12px', borderRadius: 9, background: 'var(--color-surface-container-high)', color: 'var(--color-on-surface)', border: 'none' }}>{L('من المكتبة', 'From library')}</button>
        {value && <button onClick={() => onChange('')} className="text-[12px] cursor-pointer" style={{ color: '#f87171', background: 'transparent', border: 'none' }}>{L('مسح', 'Clear')}</button>}
      </div>
      <MediaPicker open={open} kind={kind} onPick={onChange} onClose={() => setOpen(false)} lang={lang} />
    </div>
  );
};
const MediaListField: React.FC<{ label: string; values: string[]; kind?: 'image' | 'video'; onChange: (v: string[]) => void; lang: 'ar' | 'en' }> = ({ label, values, kind = 'image', onChange, lang }) => {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <span className="text-[11px] font-bold" style={{ color: 'var(--color-on-surface-variant)' }}>{label}</span>
      <div className="flex flex-wrap gap-2 mt-1">
        {values.map((v, i) => (
          <div key={i} style={{ position: 'relative' }}>
            <img src={v} alt="" style={{ ...thumb, objectFit: 'cover' } as any} />
            <button onClick={() => onChange(values.filter((_, j) => j !== i))} style={{ position: 'absolute', top: -6, insetInlineEnd: -6, width: 18, height: 18, borderRadius: 999, background: '#f87171', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 11, lineHeight: '18px' }}>×</button>
          </div>
        ))}
        <button onClick={() => setOpen(true)} style={{ ...thumb, display: 'grid', placeItems: 'center', cursor: 'pointer', border: '1px dashed var(--color-outline-variant)', color: 'var(--color-on-surface-variant)' }}><Plus size={16} /></button>
      </div>
      <MediaPicker open={open} kind={kind} onPick={u => onChange([...values, u])} onClose={() => setOpen(false)} lang={lang} />
    </div>
  );
};

const ItemDel: React.FC<{ onClick: () => void }> = ({ onClick }) => <button onClick={onClick} style={{ ...iconBtn, color: '#f87171', marginBottom: 2 }}><Trash2 size={14} /></button>;

const BlockEditor: React.FC<{ block: WebsiteBlock; onChange: (b: WebsiteBlock) => void; L: (a: string, e: string) => string; lang: 'ar' | 'en' }> = ({ block, onChange, L, lang }) => {
  switch (block.type) {
    case 'hero': {
      const ctas: WebsiteCta[] = block.ctas || (block.cta ? [{ label: block.cta.label, href: block.cta.href, style: 'primary' }] : []);
      const setCtas = (c: WebsiteCta[]) => onChange({ ...block, ctas: c, cta: undefined });
      return (<div className="space-y-2">
        <Field label={L('العنوان', 'Heading')} value={block.title} onChange={v => onChange({ ...block, title: v })} />
        <Field label={L('العنوان الفرعي', 'Subtitle')} value={block.subtitle || ''} onChange={v => onChange({ ...block, subtitle: v })} />
        <div className="grid grid-cols-2 gap-2">
          <label className="block"><span className="text-[11px] font-bold" style={{ color: 'var(--color-on-surface-variant)' }}>{L('التخطيط', 'Layout')}</span>
            <select value={block.layout || 'center'} onChange={e => onChange({ ...block, layout: e.target.value as any })} style={{ ...inputStyle, marginTop: 4 }}><option value="center">{L('وسط', 'Centered')}</option><option value="left">{L('يسار', 'Left')}</option></select></label>
          <label className="block"><span className="text-[11px] font-bold" style={{ color: 'var(--color-on-surface-variant)' }}>{L('التعتيم', 'Overlay')} {Math.round((block.overlay ?? 0.5) * 100)}%</span>
            <input type="range" min={0} max={0.9} step={0.05} value={block.overlay ?? 0.5} onChange={e => onChange({ ...block, overlay: Number(e.target.value) })} style={{ width: '100%', marginTop: 8 }} /></label>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <MediaField label={L('صورة الخلفية', 'Background image')} value={block.bgImage || ''} kind="image" onChange={u => onChange({ ...block, bgImage: u })} lang={lang} />
          <MediaField label={L('فيديو الخلفية', 'Background video')} value={block.bgVideo || ''} kind="video" onChange={u => onChange({ ...block, bgVideo: u })} lang={lang} />
        </div>
        <span className="text-[11px] font-bold" style={{ color: 'var(--color-on-surface-variant)' }}>{L('أزرار الحث', 'CTA buttons')}</span>
        {ctas.map((c, i) => (
          <div key={i} className="grid grid-cols-[1fr_1fr_auto_auto] gap-2 items-end">
            <Field label={L('نص', 'Label')} value={c.label} onChange={v => setCtas(ctas.map((x, j) => j === i ? { ...x, label: v } : x))} />
            <Field label={L('رابط', 'Href')} value={c.href} onChange={v => setCtas(ctas.map((x, j) => j === i ? { ...x, href: v } : x))} />
            <button onClick={() => setCtas(ctas.map((x, j) => j === i ? { ...x, style: x.style === 'secondary' ? 'primary' : 'secondary' } : x))} className="text-[11px] px-2 py-2 rounded-md cursor-pointer" style={{ background: 'var(--color-surface-container-high)', color: 'var(--color-on-surface)', marginBottom: 2 }}>{c.style || 'primary'}</button>
            <ItemDel onClick={() => setCtas(ctas.filter((_, j) => j !== i))} />
          </div>
        ))}
        <Btn onClick={() => setCtas([...ctas, { label: 'Button', href: '/', style: 'primary' }])}><Plus size={13} />{L('زر', 'Button')}</Btn>
      </div>);
    }
    case 'features': case 'cards': {
      const items = block.items as { title: string; body: string; image?: string; href?: string }[];
      const setItems = (it: any[]) => onChange({ ...block, items: it } as any);
      return (<div className="space-y-2">
        <Field label={L('العنوان', 'Heading')} value={block.heading || ''} onChange={v => onChange({ ...block, heading: v } as any)} />
        {items.map((it, i) => (
          <div key={i} style={{ ...card, padding: 10 }} className="space-y-1.5">
            <div className="grid grid-cols-[1fr_auto] gap-2 items-end"><Field label={L('العنوان', 'Title')} value={it.title} onChange={v => setItems(items.map((x, j) => j === i ? { ...x, title: v } : x))} /><ItemDel onClick={() => setItems(items.filter((_, j) => j !== i))} /></div>
            <Field label={L('الوصف', 'Body')} value={it.body} onChange={v => setItems(items.map((x, j) => j === i ? { ...x, body: v } : x))} />
            {block.type === 'cards' && <div className="grid grid-cols-2 gap-2"><MediaField label={L('صورة', 'Image')} value={it.image || ''} onChange={u => setItems(items.map((x, j) => j === i ? { ...x, image: u } : x))} lang={lang} /><Field label={L('رابط', 'Link')} value={it.href || ''} onChange={v => setItems(items.map((x, j) => j === i ? { ...x, href: v } : x))} /></div>}
          </div>
        ))}
        <Btn onClick={() => setItems([...items, { title: 'Item', body: 'Description' }])}><Plus size={13} />{L('عنصر', 'Item')}</Btn>
      </div>);
    }
    case 'stats': return (<div className="space-y-2">
      <Field label={L('العنوان', 'Heading')} value={block.heading || ''} onChange={v => onChange({ ...block, heading: v })} />
      {block.items.map((it, i) => (
        <div key={i} className="grid grid-cols-[1fr_1fr_auto] gap-2 items-end">
          <Field label={L('القيمة', 'Value')} value={it.value} onChange={v => onChange({ ...block, items: block.items.map((x, j) => j === i ? { ...x, value: v } : x) })} />
          <Field label={L('التسمية', 'Label')} value={it.label} onChange={v => onChange({ ...block, items: block.items.map((x, j) => j === i ? { ...x, label: v } : x) })} />
          <ItemDel onClick={() => onChange({ ...block, items: block.items.filter((_, j) => j !== i) })} />
        </div>
      ))}
      <Btn onClick={() => onChange({ ...block, items: [...block.items, { value: '100+', label: 'Metric' }] })}><Plus size={13} />{L('إحصائية', 'Stat')}</Btn>
    </div>);
    case 'testimonials': return (<div className="space-y-2">
      <Field label={L('العنوان', 'Heading')} value={block.heading || ''} onChange={v => onChange({ ...block, heading: v })} />
      {block.items.map((it, i) => (
        <div key={i} style={{ ...card, padding: 10 }} className="space-y-1.5">
          <div className="grid grid-cols-[1fr_auto] gap-2 items-end"><Field label={L('اقتباس', 'Quote')} value={it.quote} onChange={v => onChange({ ...block, items: block.items.map((x, j) => j === i ? { ...x, quote: v } : x) })} textarea /><ItemDel onClick={() => onChange({ ...block, items: block.items.filter((_, j) => j !== i) })} /></div>
          <div className="grid grid-cols-2 gap-2"><Field label={L('الاسم', 'Author')} value={it.author} onChange={v => onChange({ ...block, items: block.items.map((x, j) => j === i ? { ...x, author: v } : x) })} /><Field label={L('الصفة', 'Role')} value={it.role || ''} onChange={v => onChange({ ...block, items: block.items.map((x, j) => j === i ? { ...x, role: v } : x) })} /></div>
          <MediaField label={L('الصورة الرمزية', 'Avatar')} value={it.avatar || ''} onChange={u => onChange({ ...block, items: block.items.map((x, j) => j === i ? { ...x, avatar: u } : x) })} lang={lang} />
        </div>
      ))}
      <Btn onClick={() => onChange({ ...block, items: [...block.items, { quote: 'Great!', author: 'Name', role: '' }] })}><Plus size={13} />{L('شهادة', 'Testimonial')}</Btn>
    </div>);
    case 'partners': return (<div className="space-y-2">
      <Field label={L('العنوان', 'Heading')} value={block.heading || ''} onChange={v => onChange({ ...block, heading: v })} />
      <MediaListField label={L('الشعارات', 'Logos')} values={block.logos} onChange={v => onChange({ ...block, logos: v })} lang={lang} />
    </div>);
    case 'gallery': return (<div className="space-y-2">
      <Field label={L('العنوان', 'Heading')} value={block.heading || ''} onChange={v => onChange({ ...block, heading: v })} />
      <MediaListField label={L('الصور', 'Images')} values={block.images} onChange={v => onChange({ ...block, images: v })} lang={lang} />
    </div>);
    case 'app_download': return (<div className="space-y-2">
      <Field label={L('العنوان', 'Heading')} value={block.heading} onChange={v => onChange({ ...block, heading: v })} />
      <Field label={L('العنوان الفرعي', 'Subtitle')} value={block.subtitle || ''} onChange={v => onChange({ ...block, subtitle: v })} />
      <div className="grid grid-cols-2 gap-2"><Field label="iOS URL" value={block.iosUrl || ''} onChange={v => onChange({ ...block, iosUrl: v })} /><Field label="Android URL" value={block.androidUrl || ''} onChange={v => onChange({ ...block, androidUrl: v })} /></div>
      <MediaField label={L('صورة', 'Image')} value={block.image || ''} onChange={u => onChange({ ...block, image: u })} lang={lang} />
    </div>);
    case 'faq': return (<div className="space-y-2">
      <Field label={L('العنوان', 'Heading')} value={block.heading || ''} onChange={v => onChange({ ...block, heading: v })} />
      {block.items.map((it, i) => (
        <div key={i} className="grid grid-cols-[1fr_1fr_auto] gap-2 items-end">
          <Field label={L('سؤال', 'Question')} value={it.q} onChange={v => onChange({ ...block, items: block.items.map((x, j) => j === i ? { ...x, q: v } : x) })} />
          <Field label={L('إجابة', 'Answer')} value={it.a} onChange={v => onChange({ ...block, items: block.items.map((x, j) => j === i ? { ...x, a: v } : x) })} />
          <ItemDel onClick={() => onChange({ ...block, items: block.items.filter((_, j) => j !== i) })} />
        </div>
      ))}
      <Btn onClick={() => onChange({ ...block, items: [...block.items, { q: 'Question?', a: 'Answer.' }] })}><Plus size={13} />{L('سؤال', 'Q&A')}</Btn>
    </div>);
    case 'contact': return (<div className="space-y-2">
      <Field label={L('العنوان', 'Heading')} value={block.heading || ''} onChange={v => onChange({ ...block, heading: v })} />
      <Field label="Email" value={block.email || ''} onChange={v => onChange({ ...block, email: v })} />
      <Field label={L('الهاتف', 'Phone')} value={block.phone || ''} onChange={v => onChange({ ...block, phone: v })} />
      <Field label={L('العنوان البريدي', 'Address')} value={block.address || ''} onChange={v => onChange({ ...block, address: v })} />
    </div>);
    case 'cta': return (<div className="space-y-2">
      <Field label={L('العنوان', 'Title')} value={block.title} onChange={v => onChange({ ...block, title: v })} />
      <Field label={L('العنوان الفرعي', 'Subtitle')} value={block.subtitle || ''} onChange={v => onChange({ ...block, subtitle: v })} />
      <div className="grid grid-cols-2 gap-2"><Field label={L('زر: نص', 'Button label')} value={block.button.label} onChange={v => onChange({ ...block, button: { ...block.button, label: v } })} /><Field label={L('زر: رابط', 'Button href')} value={block.button.href} onChange={v => onChange({ ...block, button: { ...block.button, href: v } })} /></div>
    </div>);
    case 'richtext': return (<div className="space-y-2">
      <Field label={L('العنوان', 'Heading')} value={block.heading || ''} onChange={v => onChange({ ...block, heading: v })} />
      <Field label={L('النص', 'Body')} value={block.body} onChange={v => onChange({ ...block, body: v })} textarea />
    </div>);
    default: return null;
  }
};

const thumb: React.CSSProperties = { width: 44, height: 44, borderRadius: 8, background: 'var(--color-surface-container-high)', border: '1px solid var(--color-outline-variant)', display: 'inline-block', fontSize: 14, textAlign: 'center', lineHeight: '44px' };
