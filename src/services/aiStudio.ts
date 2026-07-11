// ─────────────────────────────────────────────────────────────────────────────
// AI Website Assistant — deterministic content generators & text transforms for the
// Website Studio. These are SMART TEMPLATE / heuristic engines (no external LLM): they
// produce real CMS WebsiteBlock[] and edit existing copy, fully integrated with the
// same content model the Studio and public site use. Every result is Studio-editable.
// ─────────────────────────────────────────────────────────────────────────────
import type { WebsiteBlock, WebsiteSite, BlockStyle } from './website.service';

// Small stable hash so "regenerate" rotates variants deterministically (no Math.random).
function seedFrom(s: string): number { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return Math.abs(h); }

const HERO_VARIANTS: { title: string; subtitle: string; cta: string }[] = [
  { title: 'Your city, delivered', subtitle: 'Restaurants, grocery and pharmacy — one app, live tracking and cash on delivery.', cta: 'Start ordering' },
  { title: 'Everything you need, at your door', subtitle: 'Order from local favourites in a few taps. Pay cash, track every delivery live.', cta: 'Order now' },
  { title: 'Fast local delivery, done right', subtitle: 'Neighbourhood merchants, nearby captains and honest pricing — delivered in minutes.', cta: 'Browse merchants' },
  { title: 'Hungry? It’s on the way', subtitle: 'Food, groceries and pharmacy from stores near you — with real-time tracking end to end.', cta: 'Get started' },
];

export function genHero(site: WebsiteSite, seed = ''): WebsiteBlock {
  const v = HERO_VARIANTS[seedFrom(site.siteName + seed) % HERO_VARIANTS.length];
  return { type: 'hero', layout: 'center', overlay: 0.55, title: v.title, subtitle: v.subtitle, search: true, searchAction: '/app', ctas: [{ label: v.cta, href: '/app', style: 'primary' }] };
}

export function genCTA(site: WebsiteSite): WebsiteBlock {
  return { type: 'cta', title: 'Hungry to get started?', subtitle: `Order now with ${site.siteName}, or join the waitlist for launch updates.`, button: { label: 'Start ordering', href: '/app' } };
}

export function genFAQ(): WebsiteBlock {
  return { type: 'faq', heading: 'Frequently asked questions', items: [
    { q: 'How fast is delivery?', a: 'Most orders arrive within about 30 minutes, depending on distance and store prep time.' },
    { q: 'How do I pay?', a: 'Cash on delivery — no account or card required. Cards and wallet are coming soon.' },
    { q: 'Can I track my order?', a: 'Yes. Follow your order live from the store to your door, in real time.' },
    { q: 'Which areas do you cover?', a: 'We’re launching city by city. Join the waitlist and we’ll notify you when we go live near you.' },
  ] };
}

export function genMarketing(): WebsiteBlock[] {
  return [
    { type: 'deals', heading: 'This week’s offers', subtitle: 'Example deals — real offers activate when we go live', items: [
      { title: '50% off your first order', discount: '50%', code: 'WELCOME50' },
      { title: 'Free delivery weekend', discount: 'Free delivery' },
      { title: 'Buy 1 Get 1 pizza', discount: 'BOGO' },
    ] },
    { type: 'steps', heading: 'How it works', subtitle: 'Three taps to your door', items: [
      { title: 'Browse & choose', body: 'Discover restaurants and stores near you, with clear ETAs and prices.', icon: 'search' },
      { title: 'Order & pay cash', body: 'Check out as a guest and pay cash on delivery — no account needed.', icon: 'cash' },
      { title: 'Track live', body: 'Follow your order in real time, right to your door.', icon: 'pin' },
    ] },
  ];
}

export function genLanding(site: WebsiteSite): WebsiteBlock[] {
  return [
    genHero(site, 'landing'),
    { type: 'features', heading: `Why ${site.siteName}?`, items: [
      { title: 'Everything, one place', body: 'Restaurants, grocery and pharmacy from your neighbourhood — in a single app.', icon: 'cart' },
      { title: 'Fair for everyone', body: 'Honest pricing for customers, fair commissions for merchants, weekly payouts for captains.', icon: 'scale' },
      { title: 'Pay cash, no account', body: 'Order as a guest and pay cash on delivery. Cards and wallet are coming soon.', icon: 'cash' },
    ] },
    ...genMarketing(),
    { type: 'testimonials', heading: 'Loved by our early community', items: [
      { quote: 'Ordering felt effortless and I could watch my delivery the whole way.', author: 'Early tester', role: 'illustrative' },
      { quote: 'Cash on delivery with no account made it so easy to try.', author: 'Beta customer', role: 'illustrative' },
    ] },
    genCTA(site),
  ];
}

export function improveSEO(site: WebsiteSite): { title: string; description: string } {
  return {
    title: `${site.siteName} — Food, grocery & pharmacy delivery`,
    description: `Order food, groceries and pharmacy from top local merchants with ${site.siteName}. Fast delivery, live tracking and cash on delivery.`,
  };
}

// Rewrite: tighten filler, normalise spacing/casing, keep meaning. Deterministic.
const FILLER = /\b(very|really|just|actually|basically|simply|in order to|that is|kind of|sort of|a lot of)\b/gi;
export function tightenText(s: string): string {
  let out = s.replace(FILLER, m => (m.toLowerCase() === 'in order to' ? 'to' : m.toLowerCase() === 'a lot of' ? 'many' : ''));
  out = out.replace(/\s{2,}/g, ' ').replace(/\s+([,.!?])/g, '$1').trim();
  if (out) out = out.charAt(0).toUpperCase() + out.slice(1);
  return out || s;
}

// Readability: split over-long sentences at clause boundaries so lines stay scannable.
export function improveReadability(s: string): string {
  return s.split(/(?<=[.!?])\s+/).map(sentence => {
    if (sentence.length <= 140) return sentence;
    const parts = sentence.split(/,\s+/);
    if (parts.length < 2) return sentence;
    return parts.map((p, i) => (i === 0 ? p : p.charAt(0).toUpperCase() + p.slice(1))).join('. ');
  }).join(' ').replace(/\.\.+/g, '.');
}

export const CONVERSION_STYLE: BlockStyle = { animation: 'rise', shadow: 'md' };
