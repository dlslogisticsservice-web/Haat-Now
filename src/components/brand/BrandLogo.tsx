import React from 'react';
import { useDesign } from '../../design/DesignContext';

// Brand logo consumer (Phase 0.3 integration) — renders the published branding.appLogo (which maps from the
// tenant's brand Logo asset via the design/theme cascade) at runtime, with a fallback when unset/broken.
// Reuses the existing design token; introduces NO new service and NO new asset system.
export const BrandLogo: React.FC<{ size?: number; alt?: string; fallback: React.ReactNode; imgClassName?: string }> = ({ size = 36, alt = 'brand', fallback, imgClassName }) => {
  const { publishedConfig } = useDesign();
  const url = publishedConfig?.branding?.appLogo;
  const [broken, setBroken] = React.useState(false);
  React.useEffect(() => { setBroken(false); }, [url]);
  if (url && !broken) {
    return <img src={url} alt={alt} data-brand-logo="1" onError={() => setBroken(true)} className={imgClassName} style={{ width: size, height: size, objectFit: 'contain' }} />;
  }
  return <>{fallback}</>;
};
