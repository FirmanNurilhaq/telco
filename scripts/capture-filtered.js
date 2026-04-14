#!/usr/bin/env node
/**
 * capture-filtered.js
 * Captures a specific subset of dashboard visualizations and sends them to Telegram.
 *
 * Usage:
 *   node scripts/capture-filtered.js --viz=viz-kpi,viz-regional-bar
 *
 * Or via env var:
 *   VIZ_IDS=viz-kpi,viz-vendor node scripts/capture-filtered.js
 *
 * Required env vars:
 *   TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID
 *
 * Optional env vars:
 *   DASHBOARD_URL  (default: http://localhost:5173)
 */

'use strict';

const puppeteer = require('puppeteer');
const axios     = require('axios');
const FormData  = require('form-data');
const fs        = require('fs');
const path      = require('path');

// ─── CONFIG ───────────────────────────────────────────────────────────────────
const CONFIG = {
  TELEGRAM_BOT_TOKEN  : process.env.TELEGRAM_BOT_TOKEN,
  TELEGRAM_CHAT_ID    : process.env.TELEGRAM_CHAT_ID,
  DASHBOARD_URL       : process.env.DASHBOARD_URL || 'http://localhost:5173',
  VIEWPORT            : { width: 1440, height: 900 },
  TMP_DIR             : path.join(__dirname, '.tmp_screenshots'),
  TAB_SETTLE_MS       : 1500,
  MAP_SETTLE_MS       : 4000,
  SELECTOR_TIMEOUT_MS : 15000,
};

// ─── FULL VISUALIZATION REGISTRY ─────────────────────────────────────────────
// Single source of truth — shared with capture-and-send.js conceptually
const ALL_VISUALIZATIONS = [
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

// ─── PARSE REQUESTED IDs ──────────────────────────────────────────────────────
function parseRequestedIds() {
  // Priority 1: --viz=id1,id2 CLI argument
  const arg = process.argv.find(a => a.startsWith('--viz='));
  if (arg) return arg.replace('--viz=', '').split(',').map(s => s.trim()).filter(Boolean);

  // Priority 2: VIZ_IDS env var
  if (process.env.VIZ_IDS) {
    return process.env.VIZ_IDS.split(',').map(s => s.trim()).filter(Boolean);
  }

  console.error('[capture-filtered] No visualization IDs provided.');
  console.error('  Usage: node capture-filtered.js --viz=viz-kpi,viz-vendor');
  process.exit(1);
}

// ─── HELPERS (same as capture-and-send.js) ───────────────────────────────────
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

async function switchTab(page, tabIndex) {
  await page.evaluate((idx) => {
    const buttons = document.querySelectorAll('div[class*="rounded-lg"] button');
    if (buttons[idx]) buttons[idx].click();
  }, tabIndex);
}

async function waitForIdle(page, timeout = 10000) {
  try {
    await page.waitForNetworkIdle({ idleTime: 500, timeout });
  } catch (_) {}
}

async function isFallback(page, selector) {
  return page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) return false;
    const text = el.innerText || '';
    return (
      text.includes('Tidak ada data') ||
      text.includes('No region data') ||
      (el.querySelectorAll('.recharts-bar-rectangle').length === 1 &&
        el.querySelector('.recharts-bar-rectangle')?.getAttribute('height') === '0')
    );
  }, selector);
}

