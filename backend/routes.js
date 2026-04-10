const express = require('express');
const { getCache } = require('./cache');
const router = express.Router();

function respond(res, data) {
  const { lastUpdated, lastError, stepFailed } = getCache();

  if (!data) {
    return res.status(503).json({
      error: lastError || 'Cache not populated yet — server may still be loading.',
      step_failed: stepFailed || 'unknown',
      hint: lastError
        ? 'Check backend console logs for details.'
        : 'Wait a few seconds and retry. If this persists, check backend logs.',
    });
  }

  res.json({ lastUpdated, data });
}

router.get('/summary', (req, res) => {
  const { data } = getCache();
  respond(res, data?.summary);
});

router.get('/progress', (req, res) => {
  const { data } = getCache();
  const payload = data
    ? { by_region: data.progress_by_region, plan_vs_actual: data.plan_vs_actual, distribution: data.progress_distribution }
    : null;
  respond(res, payload);
});

router.get('/vendor', (req, res) => {
  const { data } = getCache();
  respond(res, data?.vendor_performance);
});

router.get('/delay', (req, res) => {
  const { data } = getCache();
  respond(res, data?.delay_reasons);
});

router.get('/pic', (req, res) => {
  const { data } = getCache();
  respond(res, data?.workload_per_pic);
});

router.get('/raw', (req, res) => {
  const { data } = getCache();
  respond(res, data?.raw);
});

router.get('/insights', (req, res) => {
  const { data } = getCache();
  respond(res, data?.insights);
});

router.get('/map', (req, res) => {
  const { data } = getCache();
  respond(res, data?.region_map);
});

router.get('/map-points', (req, res) => {
  const { data } = getCache();
  respond(res, data?.map_points);
});

router.get('/auto-insights', (req, res) => {
  const { data } = getCache();
  respond(res, data?.auto_insights);
});

router.get('/region-debug', (req, res) => {
  const { data } = getCache();
  respond(res, data?.region_debug);
});

// Health / debug endpoint
router.get('/health', (req, res) => {
  const { data, lastUpdated, lastError, stepFailed } = getCache();
  res.json({
    status: data ? 'ok' : 'not_ready',
    lastUpdated,
    rowCount: data?.raw?.length ?? 0,
    lastError: lastError || null,
    stepFailed: stepFailed || null,
  });
});

module.exports = router;
