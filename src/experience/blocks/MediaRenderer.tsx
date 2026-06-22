import { Suspense, lazy } from 'react';
import { Icon } from '../../components/ui/Icon';
import { MediaRef } from '../experienceTypes';

const LottieBlock = lazy(() => import('./LottieBlock').then(m => ({ default: m.LottieBlock })));

// Resolves a MediaRef (icon | image | lottie | video) into a centered visual.
// Lottie is lazy-loaded; video here is an inline (non-background) clip.
export function MediaRenderer({ media, size = 72, color = '#c8cacc' }: { media: MediaRef; size?: number; color?: string }) {
  if (media.kind === 'image' && media.url) {
    return <img src={media.url} alt="" style={{ width: size, height: size, objectFit: 'contain' }} />;
  }
  if (media.kind === 'lottie' && media.url) {
    return (
      <Suspense fallback={<div style={{ width: size, height: size }} aria-hidden />}>
        <LottieBlock url={media.url} size={size} />
      </Suspense>
    );
  }
  if (media.kind === 'video' && media.url) {
    return (
      <video autoPlay muted loop playsInline poster={media.poster}
        style={{ width: size, height: size, objectFit: 'cover', borderRadius: 24 }}>
        <source src={media.url} />
      </video>
    );
  }
  // icon fallback (also covers empty/unknown)
  return <Icon name={media.icon || 'image'} size={size} style={{ color }} aria-hidden />;
}
