// ─────────────────────────────────────────────────────────────────────────────
// AI Design Intelligence & Autonomous Optimization (Phase G2.2).
//
// Evolves the AI layer from "prompt → generate" into "analyze → understand → decide → improve →
// explain". Deterministic (NO external AI). It REUSES the existing analysers (aiEngine: a11y /
// performance / refactor) and adds Design / UX / Responsive / SEO intelligence, a 7-axis scoring
// engine, a one-click improvement plan (fixes applied through the EXISTING BuilderStore API, so
// every change is undoable), reasoned explanations (WHY / WHAT / IMPACT / TRADEOFF), and a learning
// layer that derives project preferences to keep suggestions consistent.
// ─────────────────────────────────────────────────────────────────────────────
import type { BuilderStore } from '../BuilderStore';
import { getComponent } from '../registry';
import type { BuilderNode } from '../types';
import { analyzeAccessibility as a11ySuggestions, applyAccessibilityFixes, analyzePerformance as perfSuggestions, analyzeRefactor } from './aiEngine';

export type Area = 'design' | 'ux' | 'accessibility' | 'seo' | 'performance' | 'responsiveness' | 'maintainability';

export interface Finding {
  area: Area;
  severity: 'info' | 'warn' | 'error';
  title: string;
  why: string;      // WHY it matters
  what: string;     // WHAT to change
  impact: string;   // EXPECTED IMPACT
  tradeoff: string; // TRADEOFFS
  nodeId?: string;
  fix?: (store: BuilderStore) => void; // undoable auto-fix (via store public API)
}

export interface Scores {
  design: number; ux: number; accessibility: number; seo: number;
  performance: number; maintainability: number; responsiveness: number; overall: number;
}

// ── collectors ──
function nodes(store: BuilderStore): BuilderNode[] {
  const out: BuilderNode[] = [];
  const walk = (n: BuilderNode) => { if (n.id !== 'root') out.push(n); n.children.forEach(walk); };
  walk(store.getRoot());
  return out;
}
const mode = (xs: string[]): string => { const m: Record<string, number> = {}; let best = xs[0] || '', bc = 0; for (const x of xs) { m[x] = (m[x] || 0) + 1; if (m[x] > bc) { bc = m[x]; best = x; } } return best; };

// ═══ PART 10 · Learning layer (deterministic — derive project preferences) ══════
export function learnPreferences(store: BuilderStore): Record<string, string> {
  const ns = nodes(store);
  const gaps = ns.map(n => n.props.gap).filter(Boolean).map(String);
  const pads = ns.map(n => n.props.pad).filter(Boolean).map(String);
  const prefs: Record<string, string> = {
    spacing: mode([...gaps, ...pads]) || 'space.4',
    primaryColor: store.getTheme()['--color-primary-fixed'] || '#a3f95b',
    layout: mode(ns.filter(n => getComponent(n.specId)?.container).map(n => n.specId)) || 'section',
    heading: mode(ns.filter(n => n.specId === 'heading').map(n => String(n.props.level || 'h2'))) || 'h2',
    density: String(Math.round(ns.length / Math.max(1, ns.filter(n => getComponent(n.specId)?.container).length))),
  };
  store.setPreferences(prefs);
  return prefs;
}

// ═══ PART 1 · Design Intelligence ════════════════════════════════════════════════
function analyzeDesign(store: BuilderStore, prefs: Record<string, string>): Finding[] {
  const out: Finding[] = [];
  const ns = nodes(store);
  const root = store.getRoot();
  // Spacing consistency (vs the learned preference)
  const spacingTokens = [...new Set(ns.map(n => n.props.gap ?? n.props.pad).filter(Boolean).map(String))];
  if (spacingTokens.length > 2) out.push({ area: 'design', severity: 'warn', title: 'Inconsistent spacing scale', why: `${spacingTokens.length} different spacing tokens are in use — inconsistent rhythm reads as unpolished.`, what: `Normalise gap/padding to your preferred token "${prefs.spacing}".`, impact: 'Consistent vertical rhythm and visual balance across sections.', tradeoff: 'Some sections become slightly tighter/looser than hand-tuned values.', fix: (s) => { for (const n of nodes(s)) { if (n.props.gap != null) s.setProp(n.id, 'gap', prefs.spacing); if (n.props.pad != null) s.setProp(n.id, 'pad', prefs.spacing); } } });
  // CTA hierarchy
  const buttons = ns.filter(n => n.specId === 'button');
  if (buttons.length > 3) out.push({ area: 'design', severity: 'warn', title: 'Too many primary CTAs', why: `${buttons.length} buttons compete for attention; a page should have one clear primary action.`, what: 'Keep one primary CTA per section; demote the rest.', impact: 'Clearer CTA hierarchy → higher conversion on the primary action.', tradeoff: 'Secondary actions become less prominent.' });
  // Section ordering (navbar first, footer last)
  const kids = root.children;
  const navIdx = kids.findIndex(k => k.specId === 'navbar');
  const footIdx = kids.findIndex(k => k.specId === 'footer');
  if (navIdx > 0) out.push({ area: 'design', severity: 'warn', title: 'Navbar is not first', why: 'Navigation should be the first element for predictable information architecture.', what: 'Move the navbar to the top of the page.', impact: 'Clearer navigation and expected reading order.', tradeoff: 'None.', nodeId: kids[navIdx].id, fix: (s) => { for (let i = 0; i < navIdx; i++) s.reorder(kids[navIdx].id, -1); } });
  if (footIdx >= 0 && footIdx < kids.length - 1) out.push({ area: 'design', severity: 'info', title: 'Footer is not last', why: 'The footer conventionally closes the page.', what: 'Move the footer to the end.', impact: 'Conventional layout; less user confusion.', tradeoff: 'None.', nodeId: kids[footIdx].id, fix: (s) => { const n = kids.length - 1 - footIdx; for (let i = 0; i < n; i++) s.reorder(kids[footIdx].id, 1); } });
  // Density
  for (const n of ns) if (n.children.length > 10) out.push({ area: 'design', severity: 'info', title: `Dense ${n.specId}`, why: `${n.children.length} direct children crowd the layout and reduce white space.`, what: 'Split into multiple sections or a paginated list.', impact: 'More breathing room; easier scanning.', tradeoff: 'More scrolling.', nodeId: n.id });
  // Grid consistency
  const gridCols = [...new Set(ns.filter(n => n.specId === 'grid').map(n => String(n.props.cols)))];
  if (gridCols.length > 2) out.push({ area: 'design', severity: 'info', title: 'Inconsistent grid columns', why: 'Mixed column counts break the underlying grid system.', what: 'Standardise on 2–3 grid column counts.', impact: 'A coherent modular grid.', tradeoff: 'Less per-section flexibility.' });
  return out;
}

