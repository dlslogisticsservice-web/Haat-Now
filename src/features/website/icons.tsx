import React from 'react';
import {
  Check, CheckCircle2, Star, Clock, Bike, Banknote, MapPin, Search, Flame, Gift, Bell, ShieldCheck,
  Headphones, Lock, Unlock, CreditCard, Wallet, Receipt, RefreshCw, AlertTriangle, Sparkles, Rocket,
  Map as MapIcon, Rss, Smartphone, HeartHandshake, TrendingUp, BarChart3, Target, ClipboardList, FileText,
  Store, Home, Compass, Salad, Package, Truck, UtensilsCrossed, Coffee, Pizza, ShoppingCart, Pill, CakeSlice,
  Flower2, Soup, Beef, Croissant, CupSoda, Scale, ChefHat, PartyPopper, Boxes, Plug, FlaskConical, KeyRound,
  Leaf, Users, Timer, BadgeCheck, Lightbulb, Building2, BookOpen, Fish, Sandwich, Drumstick, IceCreamCone,
  X, ThumbsUp, Ticket, Heart, type LucideIcon,
} from 'lucide-react';

// ─────────────────────────────────────────────────────────────────────────────
// Website · ONE professional icon system (Lucide). Replaces every emoji across the
// public site with a single, consistent SVG set. Content stores a semantic icon NAME
// (Studio-editable) which this registry resolves — no emoji anywhere. Reused by the
// block renderer, the commerce flow and the site shell.
// ─────────────────────────────────────────────────────────────────────────────

const MAP: Record<string, LucideIcon> = {
  check: Check, checkcircle: CheckCircle2, verified: BadgeCheck, star: Star, clock: Clock, timer: Timer,
  delivery: Bike, truck: Truck, cash: Banknote, pin: MapPin, search: Search, fire: Flame, gift: Gift,
  bell: Bell, shield: ShieldCheck, support: Headphones, lock: Lock, unlock: Unlock, card: CreditCard,
  wallet: Wallet, receipt: Receipt, reorder: RefreshCw, warning: AlertTriangle, sparkles: Sparkles,
  rocket: Rocket, map: MapIcon, signal: Rss, phone: Smartphone, handshake: HeartHandshake, chart: TrendingUp,
  analytics: BarChart3, target: Target, clipboard: ClipboardList, note: FileText, store: Store, home: Home,
  compass: Compass, package: Package, cart: ShoppingCart, pill: Pill, scale: Scale, chef: ChefHat,
  celebrate: PartyPopper, boxes: Boxes, plug: Plug, flask: FlaskConical, key: KeyRound, users: Users,
  idea: Lightbulb, building: Building2, book: BookOpen, thumbsup: ThumbsUp, close: X, ticket: Ticket, heart: Heart,
  // food / category
  utensils: UtensilsCrossed, restaurants: UtensilsCrossed, coffee: Coffee, pizza: Pizza, burger: Sandwich,
  grocery: ShoppingCart, pharmacy: Pill, sweets: CakeSlice, cake: CakeSlice, healthy: Salad, salad: Salad,
  leaf: Leaf, flowers: Flower2, noodles: Soup, grill: Beef, chicken: Drumstick, bakery: Croissant,
  drink: CupSoda, juice: CupSoda, sushi: Fish, icecream: IceCreamCone, parcels: Package,
};

export const WIcon: React.FC<{ name: string; size?: number; color?: string; strokeWidth?: number; style?: React.CSSProperties; className?: string }> = ({ name, size = 20, color = 'currentColor', strokeWidth = 2, style, className }) => {
  const Cmp = MAP[(name || '').toLowerCase()] || UtensilsCrossed;
  return <Cmp size={size} color={color} strokeWidth={strokeWidth} style={style} className={className} aria-hidden="true" />;
};

/** Classify a merchant / dish / category string to a food icon name (Arabic + English). */
export function foodIconName(seed?: string): string {
  const s = (seed || '').toLowerCase();
  if (/coffee|قهو|كافيه|espresso|latte|موكا|شاي|tea|bean|brew/.test(s)) return 'coffee';
  if (/juice|عصير|مشروب|drink|smoothie|lab/.test(s)) return 'juice';
  if (/pizza|بيتزا|napoli/.test(s)) return 'pizza';
  if (/burger|برجر/.test(s)) return 'burger';
  if (/sushi|سوشي|poké|poke|fish|سمك/.test(s)) return 'sushi';
  if (/dessert|sweet|حلو|كيك|cake|bakery|مخبز|بسبوسة|كنافة|ice|بوظة|آيس/.test(s)) return 'sweets';
  if (/croissant|كرواسون|corner bakery|bakery/.test(s)) return 'bakery';
  if (/grill|مشاوي|bbq|كباب|شاورما|shawarma|steak|لحم|beef/.test(s)) return 'grill';
  if (/noodle|نودلز|ramen|باستا|pasta|asian/.test(s)) return 'noodles';
  if (/chicken|دجاج|مندي|كبسة/.test(s)) return 'chicken';
  if (/salad|سلطة|healthy|صحي|green|bowl|فلافل|falafel|vegetarian|نباتي/.test(s)) return 'healthy';
  if (/pharma|صيدل|دواء|wellness|care|health/.test(s)) return 'pharmacy';
  if (/grocer|بقال|market|سوبر|mart|fresh|خضار|greens|convenience/.test(s)) return 'grocery';
  if (/taco|تاكو|mexican|curry|كاري|indian|هندي/.test(s)) return 'utensils';
  return 'utensils';
}

// ── Brand logo — a professional inline SVG wordmark (no external asset needed). ──
// A rounded delivery-mark ("HN" monogram in a rounded-square) + the HAAT NOW wordmark.
// Uses currentColor / the brand primary so it re-skins with the tenant theme.
export const HaatLogo: React.FC<{ height?: number; showWordmark?: boolean; mono?: boolean }> = ({ height = 30, showWordmark = true, mono = false }) => {
  const primary = mono ? 'currentColor' : 'var(--color-primary-fixed, #a3f95b)';
  const onPrimary = mono ? 'var(--color-surface-container, #10160f)' : 'var(--color-on-primary-fixed, #0c2000)';
  const ink = 'currentColor';
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: height * 0.34, height, lineHeight: 1 }} aria-label="HaaT Now">
      <svg width={height} height={height} viewBox="0 0 40 40" fill="none" role="img" aria-hidden="true" style={{ flexShrink: 0 }}>
        <rect x="1.5" y="1.5" width="37" height="37" rx="11" fill={primary} />
        {/* stylised H + motion mark */}
        <path d="M13 11v18M27 11v18M13 20h14" stroke={onPrimary} strokeWidth="3.2" strokeLinecap="round" />
        <circle cx="20" cy="20" r="2.4" fill={onPrimary} />
      </svg>
      {showWordmark && (
        <span style={{ fontWeight: 900, letterSpacing: '-0.02em', fontSize: height * 0.6, color: ink, whiteSpace: 'nowrap' }}>
          HaaT<span style={{ color: primary }}> Now</span>
        </span>
      )}
    </span>
  );
};
