// Enterprise load harness — real concurrent HTTP against the PRODUCTION Supabase
// PostgREST endpoint (anon + RLS, the actual customer-browse data path).
// k6/Artillery were not reliably available in this environment; this is a
// functionally-equivalent closed-loop load generator with real percentile stats.
const fs = require('fs');
const REF = 'umwbzradvbsirsybfxfb';
const BASE = `https://${REF}.supabase.co/rest/v1`;
const ANON = fs.readFileSync('/tmp/anon.txt', 'utf8').trim();
const H = { apikey: ANON, Authorization: `Bearer ${ANON}` };

// Realistic customer-browse query (product grid with embedded images+variants).
const URL = `${BASE}/products?select=id,name,price,is_active,product_images(url),product_variants(id,name,price_modifier)&is_active=eq.true&limit=20`;

const pct = (arr, p) => { if (!arr.length) return 0; const s = [...arr].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(p / 100 * s.length))]; };

async function stage(concurrency, durationMs) {
  const lat = [], started = Date.now();
  let ok = 0, err = 0, codes = {};
  let running = true;
  setTimeout(() => { running = false; }, durationMs);
  async function worker() {
    while (running) {
      const t0 = Date.now();
      try {
        const r = await fetch(URL, { headers: H });
        await r.text();
        const dt = Date.now() - t0;
        codes[r.status] = (codes[r.status] || 0) + 1;
        if (r.status === 200) { ok++; lat.push(dt); } else { err++; lat.push(dt); }
      } catch (e) { err++; codes['ERR'] = (codes['ERR'] || 0) + 1; lat.push(Date.now() - t0); }
    }
  }
  await Promise.all(Array.from({ length: concurrency }, worker));
  const total = ok + err, secs = (Date.now() - started) / 1000;
  return {
    concurrency, total, rps: Math.round(total / secs),
    errPct: total ? +(err / total * 100).toFixed(2) : 0,
    p50: pct(lat, 50), p95: pct(lat, 95), p99: pct(lat, 99), max: Math.max(...lat, 0),
    codes,
  };
}

(async () => {
  const results = [];
  // ramp concurrency to find the knee/break point
  const stages = [10, 50, 100, 250, 500, 1000, 2000];
  for (const c of stages) {
    const r = await stage(c, 8000);
    results.push(r);
    console.log(`conc=${String(c).padStart(4)}  rps=${String(r.rps).padStart(4)}  p50=${String(r.p50).padStart(5)}ms  p95=${String(r.p95).padStart(5)}ms  p99=${String(r.p99).padStart(6)}ms  max=${String(r.max).padStart(6)}ms  err=${r.errPct}%  codes=${JSON.stringify(r.codes)}`);
    await new Promise(r => setTimeout(r, 1500)); // cooldown between stages
  }
  fs.writeFileSync('docs/testing/loadtest_results.json', JSON.stringify(results, null, 2));
  console.log('\nwritten docs/testing/loadtest_results.json');
})();
