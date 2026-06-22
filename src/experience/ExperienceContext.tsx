import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { ExperienceSet, DEFAULT_EXPERIENCE, CountryCode, cloneExperience } from './experienceTypes';
import { experienceService } from './experience.service';
import { useAppConfig } from '../contexts/AppConfigContext';

// Provides the PUBLISHED experience set for the active country to the live app.
// Read-only at runtime; the admin builder writes through experienceService directly.
interface ExperienceCtx {
  country: CountryCode;
  experience: ExperienceSet;
  loading: boolean;
  refresh: () => void;
}
const Ctx = createContext<ExperienceCtx | null>(null);

export function useExperience(): ExperienceCtx {
  const c = useContext(Ctx);
  // Safe default if used outside the provider (keeps screens rendering).
  if (!c) return { country: 'EG', experience: cloneExperience(DEFAULT_EXPERIENCE), loading: false, refresh: () => {} };
  return c;
}

export function ExperienceProvider({ children }: { children: ReactNode }) {
  const { country } = useAppConfig();
  const code = country.code as CountryCode;
  const [experience, setExperience] = useState<ExperienceSet>(() => cloneExperience(DEFAULT_EXPERIENCE));
  const [loading, setLoading] = useState(true);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    experienceService.getPublishedSet(code)
      .then(set => { if (alive) { setExperience(set); setLoading(false); } })
      .catch(() => { if (alive) { setExperience(cloneExperience(DEFAULT_EXPERIENCE)); setLoading(false); } });
    return () => { alive = false; };
  }, [code, nonce]);

  return (
    <Ctx.Provider value={{ country: code, experience, loading, refresh: () => setNonce(n => n + 1) }}>
      {children}
    </Ctx.Provider>
  );
}
