# Deep Linking (Wave 2)

> Deferred deep linking for the App Conversion Engine: continue checkout in the app if installed,
> otherwise send to the right store and **resume checkout after install**. Pure + isomorphic (Node +
> browser); no native code. `src/website-platform/conversion/deeplink.ts`.

## Store support
Google Play (`android`), App Store (`ios`), and **Huawei AppGallery** (`huawei`).
`detectMobilePlatform(userAgent)` classifies the visitor (huawei → ios → android → unknown, so Huawei
devices are not misrouted to Play). `storeUrl(platform, links)` returns the correct store URL with
sensible fallbacks.

## Deep links
`buildDeepLink(scheme, path, params)` → `haatnow://checkout?resume=<token>`. The app registers the
scheme (and universal/app links in production) to open the right screen.

## Resume token (checkout continuity)
`buildResumeToken(payload)` encodes a small checkout payload (`{ intent, issuedAt, … }`) into a
portable, **integrity-checked** token (`<hash>.<url-encoded-json>`); `parseResumeToken` verifies the
hash and returns `null` on tamper/malformed input. It is **not** encryption — carry no secrets; it
carries an intent + reference the app resolves.

## Deferred flow
`resolveDeferredLink({ scheme, deepPath, storeLinks, platform, resume })` returns:
```
{ deepLink,        // try first — app installed ⇒ resumes checkout in-app
  storeUrl,        // fallback — app not installed
  resumeToken }    // persist (deferred-link service / clipboard / cookie); the app reads it on first open
```
Client sequence:
1. User taps "Continue in app".
2. Attempt `deepLink`. If it opens the app → checkout resumes (token in the URL).
3. If it does not open within a timeout → navigate to `storeUrl`, having stashed `resumeToken`.
4. After install, the app's deferred-link/attribution layer surfaces the token → checkout resumes.

## Analytics
`deep_link_success` / `deep_link_fallback` events (analytics module) measure how often the app opened
vs. the store fallback was used.

## Reusability
Fully config-driven per rule (scheme, path, store links) and tenant-scoped — a white-label tenant sets
its own scheme + store URLs; the logic is shared.

## Tests
`__tests__/deeplink-ordering-website.test.ts` — platform detection, store resolution + fallback, deep
link building, resume-token round-trip + tamper detection, deferred resolution.
