import React from 'react';

// ─────────────────────────────────────────────────────────────────────────────
// AppPageLayout — the single reusable page shell for every portal
// (Customer / Merchant / Driver / Admin).
//
// It guarantees content never hides behind a header, tab strip, bottom
// navigation, fixed action bar, or device safe-area inset, using the global
// tokens --top-safe-space / --bottom-safe-space (see index.css).
//
//   • header   → rendered sticky at top:0, with env(safe-area-inset-top) padding
//                so the notch / status bar never overlaps it.
//   • tabs     → optional sticky strip directly under the header.
//   • children → the scroll area; reserves --bottom-safe-space at the bottom.
//   • bottomBar→ optional FIXED action/CTA bar above the bottom nav; when present
//                the scroll area automatically reserves extra room for it.
//
// `bottomNav` controls whether bottom-nav height is reserved (true for the
// customer flow; false for sidebar portals that have no bottom nav).
// ─────────────────────────────────────────────────────────────────────────────

export interface AppPageLayoutProps {
  header?: React.ReactNode;
  tabs?: React.ReactNode;
  bottomBar?: React.ReactNode;
  children: React.ReactNode;
  /** Reserve space for the floating bottom navigation (customer flow). Default true. */
  bottomNav?: boolean;
  /** Height (px) of the optional fixed bottom action bar, reserved in the scroll area. */
  actionBarHeight?: number;
  className?: string;
  contentClassName?: string;
  dir?: 'rtl' | 'ltr';
  id?: string;
}

export function AppPageLayout({
  header,
  tabs,
  bottomBar,
  children,
  bottomNav = true,
  actionBarHeight = 0,
  className = '',
  contentClassName = '',
  dir = 'rtl',
  id,
}: AppPageLayoutProps) {
  // Per-instance overrides of the global sub-tokens → drives top/bottom reservation.
  const styleVars = {
    // Sidebar portals (no bottom nav) reserve only the device inset; customer reserves nav.
    ['--app-bottom-nav-height' as string]: bottomNav ? '88px' : '0px',
    ['--app-action-bar-height' as string]: `${actionBarHeight}px`,
  } as React.CSSProperties;

  return (
    <div id={id} dir={dir} className={`min-h-screen flex flex-col ${className}`} style={styleVars}>
      {header && (
        <header className="app-header-safe sticky top-0 z-50">{header}</header>
      )}
      {tabs && (
        <div className="sticky z-40" style={{ top: 'env(safe-area-inset-top, 0px)' }}>{tabs}</div>
      )}

      {/* Scroll area — reserves bottom space for nav + action bar + inset. */}
      <div className={`flex-1 ${contentClassName}`} style={{ paddingBottom: 'var(--bottom-safe-space)' }}>
        {children}
      </div>

      {/* Optional fixed action/CTA bar — always above the bottom nav + home indicator. */}
      {bottomBar && (
        <div
          className="fixed left-0 right-0 z-40"
          style={{ bottom: bottomNav ? 'calc(var(--app-bottom-nav-height) + env(safe-area-inset-bottom, 0px))' : 'env(safe-area-inset-bottom, 0px)' }}
        >
          {bottomBar}
        </div>
      )}
    </div>
  );
}

export default AppPageLayout;