async function sendToTelegram(filePath, caption) {
  const url  = `https://api.telegram.org/bot${CONFIG.TELEGRAM_BOT_TOKEN}/sendPhoto`;
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
  if (!CONFIG.TELEGRAM_BOT_TOKEN || !CONFIG.TELEGRAM_CHAT_ID) {
    console.error('[capture-filtered] TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID must be set.');
    process.exit(1);
  }

  const requestedIds = parseRequestedIds();
  log('🎯', `Requested IDs: ${requestedIds.join(', ')}`);

  // Filter registry to only requested IDs, preserving manifest order
  const targets = ALL_VISUALIZATIONS.filter(v => requestedIds.includes(v.id));

  const unknown = requestedIds.filter(id => !ALL_VISUALIZATIONS.find(v => v.id === id));
  if (unknown.length) log('⚠️', `Unknown viz IDs (will be skipped): ${unknown.join(', ')}`);

  if (!targets.length) {
    console.error('[capture-filtered] No valid visualization IDs matched. Exiting.');
    process.exit(1);
  }

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

    log('🌐', `Opening ${CONFIG.DASHBOARD_URL}`);
    await page.goto(CONFIG.DASHBOARD_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await waitForIdle(page);

    // Confirm app rendered
    try {
      await page.waitForSelector('#viz-kpi', { timeout: CONFIG.SELECTOR_TIMEOUT_MS });
      log('✅', 'Dashboard loaded');
    } catch {
      log('❌', 'Dashboard did not render within timeout. Aborting.');
      process.exit(1);
    }

    let currentTab = 0;

    for (const viz of targets) {
      const selector = `#${viz.id}`;
      const filePath = tmpPath(viz.id);
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

        if (viz.isMap) {
          log('🗺️', `Waiting extra ${CONFIG.MAP_SETTLE_MS}ms for map tiles...`);
          await new Promise(r => setTimeout(r, CONFIG.MAP_SETTLE_MS));
        }

        await page.waitForSelector(selector, { timeout: CONFIG.SELECTOR_TIMEOUT_MS });

        await page.evaluate((sel) => {
          document.querySelector(sel)?.scrollIntoView({ behavior: 'instant', block: 'center' });
        }, selector);
        await new Promise(r => setTimeout(r, 300));

        const empty = await isFallback(page, selector);
        if (empty) {
          warning = ' ⚠️ Warning: Data may be incomplete or unavailable';
          log('⚠️', `"${viz.label}" shows fallback/empty data`);
        }

        const element = await page.$(selector);
        if (!element) throw new Error(`Element ${selector} disappeared after waitForSelector`);

        await element.screenshot({ path: filePath, type: 'png' });
        log('📸', `Captured: ${viz.label}`);

        await sendToTelegram(filePath, `📊 ${viz.label}${warning}`);
        log('✈️', `Sent: ${viz.label}`);

        results.push({ viz: viz.label, status: 'sent', warning: warning || null });

      } catch (err) {
        log('❌', `FAILED — ${viz.label}: ${err.message}`);
        results.push({ viz: viz.label, status: 'failed', error: err.message });

        try {
          await axios.post(
            `https://api.telegram.org/bot${CONFIG.TELEGRAM_BOT_TOKEN}/sendMessage`,
            { chat_id: CONFIG.TELEGRAM_CHAT_ID, text: `❌ Failed to capture: ${viz.label}\n${err.message}` },
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

  // Summary
  const sent   = results.filter(r => r.status === 'sent').length;
  const failed = results.filter(r => r.status === 'failed').length;
  console.log('\n══════════════════════════════════════════');
  console.log('  EXECUTION SUMMARY');
  console.log('══════════════════════════════════════════');
  for (const r of results) {
    const icon  = r.status === 'sent' ? '✅' : '❌';
    const extra = r.warning ? ` [${r.warning.trim()}]` : r.error ? ` [${r.error}]` : '';
    console.log(`  ${icon}  ${r.viz}${extra}`);
  }
  console.log('──────────────────────────────────────────');
  console.log(`  Sent: ${sent}  |  Failed: ${failed}  |  Total: ${results.length}`);
  console.log('══════════════════════════════════════════\n');

  try {
    const remaining = fs.readdirSync(CONFIG.TMP_DIR);
    if (remaining.length === 0) fs.rmdirSync(CONFIG.TMP_DIR);
  } catch (_) {}

  process.exit(failed > 0 ? 1 : 0);
})();
