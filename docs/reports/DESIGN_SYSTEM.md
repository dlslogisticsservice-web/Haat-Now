# HAAT NOW — Admin Design System

**Date:** 2026-06-25 · Source: `src/components/admin/EnterpriseUI.tsx` (+ existing `components/ui/*`).
One design language; all values reference existing CSS variables (no new colors introduced).

## Components (enterprise primitives)
| Component | Purpose | Key props |
|---|---|---|
| `AdminCard` | base content container | `padding`, `className` |
| `MetricCard` | KPI tile w/ icon + hint | `label`, `value`, `Icon`, `accent`, `hint` |
| `StatTile` | compact dense stat | `label`, `value`, `accent` |
| `WorkspaceHeader` | page title bar (icon+title+subtitle+actions) | `Icon`, `title`, `subtitle`, `actions` |
| `SectionHeader` | sub-section divider | `title`, `action` |
| `Toolbar` | filter/search row | `onSearch`, `searchValue`, `placeholder` |
| `ActionButton` | primary/secondary CTA | `variant`, `loading`, `Icon` |
| `StatusBadge` | pill status (active/pending/error/…) | `kind`, `label` |
| `DashboardGrid` | responsive card grid (2/3/4 cols) | `cols` |
| `LoadingState` / `EmptyStateBox` | loading + empty | `label` / `Icon,title,description,action` |

Base UI (`components/ui/*`): `Button`, `Card`, `Badge`, `Input`, `Modal`, `Loader`, `EmptyState`, `Icon`,
`EnterpriseSidebar`, `TopAppBar`, `BottomNavBar`.

## Tokens (CSS variables — single source)
| Token | Variable | Use |
|---|---|---|
| Surface | `--color-surface-container` | cards/inputs |
| Surface high | `--color-surface-container-high` | inactive tabs, icon chips |
| On-surface | `--color-on-surface` | primary text |
| Muted | `--color-on-surface-variant` | secondary text/labels |
| Primary | `--color-primary-fixed` | **active / CTA / success only** |
| On-primary | `--color-on-primary-fixed` | text on primary |
| Outline | `--color-outline-variant` | borders/dividers |
| Status | green `#4ade80` · amber `#fbbf24` · orange `#fb923c` · red `#f87171` | StatusBadge / charts |

## Spacing & radius
- Spacing scale: `gap-2 / gap-3 / gap-4` (8/12/16px); card padding `p-3` (dense) / `p-4` (default).
- Radius: `rounded-lg` (10px, chips/inputs) · `rounded-xl` (14px, buttons) · `rounded-2xl` (cards).
- Control heights: button/input `h-9` (36px); tab `py-2`.

## Typography hierarchy (target)
| Role | Class/size | Weight |
|---|---|---|
| Display | 28–36px | 800 |
| Headline | `text-lg` 18px | 700 |
| Title | 15–16px | 700 |
| Subtitle | 13px | 600 |
| Body | 14px | 400–500 |
| Caption | 12px | 400 |
| Label | 11–12px (muted) | 500 |
| Metric | `text-2xl` 24px | 800 |

(Arabic: Cairo/Tajawal; Latin/numerals: Inter — already loaded.)

## Color philosophy
- **Green is reserved** for active state, primary CTA, and success — not decorative.
- Inactive/neutral surfaces use dark glass (`surface*` + low-opacity borders) for enterprise contrast.
- Status colors only on `StatusBadge` and charts; avoid rainbow accents in layout.

## Icons
- **`lucide-react` only** — no emoji anywhere in admin. Canonical mapping: Operations→Truck, Dispatch→Route,
  Drivers→UserRound, Finance→Wallet/Banknote, Growth→Rocket, Support→Headset, Analytics→BarChart3,
  Reports→FileBarChart, Orders→Receipt, Restaurants→Store, Customers→Users, Settings→Settings2,
  Security→ShieldCheck, Notifications→Bell, Localization→Languages, Design→Palette, Media→Image,
  Campaigns→Megaphone, Coupons→TicketPercent, Loyalty→Award, Marketing→Target. Default size 15–20px.

## Charts
- Library: **Recharts**. Palette: primary `#9ed442` for series; status colors for categorical
  (segments). `ResponsiveContainer` for all charts; muted axis ticks (`#aab0b6`, 11px); tooltips on.
- TODO: shared `<AdminChart>` wrapper to enforce palette/legend/loading/empty uniformly.

## Usage rule
**Do not duplicate UI.** New admin panels compose these primitives (MetricCard/DashboardGrid/WorkspaceHeader/
StatusBadge/ActionButton) rather than re-styling cards/badges inline. Existing panels should migrate to them
incrementally (tracked in `UI_AUDIT.md`).
