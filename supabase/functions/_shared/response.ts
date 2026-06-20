import { corsHeaders } from './cors.ts';

export interface ErrorBody {
  error: { message: string; code: string };
}

export interface SuccessBody {
  success: true;
  [key: string]: unknown;
}

const jsonHeaders = (extra: Record<string, string> = {}) => ({
  'Content-Type': 'application/json',
  ...extra,
});

/** 2xx success — includes CORS headers for browser callers. */
export function ok(data: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: jsonHeaders(corsHeaders),
  });
}

/** 2xx success without CORS — for server-to-server endpoints (webhooks). */
export function okServer(data: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: jsonHeaders(),
  });
}

/** Error response — includes CORS headers so browser receives the error body. */
export function err(message: string, status = 400, code = 'BAD_REQUEST'): Response {
  const body: ErrorBody = { error: { message, code } };
  return new Response(JSON.stringify(body), {
    status,
    headers: jsonHeaders(corsHeaders),
  });
}

/** Error response without CORS — for server-to-server endpoints. */
export function errServer(message: string, status = 400, code = 'BAD_REQUEST'): Response {
  const body: ErrorBody = { error: { message, code } };
  return new Response(JSON.stringify(body), {
    status,
    headers: jsonHeaders(),
  });
}
