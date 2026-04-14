#!/usr/bin/env node
/**
 * capture-and-send.js
 * Captures each dashboard visualization and sends it to Telegram.
 *
 * Usage:
 *   node scripts/capture-and-send.js
 *
 * Env vars (or edit CONFIG below):
 *   TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, DASHBOARD_URL
 */

const puppeteer  = require('puppeteer');
const axios      = require('axios');
const FormData   = require('form-data');
const fs         = require('fs');
const path       = require('path');

// ─── CONFIG ──────────────────────────────────────────────────────────────────
const CONFIG = {
  TELEGRAM_BOT_TOKEN : process.env.TELEGRAM_BOT_TOKEN  || '8703517096:AAHemdLGjNQh0g5LKybKho2zh_Ww3Gykfwo',
  TELEGRAM_CHAT_ID   : process.env.TELEGRAM_CHAT_ID    || '5043687012',
  DASHBOARD_URL      : process.env.DASHBOARD_URL        || 'http://localhost:3000',
  VIEWPORT           : { width: 1440, height: 900 },
  TMP_DIR            : path.join(__dirname, '.tmp_screenshots'),
  // Extra wait after tab switch before capturing (ms)
  TAB_SETTLE_MS      : 1500,
  // Extra wait for map tiles to load (ms)
  MAP_SETTLE_MS      : 4000,
  // Max time to wait for a selector to appear (ms)
  SELECTOR_TIMEOUT_MS: 15000,
};

// ─── VISUALIZATION MANIFEST ──────────────────────────────────────────────────
// tabIndex: 0=Ikhtisar, 1=Performa, 2=Kendala, 3=Peta
// isMap: true → use MAP_SETTLE_MS instead of TAB_SETTLE_MS
const VISUALIZATIONS = [
  { id: 'viz-kpi',              tabIndex: 0, label: 'KPI Cards — Ringkasan Status Rollout' },
  { id: 'viz-regional-bar',     tabIndex: 0, label: 'Progres per Regional (Stacked Bar)' },
  { id: 'viz-line-plan-actual', tabIndex: 0, label: 'Rencana vs Realisasi (Line Chart)' },
  { id: 'viz-vendor',           tabIndex: 1, label: 'Performa Vendor (Horizontal Bar)' },
  { id: 'viz-pic',              tabIndex: 1, label: 'Beban Kerja PIC Top 15 (Horizontal Bar)' },
  { id: 'viz-distribution',     tabIndex: 1, label: 'Distribusi Progres (Bar Chart)' },
  { id: 'viz-issues',           tabIndex: 2, label: 'Penyebab Keterlambatan (Horizontal Bar)' },
  { id: 'viz-table',            tabIndex: 2, label: 'Data Table — Detail Site' },
  { id: 'viz-map-site',         tabIndex: 3, label: 'Peta Site (Clustered Marker Map)', isMap: true },
  { id: 'viz-map-region',       tabIndex: 3, label: 'Peta Regional (Bubble Map)',       isMap: true },
];

// ─── HELPERS ─────────────────────────────────────────────────────────────────
function log(icon, msg) { console.log(`${icon}  ${msg}`); }

function ensureTmpDir() {
  if (!fs.existsSync(CONFIG.TMP_DIR)) fs.mkdirSync(CONFIG.TMP_DIR, { recursive: true });
}

function tmpPath(id) {
  return path.join(CONFIG.TMP_DIR, `${id}.png`);
}

function cleanFile(filePath) {
  try { if (fs.existsSync(filePath)) fs.unlinkSync(filePath); } catch (_) {}
}

/** Click the tab button at position tabIndex in the tab bar */
async function switchTab(page, tabIndex) {
  await page.evaluate((idx) => {
    const buttons = document.querySelectorAll('div[class*="rounded-lg"] button');
    if (buttons[idx]) buttons[idx].click();
  }, tabIndex);
}

/** Wait for network to be idle (no more than 0 in-flight requests for 500ms) */
async function waitForIdle(page, timeout = 10000) {
  try {
    await page.waitForNetworkIdle({ idleTime: 500, timeout });
  } catch (_) {
    // timeout is acceptable — page may have long-polling
  }
}

/** Check if the element looks like a fallback / empty state */
async function isFallback(page, selector) {
  return page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) return false;
    const text = el.innerText || '';
    return (
      text.includes('Tidak ada data') ||
      text.includes('No region data') ||
      text.includes('tidakAdaData') ||
      // recharts renders a single bar with value 0 for fallback data
      (el.querySelectorAll('.recharts-bar-rectangle').length === 1 &&
        el.querySelector('.recharts-bar-rectangle')?.getAttribute('height') === '0')
    );
  }, selector);
}

