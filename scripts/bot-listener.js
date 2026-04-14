#!/usr/bin/env node
/**
 * bot-listener.js
 * Multi-command Telegram bot for the dashboard capture system.
 *
 * Commands:
 *   /help       — list all commands
 *   /report     — full dashboard (all visualizations)
 *   /kpi        — KPI cards only
 *   /regional   — regional progress bar chart
 *   /vendor     — vendor performance chart
 *   /map        — site map + regional bubble map
 *   /issues     — delay causes chart
 *   /insight    — text-based insight from live API data
 *
 * Required env vars:
 *   TELEGRAM_BOT_TOKEN
 *   TELEGRAM_CHAT_ID
 *
 * Optional env vars:
 *   DASHBOARD_URL   (default: http://localhost:5173)
 *   API_BASE_URL    (default: http://localhost:5173/api)
 */

'use strict';

const TelegramBot = require('node-telegram-bot-api');
const { exec }    = require('child_process');
const axios       = require('axios');
const path        = require('path');

// ─── CONFIG ───────────────────────────────────────────────────────────────────
const BOT_TOKEN     = process.env.TELEGRAM_BOT_TOKEN;
const ALLOWED_ID    = String(process.env.TELEGRAM_CHAT_ID || '').trim();
const DASHBOARD_URL = process.env.DASHBOARD_URL  || 'http://localhost:5173';
const API_BASE_URL  = process.env.API_BASE_URL   || 'http://localhost:5173/api';

const SCRIPT_FULL     = path.resolve(__dirname, 'capture-and-send.js');
const SCRIPT_FILTERED = path.resolve(__dirname, 'capture-filtered.js');

if (!BOT_TOKEN)  { console.error('[bot] TELEGRAM_BOT_TOKEN not set. Exiting.'); process.exit(1); }
if (!ALLOWED_ID) { console.error('[bot] TELEGRAM_CHAT_ID not set. Exiting.');   process.exit(1); }

// ─── COMMAND REGISTRY ─────────────────────────────────────────────────────────
// Each entry drives both the /help text and the handler routing.
const COMMANDS = [
  {
    cmd:   '/help',
    emoji: '📋',
    desc:  'Show this help message',
  },
  {
    cmd:   '/report',
    emoji: '📊',
    desc:  'Send full dashboard (all visualizations)',
  },
  {
    cmd:   '/kpi',
    emoji: '🔢',
    desc:  'KPI summary cards',
    vizIds: ['viz-kpi'],
  },
  {
    cmd:   '/regional',
    emoji: '🗂',
    desc:  'Regional progress bar chart',
    vizIds: ['viz-regional-bar'],
  },
  {
    cmd:   '/vendor',
    emoji: '🏭',
    desc:  'Vendor performance chart',
    vizIds: ['viz-vendor'],
  },
  {
    cmd:   '/map',
    emoji: '🗺️',
    desc:  'Site map + regional bubble map',
    vizIds: ['viz-map-site', 'viz-map-region'],
  },
  {
    cmd:   '/issues',
    emoji: '⚠️',
    desc:  'Delay causes chart',
    vizIds: ['viz-issues'],
  },
  {
    cmd:   '/insight',
    emoji: '💡',
    desc:  'Text-based insight from live data',
  },
];

const HELP_TEXT = [
  '📊 *Dashboard Bot — Available Commands*\n',
  ...COMMANDS.map(c => `${c.emoji} \`${c.cmd}\` — ${c.desc}`),
].join('\n');

// ─── BOT INIT ─────────────────────────────────────────────────────────────────
const bot = new TelegramBot(BOT_TOKEN, { polling: true });

console.log('[bot] Polling started.');
console.log(`[bot] Authorized chat ID : ${ALLOWED_ID}`);
console.log(`[bot] Dashboard URL      : ${DASHBOARD_URL}`);
console.log(`[bot] API base URL       : ${API_BASE_URL}`);

// ─── CONCURRENCY GUARD ────────────────────────────────────────────────────────
let isRunning = false;

// ─── SHARED ENV FOR CHILD PROCESSES ──────────────────────────────────────────
function childEnv() {
  return {
    ...process.env,
    TELEGRAM_BOT_TOKEN : BOT_TOKEN,
    TELEGRAM_CHAT_ID   : ALLOWED_ID,
    DASHBOARD_URL      : DASHBOARD_URL,
  };
}

// ─── HELPERS ──────────────────────────────────────────────────────────────────
function log(icon, msg) { console.log(`${icon}  ${msg}`); }

/** Run a shell command, resolve on exit, reject on non-zero code */
function runScript(command) {
  return new Promise((resolve, reject) => {
    log('▶️', `Executing: ${command}`);
    exec(command, { env: childEnv(), maxBuffer: 10 * 1024 * 1024 }, (err, stdout, stderr) => {
      if (stdout) console.log('[stdout]\n' + stdout.trim());
      if (stderr) console.error('[stderr]\n' + stderr.trim());
      if (err) reject(err);
      else resolve();
    });
  });
}

/** Auth check — returns true if allowed, sends "Unauthorized" and returns false otherwise */
async function authorize(chatId, fromUser) {
  if (chatId === ALLOWED_ID) return true;
  console.warn(`[bot] Unauthorized: chat_id=${chatId} (${fromUser})`);
  await bot.sendMessage(chatId, 'Unauthorized').catch(() => {});
  return false;
}

