// Controlled before/after demonstration of the header box-model fix.
// Headless Chrome reports env(safe-area-inset-*)=0, so we simulate a 47px notch
// via --notch and replicate the EXACT CSS each header uses.
const puppeteer = require('puppeteer');
const OUT = 'docs/testing/post_deploy_shots';

const page = (mode) => {
  const headerHeight = mode === 'before' ? '56px' : 'calc(56px + var(--notch))';
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    * { box-sizing: border-box; margin:0; font-family: system-ui, sans-serif; }
    :root { --notch: 47px; }
    body { background:#0b0e11; }
    .frame { width:390px; margin:0 auto; position:relative; min-height:520px; background:#0b0e11; overflow:hidden; }
    /* the device unsafe area (notch / status bar) — content here is COVERED on a real phone */
    .notch { position:absolute; top:0; left:0; right:0; height:var(--notch); background:repeating-linear-gradient(45deg,#3a0000,#3a0000 8px,#5a0000 8px,#5a0000 16px); z-index:99; display:flex; align-items:center; justify-content:center; color:#ff9a9a; font-size:10px; letter-spacing:1px; }
    .header {
      position: sticky; top:0; z-index:40;
      height: ${headerHeight};
      padding-top: var(--notch);              /* = env(safe-area-inset-top), the app-header-safe rule */
      background: linear-gradient(180deg, rgba(255,255,255,0.08), rgba(255,255,255,0.01)), rgba(12,14,18,0.95);
      border-bottom:1px solid rgba(255,255,255,0.10);
      display:flex; align-items:center; justify-content:space-between; padding-left:16px; padding-right:16px;
    }
    .header .logout { color:#ff7a7a; font-size:13px; }
    .header h1 { color:#a3f95b; font-size:16px; font-weight:700; }
    .header .bell { color:#aaa; font-size:18px; }
    .body { padding:16px; color:#e1e2e7; }
    .card { background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.08); border-radius:14px; padding:14px; margin-bottom:10px; }
    .tag { position:absolute; top:6px; left:6px; z-index:100; background:${mode==='before'?'#7a1f1f':'#1f5a1f'}; color:#fff; font-size:11px; padding:3px 8px; border-radius:6px; }
  </style></head><body>
    <div class="frame">
      <div class="tag">${mode === 'before' ? 'BEFORE — height:56px (broken)' : 'AFTER — height:calc(56px + inset)'}</div>
      <div class="notch">NOTCH / STATUS BAR (covered)</div>
      <header class="header">
        <span class="logout">⎋ خروج</span>
        <h1>حسابي</h1>
        <span class="bell">🔔</span>
      </header>
      <div class="body">
        <div class="card">الملف الشخصي · عناوين التوصيل</div>
        <div class="card">الاسم الكامل</div>
        <div class="card">رقم الجوال — +201000000001</div>
      </div>
    </div>
  </body></html>`;
};

(async () => {
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  const p = await browser.newPage();
  await p.setViewport({ width: 390, height: 520, deviceScaleFactor: 2 });
  for (const mode of ['before', 'after']) {
    await p.setContent(page(mode), { waitUntil: 'load' });
    // measure header content position relative to the notch
    const m = await p.evaluate(() => {
      const notch = document.querySelector('.notch').getBoundingClientRect();
      const h1 = document.querySelector('.header h1').getBoundingClientRect();
      const header = document.querySelector('.header').getBoundingClientRect();
      return { notchBottom: Math.round(notch.bottom), titleTop: Math.round(h1.top), titleBottom: Math.round(h1.bottom), headerHeight: Math.round(header.height) };
    });
    const underNotch = m.titleTop < m.notchBottom;
    console.log(`${mode.toUpperCase()}: headerHeight=${m.headerHeight}px titleTop=${m.titleTop} notchBottom=${m.notchBottom} -> title under notch? ${underNotch}`);
    await p.screenshot({ path: `${OUT}/notch_${mode}.png` });
  }
  await browser.close();
})();
