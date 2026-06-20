type Level = 'INFO' | 'WARN' | 'ERROR';

/**
 * Structured JSON logger.
 * All fields land in Supabase Edge Function log streams as parseable JSON.
 */
export function log(
  level: Level,
  fn: string,
  message: string,
  meta: Record<string, unknown> = {},
): void {
  // Redact any accidental secret leakage in meta
  const safe = Object.fromEntries(
    Object.entries(meta).filter(([k]) =>
      !k.toLowerCase().includes('secret') &&
      !k.toLowerCase().includes('key')   &&
      !k.toLowerCase().includes('token')
    )
  );
  console.log(
    JSON.stringify({ ts: new Date().toISOString(), level, fn, message, ...safe })
  );
}