/** Guard against concurrent capture runs */
async function acquireRun(chatId) {
  if (!isRunning) { isRunning = true; return true; }
  await bot.sendMessage(chatId, '⏳ A report is already running. Please wait.').catch(() => {});
  return false;
}

function releaseRun() { isRunning = false; }

// ─── /help ────────────────────────────────────────────────────────────────────
bot.onText(/\/help/, async (msg) => {
  const chatId   = String(msg.chat.id);
  const fromUser = msg.from?.username || msg.from?.first_name || chatId;
  if (!await authorize(chatId, fromUser)) return;

  log('💬', `/help from ${fromUser}`);
  await bot.sendMessage(chatId, HELP_TEXT, { parse_mode: 'Markdown' }).catch(console.error);
});

// ─── /report — full capture ───────────────────────────────────────────────────
bot.onText(/\/report/, async (msg) => {
  const chatId   = String(msg.chat.id);
  const fromUser = msg.from?.username || msg.from?.first_name || chatId;
  if (!await authorize(chatId, fromUser)) return;
  if (!await acquireRun(chatId)) return;

  log('📊', `/report from ${fromUser}`);
  await bot.sendMessage(chatId, '⏳ Generating full dashboard report...').catch(console.error);

  try {
    await runScript(`node "${SCRIPT_FULL}"`);
    await bot.sendMessage(chatId, '✅ Done').catch(console.error);
  } catch (err) {
    log('❌', `report failed: ${err.message}`);
    await bot.sendMessage(chatId, '❌ Failed to generate report').catch(console.error);
  } finally {
    releaseRun();
  }
});

// ─── FILTERED COMMANDS ────────────────────────────────────────────────────────
// Dynamically register a handler for every command that has vizIds
for (const cmd of COMMANDS.filter(c => c.vizIds)) {
  const pattern = new RegExp(`\\${cmd.cmd}(?:\\s|$)`);

  bot.onText(pattern, async (msg) => {
    const chatId   = String(msg.chat.id);
    const fromUser = msg.from?.username || msg.from?.first_name || chatId;
    if (!await authorize(chatId, fromUser)) return;
    if (!await acquireRun(chatId)) return;

    log(cmd.emoji, `${cmd.cmd} from ${fromUser} → ${cmd.vizIds.join(', ')}`);
    await bot.sendMessage(chatId, `⏳ Generating: ${cmd.desc}...`).catch(console.error);

    const vizArg = cmd.vizIds.join(',');
    const command = `node "${SCRIPT_FILTERED}" --viz=${vizArg}`;

    try {
      await runScript(command);
      await bot.sendMessage(chatId, '✅ Done').catch(console.error);
    } catch (err) {
      log('❌', `${cmd.cmd} failed: ${err.message}`);
      await bot.sendMessage(chatId, '❌ Failed').catch(console.error);
    } finally {
      releaseRun();
    }
  });
}

// ─── /insight — text-based analysis from live API ────────────────────────────
bot.onText(/\/insight/, async (msg) => {
  const chatId   = String(msg.chat.id);
  const fromUser = msg.from?.username || msg.from?.first_name || chatId;
  if (!await authorize(chatId, fromUser)) return;

  log('💡', `/insight from ${fromUser}`);
  await bot.sendMessage(chatId, '⏳ Fetching insight data...').catch(console.error);

  try {
    const text = await buildInsightText();
    await bot.sendMessage(chatId, text, { parse_mode: 'Markdown' }).catch(console.error);
  } catch (err) {
    log('❌', `insight failed: ${err.message}`);
    await bot.sendMessage(chatId, '❌ Failed to fetch insight data').catch(console.error);
  }
});

// ─── INSIGHT BUILDER ─────────────────────────────────────────────────────────
async function buildInsightText() {
  let insights;

  try {
    const res = await axios.get(`${API_BASE_URL}/auto-insights`, { timeout: 8000 });
    insights = res.data?.data;
  } catch (err) {
    log('❌', `auto-insights fetch failed: ${err.message}`);
    return '⚠️ Failed to fetch insight data';
  }

  if (!Array.isArray(insights) || insights.length === 0) {
    return '⚠️ No insight data available';
  }

  return ['📊 Dashboard Insights', '', ...insights].join('\n');
}

// ─── UNKNOWN COMMAND ──────────────────────────────────────────────────────────
bot.on('message', async (msg) => {
  const chatId = String(msg.chat.id);
  const text   = (msg.text || '').trim();

  // Only respond to slash commands we don't recognize
  if (!text.startsWith('/')) return;

  const knownCmds = COMMANDS.map(c => c.cmd);
  const isKnown   = knownCmds.some(c => text.startsWith(c));
  if (isKnown) return;

  if (chatId !== ALLOWED_ID) {
    await bot.sendMessage(chatId, 'Unauthorized').catch(() => {});
    return;
  }

  await bot.sendMessage(
    chatId,
    `❓ Unknown command: \`${text}\`\nSend /help to see available commands.`,
    { parse_mode: 'Markdown' }
  ).catch(console.error);
});

// ─── POLLING ERROR HANDLER ────────────────────────────────────────────────────
bot.on('polling_error', (err) => {
  console.error('[bot] Polling error:', err.code || err.message || err);
});

// ─── GRACEFUL SHUTDOWN ────────────────────────────────────────────────────────
function shutdown(signal) {
  console.log(`\n[bot] ${signal} received — stopping polling...`);
  bot.stopPolling().then(() => {
    console.log('[bot] Stopped. Goodbye.');
    process.exit(0);
  });
}

process.on('SIGINT',  () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
