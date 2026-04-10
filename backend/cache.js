const { fetchAllSheets } = require('./sheetsService');
const { processAll } = require('./transform');

let cache = null;
let lastUpdated = null;
let isLoading = false;
let lastError = null;
let stepFailed = null;

async function refresh() {
  if (isLoading) return;
  isLoading = true;
  lastError = null;
  stepFailed = null;

  try {
    console.log('[cache] Refreshing data from Google Sheets...');
    const raw = await fetchAllSheets();
    cache = processAll(raw);
    lastUpdated = new Date().toISOString();
    console.log(`[cache] ✓ Data refreshed at ${lastUpdated} — ${cache.raw?.length ?? 0} total rows`);
  } catch (err) {
    lastError = err.message;

    // Classify which step failed for better API error responses
    if (err.message.includes('[env]')) stepFailed = 'environment';
    else if (err.message.includes('[auth]')) stepFailed = 'auth';
    else if (err.message.includes('[sheets]')) stepFailed = 'fetch';
    else stepFailed = 'unknown';

    console.error(`[cache] ✗ Refresh failed (step: ${stepFailed}):\n${err.message}`);
  } finally {
    isLoading = false;
  }
}

function getCache() {
  return { data: cache, lastUpdated, lastError, stepFailed };
}

async function startAutoRefresh(intervalMs = 10000) {
  // Await the initial load so server startup logs show result
  await refresh();
  setInterval(() => refresh(), intervalMs);
}

module.exports = { getCache, startAutoRefresh, refresh };
