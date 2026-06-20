# HAAT NOW — Premium Design Spec (for Claude Code / VS Code)

> A complete design reference for the **HAAT NOW** delivery app.
> Copy this file into your existing project and apply the tokens, components, and patterns below.
> Visual identity: **Glossy Black Obsidian × Dark Silver Chrome × Neon Lime** with **strong glassmorphism shine**
> Typography inspiration: same premium Arabic feel as **Beauty Hub Luxury** (Cairo) — kept on HAAT NOW's lime palette.

---

## 1. Brand Identity

| Token             | Value                                  | Usage                          |
| ----------------- | -------------------------------------- | ------------------------------ |
| Background        | `oklch(0.08 0.005 250)` — Glossy Black | App background                 |
| Surface           | `oklch(0.12 0.008 250)`                | Cards, sheets                  |
| Surface-2 / 3     | `0.15 / 0.20 0.012 250`                | Elevated chips, inputs         |
| Card              | `oklch(0.11 0.007 250)`                | Content cards                  |
| Primary (Neon)    | `oklch(0.92 0.22 130)` Lime            | CTA, glow, accents             |
| Primary Glow      | `oklch(0.95 0.24 130)`                 | Hover, gradients               |
| Accent Emerald    | `oklch(0.72 0.16 160)`                 | Secondary accent               |
| Gold              | `oklch(0.83 0.13 85)`                  | Loyalty / premium badges       |
| Chrome            | `oklch(0.85 0.02 250)`                 | Silver highlights, metallic text |
| Silver            | `oklch(0.65 0.02 250)`                 | Secondary metallic accents     |
| Destructive       | `oklch(0.68 0.21 22)`                  | Errors / pharmacy red          |
| Foreground        | `oklch(0.98 0.005 250)`                | Text                           |
| Muted Foreground  | `oklch(0.70 0.015 250)`                | Secondary text                 |
| Border            | `oklch(0.98 0.005 250 / 0.08)`         | Hairlines                      |

### Gradients
```css
--gradient-primary: linear-gradient(135deg, oklch(0.92 0.22 130), oklch(0.82 0.20 145));
--gradient-obsidian: linear-gradient(180deg, oklch(0.06 0.005 250), oklch(0.12 0.008 250));
--gradient-glow: radial-gradient(circle at 50% 0%, oklch(0.92 0.22 130 / 0.18), transparent 60%);
--gradient-chrome: linear-gradient(135deg, oklch(0.45 0.01 250), oklch(0.75 0.02 250), oklch(0.40 0.01 250));
```

### Shadows
```css
--shadow-neon: 0 0 32px oklch(0.92 0.22 130 / 0.35), 0 0 8px oklch(0.92 0.22 130 / 0.5);
--shadow-glass: 0 8px 32px oklch(0 0 0 / 0.5);
--shadow-card: 0 4px 24px oklch(0 0 0 / 0.55), 0 1px 0 oklch(1 0 0 / 0.06) inset;
```

---

## 2. Typography

Load via Google Fonts in the root head:
```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet"
  href="https://fonts.googleapis.com/css2?family=Cairo:wght@300;400;500;600;700;800;900&family=Tajawal:wght@300;400;500;700;800;900&family=Inter:wght@400;500;600;700;800&display=swap">
```

CSS tokens:
```css
--font-display: "Cairo", "Tajawal", "Inter", system-ui, sans-serif;
--font-sans:    "Cairo", "Tajawal", "Inter", system-ui, sans-serif;
```

- Headings: Cairo 700–900, `letter-spacing: -0.02em`
- Body: Cairo 400–500
- Numerals / EN labels: Inter
- RTL: `<html dir="rtl" lang="ar">`

---

## 3. Glossy Black / Dark Silver Background (Final)

This is the signature look of the app. Every page inherits it from the global `body` styles.

