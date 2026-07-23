// ─────────────────────────────────────────────────────────────────────────────
// Experience icon resolver — maps the icon NAME stored in the pure content module to
// a real lucide component. Shared by the live screens and the Studio so an icon
// authored in one place shows in both. Keeps `experience-content/content.ts` pure.
// ─────────────────────────────────────────────────────────────────────────────
import {
  Sparkles, Tag, Compass, Megaphone, FlaskConical, GraduationCap, Rocket, ShieldCheck,
  Gift, Bell, Star, Zap, Info, type LucideIcon,
} from 'lucide-react';

const ICONS: Record<string, LucideIcon> = {
  Sparkles, Tag, Compass, Megaphone, FlaskConical, GraduationCap, Rocket, ShieldCheck,
  Gift, Bell, Star, Zap, Info,
};

/** Icon names an operator can choose in the Studio inspector. */
export const EXPERIENCE_ICON_NAMES = Object.keys(ICONS);

export function resolveExperienceIcon(name: string | undefined): LucideIcon {
  return (name && ICONS[name]) || Sparkles;
}
