// ─────────────────────────────────────────────────────────────────────────────
// AI Engine (Phase G2.1) — an intelligent layer ABOVE the Studio.
//
// Deterministic, self-contained (NO external AI dependency). It interprets a natural-language
// prompt into intent, then GENERATES by calling the EXISTING BuilderStore public API (insert/
// setProp for layout, addVariable/setBinding/addAction for logic, addEntity/addField/addRelation/
// generateSeed for data, setTheme for themes). Because every artifact is produced through the same
// store, it is automatically undoable / draftable / publishable — no parallel builder/runtime/
// component/logic/data platform. Also provides refactor / accessibility / performance analysers
// and code explanations over the existing model.
// ─────────────────────────────────────────────────────────────────────────────
import type { BuilderStore } from '../BuilderStore';
import { getComponent } from '../registry';
import type { BuilderNode } from '../types';
import type { FieldType } from '../data/dataModel';

// ── a tree descriptor built from EXISTING component specs ──
interface Tree { spec: string; props?: Record<string, unknown>; children?: Tree[]; }

function insertTree(store: BuilderStore, t: Tree, parentId: string): number {
  const id = store.insert(t.spec, parentId);
  if (!id) return 0;
  let n = 1;
  if (t.props) for (const [k, v] of Object.entries(t.props)) store.setProp(id, k, v);
  if (t.children && getComponent(t.spec)?.container) for (const c of t.children) n += insertTree(store, c, id);
  return n;
}

// ═══ PART 1+2 · Prompt / Layout generator ═══════════════════════════════════════
const heading = (text: string): Tree => ({ spec: 'heading', props: { text, level: 'h2' } });
const cardGrid = (cols: number, spec: string, n: number): Tree => ({ spec: 'grid', props: { cols }, children: Array.from({ length: n }, () => ({ spec })) });

