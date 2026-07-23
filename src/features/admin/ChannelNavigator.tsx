// ─────────────────────────────────────────────────────────────────────────────
// Channel Navigator — the "Experience Channels" section added to the Studio's left
// navigator. It lists the four live channels plus the future placeholders, and, when
// a non-website channel is active, that channel's screens.
//
// It reads the channel registry (the single source of truth) and holds no state of its
// own — selection lives in the Studio. Selecting the Website channel returns the
// navigator to the existing page/section tree (rendered by WebsiteCenter, untouched).
// ─────────────────────────────────────────────────────────────────────────────
import React from 'react';
import {
  Globe, Smartphone, Store, Bike, Mail, Bell, MessageSquare, MessageCircle,
  MonitorSmartphone, Mic, Tv, Layers, Lock, AppWindow, type LucideIcon,
} from 'lucide-react';
import { CHANNELS, getChannel, type ChannelId } from '../../experience-channels/channels';

// Registry stays icon-free (pure); the UI resolves icon names here.
const ICONS: Record<string, LucideIcon> = {
  Globe, Smartphone, Store, Bike, Mail, Bell, MessageSquare, MessageCircle, MonitorSmartphone, Mic, Tv,
};

export interface ChannelNavigatorProps {
  channel: ChannelId;
  screenId: string;
  lang: 'ar' | 'en';
  onChannel: (id: ChannelId) => void;
  onScreen: (screenId: string) => void;
}

export const ChannelNavigator: React.FC<ChannelNavigatorProps> = ({ channel, screenId, lang, onChannel, onScreen }) => {
  const L = (a: string, e: string) => (lang === 'ar' ? a : e);
  const active = CHANNELS.filter(c => c.status === 'active');
  const future = CHANNELS.filter(c => c.status === 'planned');
  const current = getChannel(channel);
  const website = active.find(c => c.id === 'website');
  const apps = active.filter(c => c.id !== 'website');
  const inApp = channel !== 'website';

  const channelBtn = (c: typeof active[number], indent = false) => {
    const Icon = ICONS[c.icon] ?? Globe;
    const on = channel === c.id;
    return (
      <button key={c.id} id={`channel_${c.id}`} onClick={() => onChannel(c.id)}
        className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg cursor-pointer text-start mb-0.5"
        style={{ marginInlineStart: indent ? 8 : 0, width: indent ? 'calc(100% - 8px)' : '100%', background: on ? 'var(--color-primary-fixed)' : 'transparent', color: on ? 'var(--color-on-primary-fixed)' : 'var(--color-on-surface)' }}>
        <Icon size={15} /><span className="text-[13px] font-semibold flex-1">{L(c.ar, c.en)}</span>
        {on && c.id !== 'website' && <span style={{ width: 6, height: 6, borderRadius: 999, background: 'var(--color-on-primary-fixed)' }} />}
      </button>
    );
  };

  return (
    <div id="experience_channels_nav">
      <p className="text-[10px] font-bold uppercase tracking-wide px-2 mb-1 flex items-center gap-1.5" style={{ color: 'var(--color-on-surface-variant)' }}>
        <Layers size={11} />{L('استوديو التجربة', 'Experience Studio')}
      </p>

      {website && channelBtn(website)}

      {/* Application Studio — a real visual app builder. The header opens it (defaults to the
          Customer App); the three apps below jump straight into that app's builder. */}
      <button id="channel_application" onClick={() => onChannel('customer')}
        className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg cursor-pointer text-start mb-0.5 mt-1"
        style={{ background: inApp ? 'color-mix(in srgb, var(--color-primary-fixed) 16%, transparent)' : 'transparent', color: 'var(--color-on-surface)', border: inApp ? '1px solid var(--color-primary-fixed)' : '1px solid var(--color-outline-variant)' }}>
        <AppWindow size={15} style={{ color: 'var(--color-primary-fixed,#a3f95b)' }} />
        <span className="text-[13px] font-extrabold flex-1">{L('استوديو التطبيق', 'Application Studio')}</span>
        {inApp && <span style={{ fontSize: 9, fontWeight: 800, color: 'var(--color-primary-fixed,#a3f95b)' }}>●</span>}
      </button>
      <div id="app_channels">{apps.map(c => channelBtn(c, true))}</div>

      {/* Future channels — visible so nobody builds a parallel studio later, but locked. */}
      <p className="text-[10px] font-bold uppercase tracking-wide px-2 mt-2 mb-1" style={{ color: 'var(--color-on-surface-variant)', opacity: 0.7 }}>{L('قريباً', 'Planned')}</p>
      <div className="flex flex-wrap gap-1 px-1.5" id="future_channels">
        {future.map(c => {
          const Icon = ICONS[c.icon] ?? Globe;
          return (
            <span key={c.id} id={`channel_future_${c.id}`} title={L(c.ar_note ?? '', c.en_note ?? '')}
              className="inline-flex items-center gap-1" style={{ fontSize: 10.5, fontWeight: 600, padding: '3px 7px', borderRadius: 999, background: 'var(--color-surface-container-high)', color: 'var(--color-on-surface-variant)', opacity: 0.7 }}>
              <Icon size={11} />{L(c.ar, c.en)}<Lock size={9} />
            </span>
          );
        })}
      </div>

      {/* Screen list for the active non-website channel */}
      {current && channel !== 'website' && current.screens.length > 0 && (
        <div className="mt-3 pt-2" style={{ borderTop: '1px solid var(--color-outline-variant)' }} id="channel_screens">
          <p className="text-[10px] font-bold uppercase px-1 mb-1" style={{ color: 'var(--color-on-surface-variant)' }}>{L('الشاشات', 'Screens')}</p>
          {current.screens.map(s => {
            const on = screenId === s.id;
            return (
              <button key={s.id} id={`screen_${s.id}`} onClick={() => onScreen(s.id)}
                className="w-full text-start px-2 py-1.5 rounded-md text-[12px] cursor-pointer mb-0.5 flex items-center gap-2"
                style={{ background: on ? 'var(--color-surface-container-high)' : 'transparent', color: 'var(--color-on-surface)', outline: on ? '1px solid var(--color-primary-fixed)' : 'none' }}>
                <span className="font-semibold flex-1">{L(s.ar, s.en)}</span>
                {s.experiences.length > 0 && <span style={{ fontSize: 9, fontWeight: 800, color: 'var(--color-primary-fixed,#a3f95b)' }}>{s.experiences.length}</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ChannelNavigator;