```css
:root {
  --background: oklch(0.08 0.005 250);
  --foreground: oklch(0.98 0.005 250);
  --surface: oklch(0.12 0.008 250);
  --surface-2: oklch(0.15 0.010 250);
  --surface-3: oklch(0.20 0.012 250);
  --card: oklch(0.11 0.007 250);
  --chrome: oklch(0.85 0.02 250);
  --silver: oklch(0.65 0.02 250);
}

body {
  background: var(--background);
  color: var(--foreground);
  background-image:
    /* top-left chrome sheen */
    radial-gradient(ellipse 80% 55% at 10% 0%, oklch(0.55 0.01 250 / 0.22), transparent 60%),
    /* top-right subtle silver glow */
    radial-gradient(ellipse 70% 50% at 90% 0%, oklch(0.45 0.01 250 / 0.16), transparent 65%),
    /* bottom silver pool */
    radial-gradient(ellipse 90% 60% at 50% 110%, oklch(0.35 0.01 250 / 0.14), transparent 65%),
    /* central lime halo */
    radial-gradient(ellipse 60% 45% at 50% 25%, oklch(0.92 0.22 130 / 0.08), transparent 70%),
    /* glossy dark silver mesh */
    conic-gradient(from 200deg at 50% 50%,
      oklch(0.08 0.005 250) 0%,
      oklch(0.12 0.008 250) 20%,
      oklch(0.09 0.005 250) 40%,
      oklch(0.14 0.01 250) 60%,
      oklch(0.08 0.005 250) 80%,
      oklch(0.12 0.008 250) 100%);
  background-attachment: fixed;
  background-size: 100% 100%, 100% 100%, 100% 100%, 100% 100%, 200% 200%;
  animation: bg-drift 24s ease-in-out infinite alternate;
  min-height: 100dvh;
}

body::before {
  content: "";
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 0;
  background:
    linear-gradient(110deg, transparent 30%, oklch(0.80 0.01 250 / 0.09) 48%, oklch(0.95 0.01 250 / 0.14) 52%, transparent 70%),
    radial-gradient(circle at 25% 30%, oklch(0.70 0.01 250 / 0.06), transparent 45%);
  mix-blend-mode: screen;
  animation: bg-shine 16s ease-in-out infinite;
}

body::after {
  content: "";
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 0;
  opacity: 0.06;
  background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='220' height='220'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>");
  mix-blend-mode: overlay;
}

#root, main { position: relative; z-index: 1; }

@keyframes bg-drift {
  0%   { background-position: 0% 0%, 0% 0%, 0% 0%, 0% 0%, 0% 0%; }
  100% { background-position: 0% 0%, 0% 0%, 0% 0%, 0% 0%, 100% 100%; }
}

@keyframes bg-shine {
  0%, 100% { transform: translateX(-10%); opacity: 0.7; }
  50%      { transform: translateX(10%);  opacity: 1; }
}
```

> **Rule for every page:** use `bg-background` or let the global `body` background show through. Never set a solid `bg-black`, `bg-white`, or `bg-slate-*` on page containers. This keeps the glossy black/silver finish consistent across all routes.

---

## 4. Strong Glassmorphism Shine (Core Visual)

Replaces the previous faded glass. Apply these utilities everywhere a glass surface is needed (header, cards, category tiles, search bar, badges).

```css
.glass {
  position: relative;
  background:
    linear-gradient(135deg, oklch(1 0 0 / 0.10) 0%, oklch(1 0 0 / 0.02) 40%, oklch(0.92 0.22 130 / 0.06) 100%),
    oklch(0.12 0.008 250 / 0.60);
  backdrop-filter: blur(28px) saturate(180%);
  border: 1px solid oklch(1 0 0 / 0.14);
  box-shadow:
    0 1px 0 oklch(1 0 0 / 0.18) inset,
    0 -1px 0 oklch(1 0 0 / 0.04) inset,
    0 12px 40px oklch(0 0 0 / 0.50);
}
.glass::before {
  content: ""; position: absolute; inset: 0;
  border-radius: inherit; padding: 1px;
  background: linear-gradient(135deg,
    oklch(1 0 0 / 0.35),
    oklch(1 0 0 / 0.02) 40%,
    oklch(0.92 0.22 130 / 0.25));
  -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
  -webkit-mask-composite: xor;
          mask-composite: exclude;
  pointer-events: none;
}

.glass-strong {
  position: relative;
  background:
    linear-gradient(180deg, oklch(1 0 0 / 0.08), oklch(1 0 0 / 0.01)),
    oklch(0.08 0.005 250 / 0.88);
  backdrop-filter: blur(32px) saturate(180%);
  border-bottom: 1px solid oklch(1 0 0 / 0.10);
  box-shadow: 0 1px 0 oklch(1 0 0 / 0.12) inset, 0 8px 32px oklch(0 0 0 / 0.55);
}

/* Moving specular highlight */
.glass-shine { position: relative; overflow: hidden; }
.glass-shine::after {
  content: ""; position: absolute; top: -50%; left: -60%;
  width: 60%; height: 200%;
  background: linear-gradient(115deg, transparent 30%, oklch(1 0 0 / 0.18) 50%, transparent 70%);
  transform: rotate(8deg); pointer-events: none;
  animation: shine 6s ease-in-out infinite;
}
@keyframes shine {
  0%, 60% { transform: translateX(0)    rotate(8deg); opacity: 0; }
  70%     { opacity: 1; }
  100%    { transform: translateX(380%) rotate(8deg); opacity: 0; }
}

.chrome-text {
  background: linear-gradient(135deg, oklch(0.45 0.01 250), oklch(0.75 0.02 250), oklch(0.40 0.01 250));
  -webkit-background-clip: text; background-clip: text; color: transparent;
}
```

