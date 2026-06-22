import { Suspense, lazy, useEffect, useState } from 'react';

// Lazy-loaded Lottie player — the lottie-react runtime is code-split into its own
// chunk and only downloaded when a Lottie animation is actually rendered.
const Lottie = lazy(() => import('lottie-react'));

interface LottieBlockProps {
  /** URL to a Lottie JSON animation (CDN / Supabase Storage). */
  url: string;
  size?: number;
  loop?: boolean;
  className?: string;
}

export function LottieBlock({ url, size = 148, loop = true, className }: LottieBlockProps) {
  const [data, setData] = useState<object | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    setData(null); setFailed(false);
    fetch(url)
      .then(r => r.json())
      .then(j => { if (alive) setData(j); })
      .catch(() => { if (alive) setFailed(true); });
    return () => { alive = false; };
  }, [url]);

  if (failed) return null;
  if (!data) return <div style={{ width: size, height: size }} className={className} aria-hidden />;

  return (
    <div style={{ width: size, height: size }} className={className}>
      <Suspense fallback={<div style={{ width: size, height: size }} aria-hidden />}>
        <Lottie animationData={data} loop={loop} style={{ width: size, height: size }} />
      </Suspense>
    </div>
  );
}