const LAYOUTS: Record<string, () => Tree[]> = {
  restaurant: () => [
    { spec: 'navbar', props: { brand: 'HAAT', links: 'Home,Menu,Offers,Contact' } },
    { spec: 'hero', props: { title: 'Delicious food, delivered', subtitle: 'Order from top restaurants near you.', cta: 'Order now' } },
    { spec: 'section', children: [heading('Popular categories'), cardGrid(4, 'card', 4)] },
    { spec: 'section', children: [heading('Featured restaurants'), cardGrid(3, 'productcard', 3)] },
    { spec: 'footer', props: { text: '© HAAT NOW' } },
  ],
  landing: () => [
    { spec: 'navbar', props: { brand: 'HAAT', links: 'Product,Pricing,About' } },
    { spec: 'hero', props: { title: 'Everything, delivered', subtitle: 'Food, groceries & more — one app.', cta: 'Get started' } },
    { spec: 'section', children: [heading('Why HAAT'), { spec: 'featuregrid', props: { cols: 3 } }] },
    { spec: 'section', children: [{ spec: 'statistics' }] },
    { spec: 'section', children: [{ spec: 'testimonials' }] },
    { spec: 'section', children: [{ spec: 'cta', props: { title: 'Ready to order?', button: 'Download app' } }] },
    { spec: 'footer', props: { text: '© HAAT NOW' } },
  ],
  product: () => [
    { spec: 'navbar', props: { brand: 'HAAT' } },
    { spec: 'section', children: [{ spec: 'flex', props: { gap: 'space.5' }, children: [{ spec: 'image' }, { spec: 'stack', children: [heading('Product name'), { spec: 'pricetag' }, { spec: 'rating', props: { value: 5 } }, { spec: 'button', props: { label: 'Add to cart' } }] }] }] },
    { spec: 'footer' },
  ],
  cart: () => [
    { spec: 'navbar', props: { brand: 'Cart' } },
    { spec: 'section', children: [heading('Your cart'), cardGrid(1, 'productcard', 3), { spec: 'divider' }, { spec: 'flex', props: { justify: 'space-between' }, children: [{ spec: 'heading', props: { text: 'Total', level: 'h3' } }, { spec: 'pricetag' }] }, { spec: 'button', props: { label: 'Checkout' } }] },
  ],
  checkout: () => [
    { spec: 'navbar', props: { brand: 'Checkout' } },
    { spec: 'section', children: [heading('Delivery details'), { spec: 'form', children: [{ spec: 'input', props: { label: 'Full name' } }, { spec: 'phone' }, { spec: 'input', props: { label: 'Address' } }, { spec: 'select', props: { label: 'Payment', options: 'Card,Cash,Wallet' } }, { spec: 'button', props: { label: 'Place order' } }] }] },
  ],
  dashboard: () => [
    { spec: 'navbar', props: { brand: 'Dashboard' } },
    { spec: 'section', children: [{ spec: 'kpirow' }] },
    { spec: 'section', children: [{ spec: 'grid', props: { cols: 2 }, children: [{ spec: 'barchart' }, { spec: 'linechart' }] }] },
    { spec: 'section', children: [heading('Recent activity'), { spec: 'activity' }] },
  ],
  profile: () => [
    { spec: 'navbar', props: { brand: 'Profile' } },
    { spec: 'section', children: [{ spec: 'flex', props: { gap: 'space.4' }, children: [{ spec: 'avatar', props: { size: 72 } }, { spec: 'stack', children: [heading('Sara'), { spec: 'chip', props: { text: 'Customer' } }] }] }, { spec: 'divider' }, { spec: 'accordion', props: { items: 'Personal info,Addresses,Payment methods,Notifications' } }] },
  ],
  settings: () => [
    { spec: 'navbar', props: { brand: 'Settings' } },
    { spec: 'section', children: [heading('Preferences'), { spec: 'stack', children: [{ spec: 'switch', props: { label: 'Dark mode', on: true } }, { spec: 'switch', props: { label: 'Notifications', on: true } }, { spec: 'select', props: { label: 'Language', options: 'English,العربية' } }] }] },
  ],
  wallet: () => [
    { spec: 'navbar', props: { brand: 'Wallet' } },
    { spec: 'section', children: [{ spec: 'statcard', props: { label: 'Balance', value: 'SAR 240', delta: '+SAR 50' } }, { spec: 'button', props: { label: 'Top up' } }] },
    { spec: 'section', children: [heading('Transactions'), { spec: 'activity', props: { items: 'Order #1042 -SAR 84,Top-up +SAR 100,Refund +SAR 22' } }] },
  ],
  orders: () => [
    { spec: 'navbar', props: { brand: 'Orders' } },
    { spec: 'section', children: [{ spec: 'tabs', props: { tabs: 'Active,Past,Cancelled' } }, cardGrid(1, 'productcard', 4)] },
  ],
  offers: () => [
    { spec: 'navbar', props: { brand: 'Offers' } },
    { spec: 'section', children: [{ spec: 'banner', props: { text: 'Free delivery this week!' } }, cardGrid(2, 'card', 4)] },
  ],
  notifications: () => [
    { spec: 'navbar', props: { brand: 'Notifications' } },
    { spec: 'section', children: [{ spec: 'stack', children: [{ spec: 'toast', props: { text: 'Your order is on the way', kind: 'info' } }, { spec: 'toast', props: { text: 'Payment received', kind: 'success' } }] }] },
  ],
  support: () => [
    { spec: 'navbar', props: { brand: 'Support' } },
    { spec: 'section', children: [heading('How can we help?'), { spec: 'search', props: { placeholder: 'Search help articles…' } }, { spec: 'faq', props: { items: 'How to order?,Delivery time?,Refunds?,Contact support?' } }] },
  ],
};

export function detectPage(prompt: string): keyof typeof LAYOUTS {
  const p = prompt.toLowerCase();
  for (const key of ['checkout', 'cart', 'dashboard', 'product', 'profile', 'settings', 'wallet', 'orders', 'offers', 'notifications', 'support', 'landing'] as const) if (p.includes(key)) return key;
  return 'restaurant';
}