Other utilities:
```css
.neon-glow { box-shadow: var(--shadow-neon); }
.neon-ring { box-shadow: 0 0 0 1px oklch(0.92 0.22 130 / 0.4), 0 0 24px oklch(0.92 0.22 130 / 0.25); }
.neon-text { color: var(--primary); text-shadow: 0 0 24px oklch(0.92 0.22 130 / 0.6); }
.gradient-text {
  background: linear-gradient(135deg, var(--foreground), oklch(0.7 0.02 250));
  -webkit-background-clip: text; background-clip: text; color: transparent;
}
```

---

## 5. Category Tiles (replacing emoji icons)

Replace flat emoji circles with **realistic lucide icons inside premium glass cards**, tinted per service, with the moving shine.

### Data
```ts
export const CATEGORIES = [
  { id: "restaurants", label: "المطاعم",       iconKey: "restaurants", tint: "from-primary/30 to-primary/5" },
  { id: "market",      label: "السوبر ماركت",  iconKey: "market",      tint: "from-accent-emerald/30 to-accent-emerald/5" },
  { id: "pharmacy",    label: "الصيدلية",      iconKey: "pharmacy",    tint: "from-destructive/25 to-destructive/5" },
  { id: "coffee",      label: "القهوة",        iconKey: "coffee",      tint: "from-gold/30 to-gold/5" },
  { id: "sweets",      label: "الحلويات",      iconKey: "sweets",      tint: "from-gold/25 to-primary/5" },
  { id: "gifts",       label: "الهدايا",       iconKey: "gifts",       tint: "from-destructive/25 to-gold/5" },
  { id: "flowers",     label: "الزهور",        iconKey: "flowers",     tint: "from-accent-emerald/25 to-primary/5" },
  { id: "electronics", label: "إلكترونيات",    iconKey: "electronics", tint: "from-primary/25 to-accent-emerald/5" },
] as const;
```

### Icon map (lucide-react)
```ts
import { UtensilsCrossed, ShoppingCart, Pill, Coffee, CakeSlice, Gift, Flower2, Smartphone, type LucideIcon } from "lucide-react";

const CATEGORY_ICONS: Record<string, LucideIcon> = {
  restaurants: UtensilsCrossed,
  market: ShoppingCart,
  pharmacy: Pill,
  coffee: Coffee,
  sweets: CakeSlice,
  gifts: Gift,
  flowers: Flower2,
  electronics: Smartphone,
};
```

### JSX
```tsx
<div className="grid grid-cols-4 gap-3">
  {CATEGORIES.map((c) => {
    const Icon = CATEGORY_ICONS[c.iconKey];
    return (
      <button key={c.id} className="flex flex-col items-center gap-2 group">
        <span className={`relative grid place-items-center w-16 h-16 rounded-2xl glass glass-shine bg-gradient-to-br ${c.tint} group-hover:scale-[1.04] transition`}>
          <span className="absolute inset-0 rounded-2xl bg-[radial-gradient(ellipse_at_top,oklch(1_0_0/0.18),transparent_60%)] pointer-events-none" />
          <Icon className="w-7 h-7 text-primary drop-shadow-[0_0_12px_oklch(0.92_0.22_130/0.55)]" strokeWidth={1.75} />
        </span>
        <span className="text-[11px] font-semibold text-foreground/85">{c.label}</span>
      </button>
    );
  })}
</div>
```

---

## 6. Reusable Patterns

### Sticky app header
```tsx
<header className="sticky top-0 z-40 glass-strong">…</header>
```

### Search bar
```tsx
<div className="glass glass-shine rounded-2xl p-2 flex items-center gap-2">
  <div className="grid place-items-center w-12 h-12 rounded-xl bg-primary text-primary-foreground neon-glow">
    <Search className="w-5 h-5" strokeWidth={2.5} />
  </div>
  <input className="flex-1 bg-transparent outline-none text-sm placeholder:text-muted-foreground" />
</div>
```