/** Send a photo to Telegram */
async function sendToTelegram(filePath, caption) {
  const url = `https://api.telegram.org/bot${CONFIG.TELEGRAM_BOT_TOKEN}/sendPhoto`;
  const form = new FormData();
  form.append('chat_id', CONFIG.TELEGRAM_CHAT_ID);
  form.append('caption', caption);
  form.append('photo', fs.createReadStream(filePath), { filename: path.basename(filePath) });

  const resp = await axios.post(url, form, {
    headers: form.getHeaders(),
    timeout: 30000,
  });

  if (!resp.data.ok) throw new Error(`Telegram API error: ${JSON.stringify(resp.data)}`);
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────
(async () => {
  ensureTmpDir();

  const results = [];
  let browser;

  try {
    log('🚀', 'Launching headless browser...');
    browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    });

    const page = await browser.newPage();
    await page.setViewport(CONFIG.VIEWPORT);

    // ── Load dashboard ──────────────────────────────────────────────────────
    log('🌐', `Opening ${CONFIG.DASHBOARD_URL}`);
    await page.goto(CONFIG.DASHBOARD_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await waitForIdle(page);

    // Wait for the KPI grid to confirm the app has rendered
    try {
      await page.waitForSelector('#viz-kpi', { timeout: CONFIG.SELECTOR_TIMEOUT_MS });
      log('✅', 'Dashboard loaded — KPI grid visible');
    } catch {
      log('❌', 'Dashboard did not render #viz-kpi within timeout. Aborting.');
      process.exit(1);
    }

    let currentTab = 0;

    // ── Capture each visualization ──────────────────────────────────────────
    for (const viz of VISUALIZATIONS) {
      const selector = `#${viz.id}`;
      const filePath = tmpPath(viz.id);
      let status = 'ok';
      let warning = '';

      try {
        // Switch tab if needed
        if (viz.tabIndex !== currentTab) {
          log('🔀', `Switching to tab ${viz.tabIndex} for "${viz.label}"`);
          await switchTab(page, viz.tabIndex);
          currentTab = viz.tabIndex;

          const settleMs = viz.isMap ? CONFIG.MAP_SETTLE_MS : CONFIG.TAB_SETTLE_MS;
          await new Promise(r => setTimeout(r, settleMs));
          await waitForIdle(page, 5000);
        }

        // Extra settle for maps (tile loading)
        if (viz.isMap) {
          log('🗺️', `Waiting extra ${CONFIG.MAP_SETTLE_MS}ms for map tiles...`);
          await new Promise(r => setTimeout(r, CONFIG.MAP_SETTLE_MS));
        }

        // Wait for selector
        await page.waitForSelector(selector, { timeout: CONFIG.SELECTOR_TIMEOUT_MS });

        // Scroll element into view
        await page.evaluate((sel) => {
          document.querySelector(sel)?.scrollIntoView({ behavior: 'instant', block: 'center' });
        }, selector);
        await new Promise(r => setTimeout(r, 300));

        // Check for fallback / empty data
        const empty = await isFallback(page, selector);
        if (empty) {
          warning = ' ⚠️ Warning: Data may be incomplete or unavailable';
          log('⚠️', `"${viz.label}" appears to show fallback/empty data`);
        }

        // Capture element screenshot
        const element = await page.$(selector);
        if (!element) throw new Error(`Element ${selector} disappeared after waitForSelector`);

        await element.screenshot({ path: filePath, type: 'png' });
        log('📸', `Captured: ${viz.label}`);

        // Send to Telegram
        const caption = `📊 ${viz.label}${warning}`;
        await sendToTelegram(filePath, caption);
        log('✈️', `Sent to Telegram: ${viz.label}`);

        results.push({ viz: viz.label, status: 'sent', warning: warning || null });

      } catch (err) {
        log('❌', `FAILED — ${viz.label}: ${err.message}`);
        results.push({ viz: viz.label, status: 'failed', error: err.message });

        // Try to send an error notice to Telegram so the chat stays informed
        try {
          await axios.post(
            `https://api.telegram.org/bot${CONFIG.TELEGRAM_BOT_TOKEN}/sendMessage`,
            { chat_id: CONFIG.TELEGRAM_CHAT_ID, text: `❌ Failed to capture: ${viz.label}\nReason: ${err.message}` },
            { timeout: 10000 }
          );
        } catch (_) {}

      } finally {
        cleanFile(filePath);
      }
    }

  } finally {
    if (browser) await browser.close();
    log('🏁', 'Browser closed');
  }

  // ── Execution summary ──────────────────────────────────────────────────────
  const sent   = results.filter(r => r.status === 'sent').length;
  const failed = results.filter(r => r.status === 'failed').length;

  console.log('\n══════════════════════════════════════════');
  console.log('  EXECUTION SUMMARY');
  console.log('══════════════════════════════════════════');
  for (const r of results) {
    const icon = r.status === 'sent' ? '✅' : '❌';
    const extra = r.warning ? ` [${r.warning.trim()}]` : r.error ? ` [${r.error}]` : '';
    console.log(`  ${icon}  ${r.viz}${extra}`);
  }
  console.log('──────────────────────────────────────────');
  console.log(`  Sent: ${sent}  |  Failed: ${failed}  |  Total: ${results.length}`);
  console.log('══════════════════════════════════════════\n');

  // Clean up tmp dir if empty
  try {
    const remaining = fs.readdirSync(CONFIG.TMP_DIR);
    if (remaining.length === 0) fs.rmdirSync(CONFIG.TMP_DIR);
  } catch (_) {}

  process.exit(failed > 0 ? 1 : 0);
})();
