# App icons (branding deliverable)

Drop the final brand icons here. The PWA manifest + index.html already reference these exact paths,
so installability/store packaging works the moment real PNGs replace these specs.

Required (transparent or `#060a0e` background as noted):

| File | Size | Purpose |
|---|---|---|
| `icon-192.png` | 192×192 | PWA any |
| `icon-512.png` | 512×512 | PWA any |
| `maskable-192.png` | 192×192 | PWA maskable (≥20% safe-zone padding) |
| `maskable-512.png` | 512×512 | PWA maskable |
| `apple-touch-icon.png` | 180×180 | iOS home-screen (no transparency) |

Full per-platform specs (Android adaptive, iOS asset catalog, splash) are in
`docs/mobile/BRANDING_ASSETS_REQUIREMENTS.md`. Generate the native set with
`npx @capacitor/assets generate` from a 1024×1024 master once branding is final.