export function generateLayout(store: BuilderStore, prompt: string): { page: string; nodes: number } {
  const page = detectPage(prompt);
  let nodes = 0;
  for (const t of LAYOUTS[page]()) nodes += insertTree(store, t, 'root');
  store.logAI('layout', `${page} · ${nodes} nodes`);
  return { page, nodes };
}

// ═══ PART 4 · Theme generator ════════════════════════════════════════════════════
const THEMES: Record<string, { name: string; vars: Record<string, string> }> = {
  premium: { name: 'Premium Gold', vars: { '--color-primary-fixed': '#d4af37', '--color-on-primary-fixed': '#0a0a0a', '--color-background': '#0a0a0a', '--color-surface-container': '#141414', '--color-surface-container-high': '#1e1e1e', '--color-on-surface': '#f3edd8', '--color-on-surface-variant': '#a99e7e', '--color-outline-variant': '#3a3020' } },
  luxury: { name: 'Luxury Black', vars: { '--color-primary-fixed': '#c0a062', '--color-on-primary-fixed': '#0a0a0a', '--color-background': '#000000', '--color-surface-container': '#0f0f0f', '--color-surface-container-high': '#191919', '--color-on-surface': '#eaeaea', '--color-on-surface-variant': '#9a9a9a', '--color-outline-variant': '#2a2a2a' } },
  dark: { name: 'Dark', vars: { '--color-primary-fixed': '#a3f95b', '--color-on-primary-fixed': '#05310f', '--color-background': '#0a0f0c', '--color-surface-container': '#12181410', '--color-surface-container-high': '#161d18', '--color-on-surface': '#e8f0ea', '--color-on-surface-variant': '#9fb0a6', '--color-outline-variant': '#2a322c' } },
  light: { name: 'Light', vars: { '--color-primary-fixed': '#1f8f3a', '--color-on-primary-fixed': '#ffffff', '--color-background': '#f4f6f5', '--color-surface-container': '#ffffff', '--color-surface-container-high': '#eef1ef', '--color-on-surface': '#0f1a14', '--color-on-surface-variant': '#4a5a50', '--color-outline-variant': '#d5ddd8' } },
  vibrant: { name: 'Vibrant Neon', vars: { '--color-primary-fixed': '#00e5ff', '--color-on-primary-fixed': '#00121a', '--color-background': '#05040a', '--color-surface-container': '#0d0b1a', '--color-surface-container-high': '#151228', '--color-on-surface': '#e9e6ff', '--color-on-surface-variant': '#9a95c0', '--color-outline-variant': '#2a2450' } },
  minimal: { name: 'Minimal Mono', vars: { '--color-primary-fixed': '#ffffff', '--color-on-primary-fixed': '#000000', '--color-background': '#111315', '--color-surface-container': '#17191b', '--color-surface-container-high': '#202325', '--color-on-surface': '#f0f0f0', '--color-on-surface-variant': '#9aa0a4', '--color-outline-variant': '#2c3033' } },
  corporate: { name: 'Corporate Blue', vars: { '--color-primary-fixed': '#2f6bff', '--color-on-primary-fixed': '#ffffff', '--color-background': '#070c16', '--color-surface-container': '#0c1320', '--color-surface-container-high': '#131c2e', '--color-on-surface': '#e6ecf7', '--color-on-surface-variant': '#93a2bd', '--color-outline-variant': '#26324a' } },
};
export const THEME_MOODS = Object.keys(THEMES);

export function generateTheme(store: BuilderStore, prompt: string): { name: string } {
  const p = prompt.toLowerCase();
  const mood = THEME_MOODS.find(m => p.includes(m)) || (p.includes('gold') ? 'premium' : p.includes('neon') ? 'vibrant' : p.includes('blue') ? 'corporate' : p.includes('white') ? 'light' : 'dark');
  const theme = THEMES[mood];
  store.setTheme(theme.vars);
  store.logAI('theme', theme.name);
  return { name: theme.name };
}