// ═══ PART 2 · UX Intelligence ════════════════════════════════════════════════════
function analyzeUX(store: BuilderStore): Finding[] {
  const out: Finding[] = [];
  const ns = nodes(store);
  const has = (spec: string) => ns.some(n => n.specId === spec);
  const commerce = has('productcard') || has('pricetag');
  if (commerce && !has('form')) out.push({ area: 'ux', severity: 'warn', title: 'No checkout flow', why: 'A commerce page without a checkout/registration form has no conversion path.', what: 'Add a checkout form (address, payment, place order).', impact: 'A complete purchase funnel → measurable conversion.', tradeoff: 'More screens to maintain.' });
  if (ns.length > 15 && !has('search')) out.push({ area: 'ux', severity: 'info', title: 'No search', why: 'Content-heavy pages need search for findability.', what: 'Add a search component near the top.', impact: 'Faster task completion; lower bounce.', tradeoff: 'Requires a query binding.' });
  for (const n of ns) if (n.specId === 'form' && n.children.length > 6) out.push({ area: 'ux', severity: 'warn', title: 'Long form (friction)', why: `${n.children.length} fields increase abandonment.`, what: 'Reduce to essential fields or split into steps.', impact: 'Higher form completion rate.', tradeoff: 'Collects less data up-front.', nodeId: n.id });
  const hasHero = has('hero'); const hasCTA = has('button') || has('cta') || has('fab');
  if (hasHero && !hasCTA) out.push({ area: 'ux', severity: 'warn', title: 'Hero without a CTA', why: 'A hero should drive the user toward a next action.', what: 'Add a primary CTA button to the hero/section.', impact: 'A clear conversion path from the top of the page.', tradeoff: 'None.' });
  return out;
}

// ═══ PART 3 · Responsive Intelligence (detect + auto-fix) ═════════════════════════
function analyzeResponsive(store: BuilderStore): Finding[] {
  const out: Finding[] = [];
  for (const n of nodes(store)) {
    if (n.specId === 'grid' && Number(n.props.cols) > 2 && !(n.responsive?.phone?.cols)) out.push({ area: 'responsiveness', severity: 'warn', title: `Grid too wide on mobile`, why: `${n.props.cols} columns are cramped on phones and overflow.`, what: `Add a phone override to ${Number(n.props.cols) > 3 ? 2 : 1} column(s).`, impact: 'No horizontal overflow; readable mobile layout.', tradeoff: 'Taller mobile page.', nodeId: n.id, fix: (s) => s.setResponsive(n.id, 'phone', 'cols', Number(n.props.cols) > 3 ? 2 : 1) });
    if (n.specId === 'flex' && n.props.dir === 'row' && n.children.length > 3 && !(n.responsive?.phone?.dir)) out.push({ area: 'responsiveness', severity: 'info', title: 'Row may overflow on mobile', why: 'A wide row with many children overflows narrow screens.', what: 'Stack to a column on phone.', impact: 'No overflow on mobile.', tradeoff: 'Taller mobile layout.', nodeId: n.id, fix: (s) => s.setResponsive(n.id, 'phone', 'dir', 'column') });
  }
  return out;
}

