import puppeteer from 'puppeteer';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, '..', 'screenshots');

const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
const page = await browser.newPage();
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });
await page.goto('http://localhost:4174', { waitUntil: 'networkidle2', timeout: 30000 });
await page.evaluate(() => document.fonts.ready);
await new Promise(r => setTimeout(r, 3000));
await page.screenshot({ path: path.join(outDir, '01_login_new.png'), fullPage: false });
console.log('Captured: screenshots/01_login_new.png');
await browser.close();
