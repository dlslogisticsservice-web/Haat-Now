# Accessibility Checklist — Official HaaT Now Website

> Target: **90+ Lighthouse Accessibility**, WCAG 2.1 AA. The `site/ui/primitives.tsx`
> components are the shared accessible building blocks — verify pages compose them
> rather than re-rolling markup.

## Perceivable
- [ ] Text contrast ≥ 4.5:1 (≥ 3:1 for large text) in both light and dark themes.
- [ ] UI/state colors (badges, buttons) meet 3:1 non-text contrast.
- [ ] No information conveyed by color alone (status also has icon/text).
- [ ] All images/icons have appropriate `alt` / `aria-label`; decorative ones hidden.
- [ ] Content reflows at 320px width and 200% zoom without loss.

## Operable
- [ ] Every interactive element reachable and operable by keyboard (Tab/Shift+Tab/Enter/Esc).
- [ ] Visible focus ring on all focusable elements (not `outline:none` without replacement).
- [ ] Logical focus order; focus trapped in modals, restored on close.
- [ ] `SearchBar` autocomplete is keyboard-navigable (arrow keys, Enter, Esc) with `aria-activedescendant`.
- [ ] Skip-to-content link at top of every page.
- [ ] No keyboard traps; sticky header does not obscure focused elements.
- [ ] Touch targets ≥ 44×44px.

## Understandable
- [ ] `<html lang>` set and switches with locale (ar → `dir="rtl"`).
- [ ] Form fields have associated `<label>`; errors announced and programmatically linked.
- [ ] Portal forms (address, payment) show inline validation with `aria-describedby`.
- [ ] Consistent navigation and naming across pages.

## Robust
- [ ] Landmarks present: `header`, `nav`, `main`, `footer` (one `main` per page).
- [ ] `Breadcrumbs` use `nav[aria-label="Breadcrumb"]` + ordered list.
- [ ] Live regions (`aria-live`) for realtime ETA/driver updates and toast notifications.
- [ ] `EmptyState`, `Spinner`, `Skeleton` expose accessible status text (`role=status`).
- [ ] No ARIA misuse (valid roles, required props, no redundant roles).

## Verification
- [ ] Lighthouse Accessibility ≥ 90 on Home, Merchant, Search, Checkout, Portal.
- [ ] axe-core: 0 critical/serious violations.
- [ ] Manual: full journey completed with keyboard only.
- [ ] Manual: screen-reader pass (NVDA or VoiceOver) on the core journey, RTL included.
