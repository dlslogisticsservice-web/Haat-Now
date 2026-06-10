# 🗺️ HaatNow Payment Gateway Activation Guide

This document maps out the system architecture and dynamic deployment configurations required to transition our unified payment gateway abstraction layer (`payment.service.ts`) from **Development/Dry-Run Mode** into live **Production Gateway Capture**.

---

## 🚀 Architectural Overview

Upstream payment routing is abstracted entirely at the service level, utilizing provider adapters to interface with different Middle Eastern and global channels. This architecture ensures that **zero frontend business code changes** are required when rotating API credentials or registering secondary callback URLs.

### 💳 Supported Payment Lifecycle States
We support a transactional trace accounting lifecycle mapped to our backend databases and webhook events:
1. **`pending`**: Customer clicked order checkout; Payment entry initialized in database.
2. **`authorized`**: Card credit reserved on issuer; Waiting for delivery service dispatch approval to capture (manual capture pattern).
3. **`captured`**: Funds successfully audited, pulled, and settled. Order starts preparation.
4. **`failed`**: Insufficient balance, 3DS check failure, or card network rejection.
5. **`cancelled`**: Session expired or terminated voluntarily prior to authentication.
6. **`refunded`**: Order cancelled post-settlement. Upstream refund execution triggered, balance returned.

---

## ⚙️ 1. Environment Variable Registrations

Configure these settings inside your hosting platform (Cloud Run / Supabase Functions Environment Manager keys):

### Common Settings
* `PAYMENT_MODE`: `"production"` (Turns on real upstream routing. If set to `"sandbox"`, dry-run transactions are tracked).

### Stripe Setup
* `STRIPE_SECRET_KEY`: Secret API key (`sk_live_...`) to initiate and capture payments securely server-side.
* `VITE_STRIPE_PUBLIC_KEY`: Frontend PK (`pk_live_...`) to inject Stripe element forms safely.
* `STRIPE_WEBHOOK_SECRET`: HMAC signing secret (`whsec_...`) for verify payload signatures on checkout actions.

### Paymob Setup (Primary GCC / Egypt card & wallet rails)
* `PAYMOB_API_KEY`: Found in paymob settings panel under integrations keys.
* `VITE_PAYMOB_PUBLIC_KEY`: Public client presentation token.
* `PAYMOB_WEBHOOK_SECRET`: Secure String/HMAC key used to verify payments event triggers.
* `PAYMOB_MERCHANT_ID`: Paymob system merchant profile ID.
* `PAYMOB_INTEGRATION_ID`: Registration Card/Wallet acceptance ID from Paymob Accept dashboard.
* `PAYMOB_IFRAME_ID`: Visual HTML iFrame container ID.

### Apple Pay Setup
* `APPLE_PAY_MERCHANT_ID`: Your identifiers setup on Apple Developer Console.
* `APPLE_PAY_MERCHANT_CERTIFICATE`: Apple merchant RSA verification private key string (X.509 format).
* `APPLE_PAY_MERCHANT_DOMAIN`: Registered domain name matching certificate bindings (e.g. `haatnow.com`).

### Google Pay Setup
* `GOOGLE_PAY_MERCHANT_ID`: Unique Google Pay business identifier from Google Pay API Business Console.
* `VITE_GOOGLE_PAY_MERCHANT_ID`: Client public presentation ID.

### Mada Setup (Saudi local card scheme)
* Built directly into our Stripe and Checkout.com BIN-routing wrappers. Mada triggers automatic local pricing routing on card ranges matching standard Saudi Arabian debit BINs. Requires matching keys populated or dedicated Saudi payment gateway keys.

---

## 🌐 2. Callback Hooks & Webhook URL Configurations

Configure checkout callbacks to route to your main Supabase live project.

### Target Routing Configuration endpoints:
```bash
https://[YOUR_SUPABASE_PROJECT_ID].supabase.co/functions/v1/payments-webhook
```

### Signature Verification Details:
* **Stripe Webhooks**: Listen for `payment_intent.succeeded` and `payment_intent.payment_failed` triggers. Double-check incoming payloads against your configuration `STRIPE_WEBHOOK_SECRET`.
* **Paymob Webhooks**: Set up an active integration callback URL on your Paymob Accept dashboard. Paymob issues transaction callbacks with an HMAC signature parameter containing calculated checksums of ordered JSON keys.

---

## 🔄 3. Refund Execution Workflow

We implement refunds using an integrated ledger balance accounting pattern:
1. Administrator selects transaction inside Admin control panel and triggers refund mechanism.
2. `paymentService.refundPayment({ orderId, amount, reason, gatewayReference })` routes request directly to the issuer endpoint.
3. Once the gateway responds with success, double-spend vulnerabilities are avoided by executing standard transactional state transitions inside database ledgers.
4. If checking out with wallet points, refund triggers `adjust_wallet_balance` PL/pgSQL function to restore the user's cash automatically with row-level locks.

---

## 🏁 4. Setup Validation Checklist

Before releasing payments to the wild, execute these checks:

- [ ] Validate that `PAYMENT_MODE` environment variable is explicitly set to `"production"`.
- [ ] Run credential verification tool `validatePaymentCredentials()` to confirm there are no unconfigured keys.
- [ ] Whitelist `haatnow.com` under Apple Pay domain files on your payment provider profile.
- [ ] Import Stripe domain association files to root `.well-known/apple-developer-merchantid-domain-association` for Apple Pay native Safari checkout compatibility.
- [ ] Confirm database index mappings are optimized for `idx_payment_transactions_order`.