// ═══ PART 5 · Logic generator ═══════════════════════════════════════════════════
export function generateLogic(store: BuilderStore, prompt: string): { summary: string } {
  const p = prompt.toLowerCase();
  const parts: string[] = [];
  if (/cart|counter|count/.test(p)) { store.addVariable({ name: 'cartCount', scope: 'global', type: 'number', value: 0 }); const sel = store.getSelected(); if (sel) store.addAction(sel.id, { event: 'click', type: 'setVariable', params: { name: 'cartCount', expr: 'var.cartCount + 1' } }); parts.push('variable cartCount + increment action'); }
  if (/login|auth|sign/.test(p)) { store.addVariable({ name: 'loggedIn', scope: 'session', type: 'boolean', value: false }); const sel = store.getSelected(); if (sel) store.setConditions(sel.id, [{ target: 'visible', expr: 'var.loggedIn == true' }]); parts.push('variable loggedIn + visibility condition'); }
  if (/search|query|filter/.test(p)) { store.addVariable({ name: 'query', scope: 'screen', type: 'string', value: '' }); parts.push('variable query'); }
  if (/greet|welcome|name/.test(p)) { store.addVariable({ name: 'userName', scope: 'global', type: 'string', value: 'Sara' }); const sel = store.getSelected(); if (sel) store.setBinding(sel.id, (getComponent(sel.specId)?.props[0]?.key) || 'text', { mode: 'expression', expr: '"Hi " + var.userName' }); parts.push('variable userName + greeting binding'); }
  if (!parts.length) { store.addVariable({ name: 'ready', scope: 'global', type: 'boolean', value: true }); parts.push('variable ready'); }
  store.logAI('logic', parts.join(' · '));
  return { summary: parts.join(' · ') };
}

// ═══ PART 6 · Data generator ════════════════════════════════════════════════════
type ESpec = { name: string; fields: [string, FieldType][] };
const DATA_BLUEPRINTS: Record<string, ESpec[]> = {
  restaurant: [{ name: 'Restaurants', fields: [['name', 'text'], ['rating', 'rating'], ['cuisine', 'enum']] }, { name: 'Dishes', fields: [['name', 'text'], ['price', 'currency'], ['available', 'boolean']] }, { name: 'Orders', fields: [['status', 'enum'], ['total', 'currency']] }],
  pharmacy: [{ name: 'Medicines', fields: [['name', 'text'], ['price', 'currency'], ['prescription', 'boolean']] }, { name: 'Pharmacies', fields: [['name', 'text'], ['open', 'boolean']] }],
  grocery: [{ name: 'Products', fields: [['name', 'text'], ['price', 'currency'], ['stock', 'integer']] }, { name: 'Categories', fields: [['name', 'text']] }],
  courier: [{ name: 'Shipments', fields: [['status', 'enum'], ['weight', 'decimal']] }, { name: 'Couriers', fields: [['name', 'text'], ['online', 'boolean']] }],
  marketplace: [{ name: 'Sellers', fields: [['name', 'text'], ['rating', 'rating']] }, { name: 'Listings', fields: [['title', 'text'], ['price', 'currency']] }],
  healthcare: [{ name: 'Doctors', fields: [['name', 'text'], ['specialty', 'enum']] }, { name: 'Appointments', fields: [['date', 'datetime'], ['status', 'enum']] }],
  booking: [{ name: 'Venues', fields: [['name', 'text'], ['capacity', 'integer']] }, { name: 'Reservations', fields: [['date', 'datetime'], ['guests', 'integer']] }],
  education: [{ name: 'Courses', fields: [['title', 'text'], ['price', 'currency']] }, { name: 'Students', fields: [['name', 'text'], ['email', 'email']] }],
};
export const APP_KINDS = Object.keys(DATA_BLUEPRINTS);

