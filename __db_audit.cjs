/**
 * Database Audit — reads live Supabase data, no writes.
 * Run: node __db_audit.cjs
 */
const https = require('https');

const URL  = 'https://umwbzradvbsirsybfxfb.supabase.co';
const KEY  = 'sb_publishable_R8uXSgCyxFK-TpZsFMnIrg_Mkm-MGOD';

function get(path) {
  return new Promise((resolve, reject) => {
    const parsed = require('url').parse(URL + path);
    const options = {
      hostname: parsed.hostname,
      path: parsed.path,
      method: 'GET',
      headers: {
        'apikey': KEY,
        'Authorization': `Bearer ${KEY}`,
        'Accept': 'application/json',
        'Prefer': 'count=exact',
      },
    };
    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', d => body += d);
      res.on('end', () => {
        resolve({
          status: res.statusCode,
          headers: res.headers,
          body: (() => { try { return JSON.parse(body); } catch { return body; } })(),
          raw: body,
        });
      });
    });
    req.on('error', reject);
    req.end();
  });
}

function count(r) {
  const h = r.headers['content-range'];          // "0-N/TOTAL"
  if (h) {
    const m = h.match(/\/(\d+)$/);
    if (m) return parseInt(m[1]);
  }
  if (Array.isArray(r.body)) return r.body.length;
  return '?';
}

function printSection(title) {
  console.log('\n' + '═'.repeat(60));
  console.log(' ' + title);
  console.log('═'.repeat(60));
}

