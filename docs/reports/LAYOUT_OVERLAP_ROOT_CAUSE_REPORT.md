# Layout Overlap — Root Cause Report

**Date:** 2026-06-23
**Scope:** `src/App.tsx` (global customer header), `src/features/profile/ProfileScreen.tsx`
(profile + addresses tab), `src/features/wallet/WalletScreen.tsx`.
**Why headless never caught it:** headless Chrome reports `env(safe-area-inset-*) = 0`, so a notch
overlap is structurally impossible to reproduce there. This was a **real-device-only** bug.

---

## Root cause (the real one)

`index.html` sets:
```html
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
```
`viewport-fit=cover` makes the web view extend **under the notch / status bar and under the home
indicator**, and makes `env(safe-area-inset-*)` non-zero on real devices.

The sticky headers were given a **fixed pixel height** *and* a top safe-area padding:

| Element | File:line | Before |
|---|---|---|
| Global customer header | `App.tsx:306` | `class app-header-safe` (→ `padding-top: env(safe-area-inset-top)`) **+ `height: '56px'`** |
| Profile header | `ProfileScreen.tsx:539` | `app-header-safe` **+ `height: '56px'`** |
| Profile tab strip | `ProfileScreen.tsx:572` | `sticky` **+ `top: '56px'`** (hardcoded) |
| Wallet header | `WalletScreen.tsx:161` | `app-header-safe` **+ `h-16` (height:64px)** |

With the app's global `box-sizing: border-box`, **padding is included inside the fixed height**. So:

```
content-box height = height − padding-top
                   = 56px − env(safe-area-inset-top)
```

On an iPhone (`inset ≈ 47px`): content box = `56 − 47 = 9px`. The header's logout button / title /
bell are flex-centered into a 9px strip that sits **under the notch** — i.e. the header content is
hidden behind the status bar. The fixed height **could not grow** to absorb the inset.

The tab strip compounded it: `top: '56px'` is a hardcoded sticky offset that **ignores the inset**,
so it stuck `inset` pixels too high (into the notch region) instead of below the real header.

### DOM hierarchy + measured box model (simulated inset = 47px)

```
<div min-h-screen padding-bottom:var(--bottom-safe-space)>
  ├─ <header app-header-safe sticky top:0  height:56px>      ← BEFORE
  │     padding-top: 47px  →  content-box = 9px
  │     measured: title top y=41  (notch bottom y=47)  →  TITLE UNDER NOTCH ✗
  ├─ <div sticky top:56px> (tabs)                            ← sticks 47px too high ✗
  └─ <main> … in-flow content …
```
```
  ├─ <header app-header-safe sticky top:0  height:calc(56px + env(inset))>   ← AFTER
  │     total = 103px, padding-top 47px  →  content-box = 56px
  │     measured: title top y=64  (notch bottom y=47)  →  TITLE BELOW NOTCH ✓
  ├─ <div sticky top:calc(56px + env(inset))> (tabs)        ← sticks below header ✓
```

(Measurements from `docs/testing/notch_demo.cjs`, which replicates the exact CSS with a simulated
47px notch — see screenshots below.)

## The fix (component-level — no new utilities added)

Make each header's **height grow by the inset** so the safe-area padding adds to it instead of eating
into it, and make the tab strip's sticky offset inset-aware:

| Element | After |
|---|---|
| `App.tsx:306` | `height: 'calc(56px + env(safe-area-inset-top, 0px))'` |
| `ProfileScreen.tsx:539` | `height: 'calc(56px + env(safe-area-inset-top, 0px))'` |
| `ProfileScreen.tsx:572` | `top: 'calc(56px + env(safe-area-inset-top, 0px))'` |
| `WalletScreen.tsx:161` | removed `h-16` → `height: 'calc(64px + env(safe-area-inset-top, 0px))'` |

With `app-header-safe` providing `padding-top: env(inset)` and the height now `base + inset`
(border-box), the content box is exactly `base` px and sits fully **below** the notch.
On non-notched / desktop devices `inset = 0`, so height = base and there is **zero visual change**.

## Bottom navigation — investigated, already correct for these screens

- **No fixed/sticky-bottom CTA** exists in ProfileScreen or WalletScreen (the only `absolute -bottom`
  is the avatar edit badge — decorative). Every save/CTA button is **in normal flow**.
- Both pages reserve `padding-bottom: var(--bottom-safe-space)` = `env(inset-bottom) + 88 + 24` =
  `inset + 112px`. The bottom nav (`.bottom-nav`, `position:fixed; bottom: 12px + inset`, ≈64px tall)
  has its **top edge at ≈ `76px + inset`** from the viewport bottom. `112 + inset > 76 + inset`, so
  in-flow content clears the nav by ≈36px. **No bottom overlap on these screens.**
- The addresses tab is part of ProfileScreen (no separate `src/features/address/*`), so it inherits the
  same page padding and is covered.

Conclusion: the reported overlap on Profile / Address / Wallet is the **top header** (fixed-height vs
inset), now fixed. The bottom reservation was already mathematically sufficient for these screens.

## Before / after (controlled demonstration)

Because headless Chrome forces `env() = 0`, the difference is shown via an equivalent controlled
render (`docs/testing/notch_demo.cjs`) with a simulated 47px notch:

- `docs/testing/post_deploy_shots/notch_before.png` — `height:56px`: title **under** the red notch zone.
- `docs/testing/post_deploy_shots/notch_after.png` — `height:calc(56px + inset)`: title **below** the notch.

Measured: BEFORE title top y=41 (notch bottom 47) → covered; AFTER title top y=64 → clear.

## Build / deploy
- `npm run build`: ✅ passes.
- Pushed to `feat/auth-recovery-frontend-sprint` (triggers Vercel redeploy). Verify the live build shows
  the new commit, then re-check on the physical device.