export function generateData(store: BuilderStore, promptOrKind: string): { entities: number } {
  const p = promptOrKind.toLowerCase();
  const kind = APP_KINDS.find(k => p.includes(k)) || 'restaurant';
  const specs = DATA_BLUEPRINTS[kind];
  let created = 0;
  const ids: string[] = [];
  for (const spec of specs) {
    const e = store.addEntity(spec.name);
    ids.push(e.id);
    for (const [fname, ftype] of spec.fields) store.addField(e.id, ftype, fname);
    store.generateSeed(e.id, 8);
    created++;
  }
  // wire a simple oneToMany between the first two entities
  if (ids.length >= 2) store.addRelation({ name: `${specs[0].name}_${specs[1].name}`, type: 'oneToMany', from: ids[0], to: ids[1], onDelete: 'cascade', orphanProtection: true });
  store.logAI('data', `${kind}: ${created} entities`);
  return { entities: created };
}

// ═══ PART 7 · App generator ═════════════════════════════════════════════════════
export function generateApp(store: BuilderStore, kind: string): { summary: string } {
  const data = generateData(store, kind);
  const layoutKind = kind === 'restaurant' ? 'restaurant' : 'landing';
  const layout = generateLayout(store, layoutKind);
  const logic = generateLogic(store, 'cart welcome');
  store.logAI('app', `${kind}: ${data.entities} entities + ${layout.nodes} nodes`);
  return { summary: `${kind} app — ${data.entities} entities, ${layout.nodes} nodes, logic: ${logic.summary}` };
}

// ═══ PART 3+8+9+10 · Analysers (refactor / a11y / performance) ═══════════════════
export interface Suggestion { kind: string; severity: 'info' | 'warn'; message: string; nodeId?: string; }

function walk(root: BuilderNode, fn: (n: BuilderNode, depth: number, parent: BuilderNode | null) => void, depth = 0, parent: BuilderNode | null = null) {
  fn(root, depth, parent);
  for (const c of root.children) walk(c, fn, depth + 1, root);
}

export function analyzeRefactor(store: BuilderStore): Suggestion[] {
  const out: Suggestion[] = [];
  const root = store.getRoot();
  let count = 0, maxDepth = 0;
  walk(root, (n, d, parent) => {
    if (n.id !== 'root') count++;
    maxDepth = Math.max(maxDepth, d);
    if (parent) { const sig = (x: BuilderNode) => `${x.specId}:${JSON.stringify(x.props)}`; const dupes = parent.children.filter(c => sig(c) === sig(n)); if (dupes.length > 1 && dupes[0] === n) out.push({ kind: 'duplicate', severity: 'info', message: `${dupes.length}× identical ${n.specId} — extract a reusable component`, nodeId: n.id }); }
    if (n.meta?.hidden) out.push({ kind: 'dead-node', severity: 'info', message: `hidden ${n.specId} node (dead)`, nodeId: n.id });
  });
  if (count > 50) out.push({ kind: 'large-tree', severity: 'warn', message: `large tree (${count} nodes) — split into reusable sections` });
  if (maxDepth > 8) out.push({ kind: 'deep-tree', severity: 'warn', message: `deep nesting (depth ${maxDepth})` });
  // unused variables
  const bindingText = JSON.stringify(store.getRoot()) + JSON.stringify(store.workflows());
  for (const v of store.variables()) if (!new RegExp(`\\bvar\\.${v.name}\\b`).test(bindingText)) out.push({ kind: 'unused-variable', severity: 'info', message: `variable "${v.name}" is never referenced` });
  // unused entities
  for (const e of store.entities()) if (store.records(e.id).length === 0 && !store.relations().some(r => r.from === e.id || r.to === e.id)) out.push({ kind: 'unused-entity', severity: 'info', message: `entity "${e.name}" has no records and no relations` });
  // complex workflows
  for (const w of store.workflows()) if (w.nodes.length > 8) out.push({ kind: 'complex-workflow', severity: 'warn', message: `workflow "${w.name}" has ${w.nodes.length} nodes` });
  return out;
}