// ═══ PART 5 · SEO Intelligence ═══════════════════════════════════════════════════
function analyzeSEO(store: BuilderStore): Finding[] {
  const out: Finding[] = [];
  const ns = nodes(store);
  const headings = ns.filter(n => n.specId === 'heading');
  if (!headings.some(h => h.props.level === 'h1')) out.push({ area: 'seo', severity: 'warn', title: 'No H1 heading', why: 'Search engines use the H1 as the page’s primary topic.', what: 'Promote the top heading to H1.', impact: 'Better keyword relevance and ranking.', tradeoff: 'None.', fix: headings[0] ? (s) => s.setProp(headings[0].id, 'level', 'h1') : undefined, nodeId: headings[0]?.id });
  if (!ns.some(n => n.specId === 'navbar')) out.push({ area: 'seo', severity: 'info', title: 'No navigation for internal linking', why: 'Internal links spread link equity and help crawling.', what: 'Add a navbar with internal links.', impact: 'Better crawlability and internal linking.', tradeoff: 'None.' });
  const images = ns.filter(n => ['image', 'gallery', 'productcard'].includes(n.specId));
  if (images.length > 0) out.push({ area: 'seo', severity: 'info', title: 'Images need descriptive alt text', why: `${images.length} image(s) — alt text drives image SEO and accessibility.`, what: 'Add descriptive alt text to images.', impact: 'Image search visibility + screen-reader support.', tradeoff: 'Authoring effort.' });
  if (!ns.some(n => n.specId === 'footer')) out.push({ area: 'seo', severity: 'info', title: 'No semantic footer', why: 'A footer provides semantic structure and secondary links.', what: 'Add a footer.', impact: 'Better semantic HTML.', tradeoff: 'None.' });
  return out;
}

// ── map reused aiEngine suggestions → reasoned Findings ──
function mapReused(store: BuilderStore): Finding[] {
  const out: Finding[] = [];
  for (const s of a11ySuggestions(store)) out.push({ area: 'accessibility', severity: 'warn', title: s.message, why: 'Assistive tech needs an accessible name to announce the element.', what: 'Add an aria-label.', impact: 'Screen-reader users can operate the element.', tradeoff: 'None.', nodeId: s.nodeId, fix: (st) => applyAccessibilityFixes(st) });
  for (const s of perfSuggestions(store)) out.push({ area: 'performance', severity: s.severity, title: s.message, why: 'Large/heavy structures increase render time and memory.', what: s.kind === 'virtualize' ? 'Virtualise/lazy-load the list.' : s.kind === 'query-opt' ? 'Add pagination + an index.' : 'Split/memoise heavy work.', impact: 'Faster renders and lower memory.', tradeoff: 'Slightly more complex code.', nodeId: s.nodeId });
  for (const s of analyzeRefactor(store)) if (['duplicate', 'dead-node', 'large-tree', 'deep-tree', 'complex-workflow'].includes(s.kind)) out.push({ area: 'maintainability', severity: s.severity, title: s.message, why: 'Duplication / dead nodes / oversized trees are harder to maintain.', what: s.kind === 'duplicate' ? 'Extract a reusable component.' : 'Remove or split.', impact: 'Simpler, more maintainable project.', tradeoff: 'Refactor effort.', nodeId: s.nodeId });
  return out;
}

// ═══ Aggregate + scoring (PART 7) ════════════════════════════════════════════════
export function allFindings(store: BuilderStore): Finding[] {
  const prefs = store.getPreferences();
  const p = Object.keys(prefs).length ? prefs : learnPreferences(store);
  return [...analyzeDesign(store, p), ...analyzeUX(store), ...analyzeResponsive(store), ...analyzeSEO(store), ...mapReused(store)];
}

const PENALTY = { error: 22, warn: 11, info: 4 } as const;
function areaScore(findings: Finding[], area: Area): number {
  const pen = findings.filter(f => f.area === area).reduce((s, f) => s + PENALTY[f.severity], 0);
  return Math.max(0, Math.min(100, 100 - pen));
}

export function score(store: BuilderStore): Scores {
  const f = allFindings(store);
  const design = areaScore(f, 'design'), ux = areaScore(f, 'ux'), accessibility = areaScore(f, 'accessibility'),
    seo = areaScore(f, 'seo'), performance = areaScore(f, 'performance'), maintainability = areaScore(f, 'maintainability'),
    responsiveness = areaScore(f, 'responsiveness');
  const overall = Math.round(design * 0.2 + ux * 0.2 + accessibility * 0.15 + performance * 0.15 + seo * 0.1 + responsiveness * 0.1 + maintainability * 0.1);
  return { design, ux, accessibility, seo, performance, maintainability, responsiveness, overall };
}

// ═══ One-click improvement (PART 8) ══════════════════════════════════════════════
export function improvementPlan(store: BuilderStore): Finding[] { return allFindings(store).filter(f => f.fix); }

export function applyImprovements(store: BuilderStore): number {
  const plan = improvementPlan(store);
  for (const f of plan) f.fix!(store); // each fix uses the store public API → undoable
  store.logAI('optimize', `applied ${plan.length} improvements`);
  return plan.length;
}
