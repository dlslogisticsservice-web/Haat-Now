import { useEffect, useRef } from 'react';

// Full-bleed video background — mobile-optimized (muted + playsInline + autoplay),
// with a poster fallback and graceful degradation when the source fails.
interface VideoBackgroundBlockProps {
  src: string;          // .mp4 or .webm
  poster?: string;      // poster image shown before/while loading and on failure
  overlay?: string;     // optional gradient/scrim over the video
  className?: string;
}

export function VideoBackgroundBlock({ src, poster, overlay, className }: VideoBackgroundBlockProps) {
  const ref = useRef<HTMLVideoElement>(null);
  const isWebm = /\.webm($|\?)/i.test(src);

  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    // Some mobile browsers need an explicit play() after mount.
    const p = v.play();
    if (p && typeof p.catch === 'function') p.catch(() => { /* autoplay blocked — poster remains */ });
  }, [src]);

  return (
    <div className={className} style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }} aria-hidden>
      <video
        ref={ref}
        autoPlay
        muted
        loop
        playsInline
        poster={poster}
        preload="auto"
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
      >
        <source src={src} type={isWebm ? 'video/webm' : 'video/mp4'} />
      </video>
      {overlay && <div style={{ position: 'absolute', inset: 0, background: overlay }} />}
    </div>
  );
}