export function analyzeAccessibility(store: BuilderStore): Suggestion[] {
  const out: Suggestion[] = [];
  const needsLabel = new Set(['button', 'image', 'form', 'tablist', 'navigation', 'dialog']);
  walk(store.getRoot(), (n) => {
    if (n.id === 'root') return;
    const spec = getComponent(n.specId);
    if (spec && needsLabel.has(spec.a11y.role || '') && !n.a11y?.label) out.push({ kind: 'aria-label', severity: 'warn', message: `${spec.name} needs an aria-label`, nodeId: n.id });
  });
  return out;
}
/** Auto-fix: apply sensible aria-labels to every flagged node. Reversible via undo. */
export function applyAccessibilityFixes(store: BuilderStore): number {
  const fixes = analyzeAccessibility(store);
  for (const s of fixes) if (s.nodeId) { const spec = getComponent(store.find(s.nodeId)?.node.specId || ''); store.setA11y(s.nodeId, { label: spec?.name || 'element' }); }
  store.logAI('a11y-fix', `${fixes.length} labels added`);
  return fixes.length;
}

export function analyzePerformance(store: BuilderStore): Suggestion[] {
  const out: Suggestion[] = [];
  walk(store.getRoot(), (n) => { if (n.children.length > 12) out.push({ kind: 'virtualize', severity: 'warn', message: `${n.specId} has ${n.children.length} children — virtualize / lazy-load the list`, nodeId: n.id }); });
  const bindingCount = JSON.stringify(store.getRoot()).match(/"bindings"/g)?.length || 0;
  if (bindingCount > 20) out.push({ kind: 'memoize', severity: 'info', message: `${bindingCount} bound nodes — memoize heavy bindings` });
  for (const e of store.entities()) { const c = store.records(e.id, { includeArchived: true }).length; if (c > 1000) out.push({ kind: 'query-opt', severity: 'warn', message: `${e.name} has ${c.toLocaleString()} rows — add pagination + an index` }); }
  if (store.count() > 60) out.push({ kind: 'code-split', severity: 'info', message: `large page (${store.count()} nodes) — code-split sections` });
  return out;
}

// ═══ PART 11 · Code explanation ═════════════════════════════════════════════════
const OPS: [RegExp, string][] = [[/&&/g, ' AND '], [/\|\|/g, ' OR '], [/==/g, ' equals '], [/!=/g, ' not equal '], [/>=/g, ' at least '], [/<=/g, ' at most '], [/\+/g, ' plus ']];
export function explainExpression(expr: string): string {
  let s = expr; for (const [re, w] of OPS) s = s.replace(re, w);
  return s.replace(/var\./g, 'variable ').replace(/state\./g, 'state ').replace(/db\./g, 'data ').replace(/\s+/g, ' ').trim();
}
export function explainNode(store: BuilderStore, nodeId: string): string {
  const node = store.find(nodeId)?.node; if (!node) return 'No node selected.';
  const spec = getComponent(node.specId); if (!spec) return 'Unknown component.';
  const lines = [`This is a "${spec.name}" (${spec.category}) — ${spec.description}`];
  if (node.bindings && Object.keys(node.bindings).length) lines.push(`Bindings: ${Object.entries(node.bindings).map(([k, b]) => `${k} ← ${explainExpression(b.expr)}`).join('; ')}`);
  if (node.actions?.length) lines.push(`On click it runs: ${node.actions.map(a => a.type).join(', ')}.`);
  if (node.conditions?.length) lines.push(`Shown only when: ${node.conditions.map(c => explainExpression(c.expr)).join(' and ')}.`);
  if (node.validators?.length) lines.push(`Validation: ${node.validators.map(v => v.kind).join(', ')}.`);
  lines.push(spec.responsive ? 'It is responsive and theme-token driven.' : '');
  return lines.filter(Boolean).join('\n');
}
