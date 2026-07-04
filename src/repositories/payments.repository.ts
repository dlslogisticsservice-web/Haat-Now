// ─────────────────────────────────────────────────────────────────────────────
// payments.repository (Phase-2 architecture stabilization).
// The only layer that talks to the Supabase payment edge functions from the client.
// No business logic — callers (checkout.service) own polling/retry/status handling.
// ─────────────────────────────────────────────────────────────────────────────

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export const paymentsRepository = {
  /**
   * Call the payment-verify edge function for a payment attempt.
   * Returns the parsed response, or null on a network / non-2xx result (caller keeps polling).
   */
  async verifyPayment(paymentAttemptId: string, accessToken: string | null): Promise<Record<string, unknown> | null> {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/payment-verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
        'apikey': ANON_KEY,
      },
      body: JSON.stringify({ paymentAttemptId }),
    });
    if (!res.ok) return null;
    return await res.json() as Record<string, unknown>;
  },
};
