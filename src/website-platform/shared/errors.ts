// ─────────────────────────────────────────────────────────────────────────────
// Website Platform · Typed error factories (Wave 0).
// Construct WebsitePlatformError values without throwing; layers return Result.
// ─────────────────────────────────────────────────────────────────────────────

import type { WebsitePlatformError, WebsiteErrorCode } from './types';

type ErrorDetail = Readonly<Record<string, string | number | boolean | null>>;

function make(code: WebsiteErrorCode, message: string, detail?: ErrorDetail): WebsitePlatformError {
  return detail ? { code, message, detail } : { code, message };
}

export const errors = {
  notFound(entity: string, id: string): WebsitePlatformError {
    return make('not_found', `${entity} not found`, { entity, id });
  },
  conflict(message: string, detail?: ErrorDetail): WebsitePlatformError {
    return make('conflict', message, detail);
  },
  validation(message: string, detail?: ErrorDetail): WebsitePlatformError {
    return make('validation', message, detail);
  },
  optimisticLock(entity: string, id: string): WebsitePlatformError {
    return make('optimistic_lock', `${entity} was modified concurrently`, { entity, id });
  },
  forbidden(message: string): WebsitePlatformError {
    return make('forbidden', message);
  },
  unavailable(message: string): WebsitePlatformError {
    return make('unavailable', message);
  },
  unknown(message: string, detail?: ErrorDetail): WebsitePlatformError {
    return make('unknown', message, detail);
  },
};