### Restaurant card
```tsx
<div className="glass rounded-2xl overflow-hidden group-hover:border-primary/30 transition">
  <div className="relative h-40 overflow-hidden">
    <img src={cover} className="w-full h-full object-cover group-hover:scale-105 transition duration-500" />
    <div className="absolute inset-0 bg-gradient-to-t from-background via-background/20 to-transparent" />
    <span className="absolute top-3 right-3 px-3 py-1 rounded-full bg-primary text-primary-foreground text-[10px] font-bold neon-glow">مميز</span>
    <div className="absolute top-3 left-3 glass rounded-full px-2.5 py-1 flex items-center gap-1">
      <Star className="w-3 h-3 fill-primary text-primary" /><span className="text-xs font-bold">4.9</span>
    </div>
  </div>
  …
</div>
```

### Primary CTA
```tsx
<button className="w-full h-14 rounded-2xl bg-primary text-primary-foreground font-bold neon-glow active:scale-[0.98] transition">
  اطلب الآن
</button>
```

### Bottom navigation (glass-strong)
```tsx
<nav className="fixed bottom-0 inset-x-0 z-40 glass-strong">
  <ul className="mx-auto max-w-md flex items-center justify-around h-16">…</ul>
</nav>
```

---

## 7. Motion

```css
@keyframes pulse-glow {
  0%,100% { box-shadow: 0 0 0 0 oklch(0.92 0.22 130 / 0.6), 0 0 24px oklch(0.92 0.22 130 / 0.4); }
  50%     { box-shadow: 0 0 0 12px oklch(0.92 0.22 130 / 0), 0 0 36px oklch(0.92 0.22 130 / 0.5); }
}
.animate-pulse-glow { animation: pulse-glow 2.4s ease-in-out infinite; }

@keyframes float {
  0%,100% { transform: translateY(0); } 50% { transform: translateY(-6px); }
}
.animate-float { animation: float 4s ease-in-out infinite; }
```

Use `pulse-glow` on tracking pins, `float` on hero imagery, `glass-shine` on all glass tiles for the moving light.

---

## 8. Application Lifecycle (route map)

| Route                  | Purpose                                                   |
| ---------------------- | --------------------------------------------------------- |
| `/`                    | Splash with brand mark + progress                         |
| `/onboarding`          | 3-slide feature discovery                                 |
| `/home`                | Header · Search · Category tiles · Offers · Restaurants   |
| `/offers`              | All exclusive offers                                      |
| `/restaurant/$id`      | Hero image, menu tabs, add-to-cart                        |
| `/cart`                | Items, fees, totals                                       |
| `/checkout`            | Address, time slot, payment, place order                  |
| `/tracking`            | Live status (neon map background, pulse-glow rider pin)   |
| `/orders`              | History list                                              |
| `/profile`             | Wallet, loyalty (gold), addresses, settings               |

State: `src/lib/cart-store.ts` (useSyncExternalStore).
Bottom nav: Home · Offers · Orders · Profile (all glass-strong).

---

## 9. Iconography Rules

- Library: **lucide-react** (no emoji in production UI).
- Stroke 1.75 for category tiles, 2 for inline UI, 2.5 inside filled chips.
- Inside category tiles wrap with `drop-shadow-[0_0_12px_oklch(0.92_0.22_130/0.55)]` for the neon halo.
- Color `text-primary` over tinted glass; `text-primary-foreground` over solid lime.

---

## 10. Migration Checklist (apply on existing project)

1. Add Cairo to the Google Fonts `<link>` in root head; set `--font-sans` and `--font-display` to Cairo first.
2. Paste section §1 color tokens into `:root` of `src/styles.css`.
3. Replace the `body` background with the glossy black/silver mesh in §3.
4. Replace `.glass` / `.glass-strong` blocks with the **shine** versions in §4 and add `.glass-shine` + `@keyframes shine`.
5. Update `CATEGORIES` data shape and add `CATEGORY_ICONS` map (§5); render categories with the new JSX.
6. Audit every `bg-surface-2 border border-border` pill/tile — upgrade to `glass` (or `glass glass-shine` for hero surfaces).
7. Audit `bg-white/…`, `text-white`, `bg-black` — replace with semantic tokens.
8. Verify `<html dir="rtl" lang="ar">` and Cairo loaded.
9. QA on `/home`, `/restaurant/:id`, `/cart`, `/tracking`.

---

_Last updated: HAAT NOW v2 — Glossy Black Obsidian × Dark Silver Chrome × Neon Lime, Cairo typography, strong glass shine._