async function main() {
  console.log('HAAT NOW — Live Database Audit');
  console.log('Project:', URL);
  console.log('Time:', new Date().toISOString());

  // ── 1. Merchants ────────────────────────────────────────────
  printSection('1. MERCHANTS');
  const merchants = await get('/rest/v1/merchants?select=id,business_name,is_active');
  console.log('HTTP status :', merchants.status);
  console.log('Row count   :', count(merchants));
  if (Array.isArray(merchants.body) && merchants.body.length > 0) {
    merchants.body.forEach(m => console.log(`  [${m.id?.slice(0,8)}...] ${m.business_name}  active=${m.is_active}`));
  } else {
    console.log('  body:', JSON.stringify(merchants.body).slice(0, 300));
  }

  // ── 2. Branches ─────────────────────────────────────────────
  printSection('2. MERCHANT BRANCHES');
  const branches = await get('/rest/v1/merchant_branches?select=id,name,merchant_id,is_active');
  console.log('HTTP status :', branches.status);
  console.log('Row count   :', count(branches));
  if (Array.isArray(branches.body) && branches.body.length > 0) {
    branches.body.forEach(b => console.log(`  branch [${b.id?.slice(0,8)}...] "${b.name}"  merchant=${b.merchant_id?.slice(0,8)}...  active=${b.is_active}`));
  } else {
    console.log('  body:', JSON.stringify(branches.body).slice(0, 300));
  }

  // ── 3. Products total ────────────────────────────────────────
  printSection('3. PRODUCTS (total)');
  const products = await get('/rest/v1/products?select=id,name,price,branch_id');
  console.log('HTTP status :', products.status);
  console.log('Row count   :', count(products));
  if (Array.isArray(products.body) && products.body.length > 0) {
    products.body.slice(0, 10).forEach(p => console.log(`  product [${p.id?.slice(0,8)}...] "${p.name}"  price=${p.price}  branch=${p.branch_id?.slice(0,8)}...`));
    if (products.body.length > 10) console.log(`  ... and ${products.body.length - 10} more`);
  } else {
    console.log('  body:', JSON.stringify(products.body).slice(0, 300));
  }

  // ── 4. Products per branch ───────────────────────────────────
  printSection('4. PRODUCTS PER BRANCH');
  if (Array.isArray(branches.body) && branches.body.length > 0) {
    for (const b of branches.body) {
      const r = await get(`/rest/v1/products?select=id,name&branch_id=eq.${b.id}`);
      console.log(`  branch "${b.name}" [${b.id?.slice(0,8)}...] → ${count(r)} products  HTTP=${r.status}`);
    }
  } else {
    console.log('  No branches found — skipping per-branch product count.');
    if (Array.isArray(products.body) && products.body.length > 0) {
      const byBranch = {};
      products.body.forEach(p => {
        byBranch[p.branch_id] = (byBranch[p.branch_id] || 0) + 1;
      });
      Object.entries(byBranch).forEach(([bid, n]) =>
        console.log(`  branch_id=${bid?.slice(0,8)}...  products=${n}`)
      );
    }
  }

  // ── 5. Branches per merchant ─────────────────────────────────
  printSection('5. BRANCHES PER MERCHANT');
  if (Array.isArray(merchants.body) && merchants.body.length > 0) {
    for (const m of merchants.body) {
      const r = await get(`/rest/v1/merchant_branches?select=id,name&merchant_id=eq.${m.id}`);
      console.log(`  merchant "${m.business_name}" → ${count(r)} branches  HTTP=${r.status}`);
    }
  } else {
    console.log('  No merchants found.');
  }

  // ── 6. Product categories / product_images ───────────────────
  printSection('6. PRODUCT IMAGES');
  const images = await get('/rest/v1/product_images?select=id,product_id,url');
  console.log('HTTP status :', images.status);
  console.log('Row count   :', count(images));
  if (Array.isArray(images.body) && images.body.length > 0) {
    images.body.slice(0, 5).forEach(i => console.log(`  [${i.id?.slice(0,8)}...] product=${i.product_id?.slice(0,8)}...`));
  } else {
    console.log('  body:', JSON.stringify(images.body).slice(0, 200));
  }

  // ── 7. Auth / RLS probe ─────────────────────────────────────
  printSection('7. RLS / AUTH PROBE');
  // Try to fetch with an obviously invalid ID to see if RLS blocks vs returns empty
  const rlsProbe = await get('/rest/v1/products?select=id&branch_id=eq.00000000-0000-0000-0000-000000000000');
  console.log('Probe (fake UUID) → HTTP:', rlsProbe.status, ' count:', count(rlsProbe));
  console.log('  (200 + 0 rows = query works, no data. 401/403 = RLS block. 400 = bad query.)');

  const rlsMerchants = await get('/rest/v1/merchants?select=id&limit=1');
  console.log('Merchants probe  → HTTP:', rlsMerchants.status);

  const rlsBranches = await get('/rest/v1/merchant_branches?select=id&limit=1');
  console.log('Branches probe   → HTTP:', rlsBranches.status);

  // ── 8. Mock ID probe ────────────────────────────────────────
  printSection('8. MOCK ID PROBE');
  for (const fakeId of ['m1', 'm2', 'm3', 'm4', 'f1', 'f2']) {
    const r = await get(`/rest/v1/products?select=id&branch_id=eq.${fakeId}`);
    console.log(`  branch_id='${fakeId}' → HTTP:${r.status}  rows:${count(r)}`);
  }

  // ── 9. Zones ────────────────────────────────────────────────
  printSection('9. ZONES');
  const zones = await get('/rest/v1/zones?select=id,name');
  console.log('HTTP status :', zones.status);
  console.log('Row count   :', count(zones));
  if (Array.isArray(zones.body)) {
    zones.body.slice(0, 5).forEach(z => console.log(`  [${z.id?.slice(0,8)}...] ${z.name}`));
  } else {
    console.log('  body:', JSON.stringify(zones.body).slice(0, 200));
  }

  // ── 10. Offers ──────────────────────────────────────────────
  printSection('10. OFFERS / BANNERS');
  const offers = await get('/rest/v1/offers?select=id,title,is_active,discount_percent');
  console.log('Offers  HTTP:', offers.status, ' count:', count(offers));
  const banners = await get('/rest/v1/banners?select=id,title');
  console.log('Banners HTTP:', banners.status, ' count:', count(banners));

  // ── DIAGNOSIS ────────────────────────────────────────────────
  printSection('DIAGNOSIS');
  const merchantCount = Array.isArray(merchants.body) ? merchants.body.length : -1;
  const branchCount   = Array.isArray(branches.body)  ? branches.body.length  : -1;
  const productCount  = Array.isArray(products.body)  ? products.body.length  : -1;

  console.log(`merchants = ${merchantCount}`);
  console.log(`branches  = ${branchCount}`);
  console.log(`products  = ${productCount}`);

  if (merchants.status === 401 || branches.status === 401 || products.status === 401) {
    console.log('\nROOT CAUSE: B — RLS / AUTH block (HTTP 401 on at least one table)');
  } else if (merchants.status === 200 && merchantCount === 0 && branchCount === 0) {
    console.log('\nROOT CAUSE: A — Empty database (merchants and branches tables are empty)');
  } else if (branchCount > 0 && productCount === 0) {
    console.log('\nROOT CAUSE: E — Missing product seed data (branches exist, products table empty)');
  } else if (branchCount === 0 && merchantCount > 0) {
    console.log('\nROOT CAUSE: A+E — Merchants exist but no branches, no products');
  } else if (branchCount > 0 && productCount > 0) {
    console.log('\nROOT CAUSE: D — Navigation bug (data exists, but mock IDs are being passed)');
  } else {
    console.log('\nROOT CAUSE: Unclear — check HTTP statuses above');
  }

  console.log('\nAudit complete.');
}

main().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
