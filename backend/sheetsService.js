const path = require('path');
const fs = require('fs');

require('dotenv').config({ path: path.join(__dirname, '.env') });

const { google } = require('googleapis');

// ── Credentials path resolver ────────────────────────────────────────────────
function resolveCredentialsPath() {
  const raw = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (!raw) throw new Error('[auth] GOOGLE_APPLICATION_CREDENTIALS is not set in backend/.env');

  const candidates = [
    path.resolve(__dirname, raw),
    path.resolve(process.cwd(), raw),
    path.resolve(__dirname, '..', raw),
    path.resolve(__dirname, 'credentials.json'),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) { console.log(`[auth] Credentials FOUND: ${c}`); return c; }
    console.log(`[auth] Not found: ${c}`);
  }
  throw new Error(`[auth] Credentials NOT FOUND. Tried:\n${candidates.join('\n')}`);
}

// ── Auth ─────────────────────────────────────────────────────────────────────
async function getAuth() {
  if (!process.env.SPREADSHEET_ID) throw new Error('[env] SPREADSHEET_ID not set in backend/.env');
  console.log('[env] SPREADSHEET_ID =', process.env.SPREADSHEET_ID);

  const credPath = resolveCredentialsPath();
  let creds;
  try { creds = JSON.parse(fs.readFileSync(credPath, 'utf8')); }
  catch (e) { throw new Error(`[auth] Failed to parse credentials.json: ${e.message}`); }

  if (!creds.client_email || !creds.private_key)
    throw new Error('[auth] credentials.json missing client_email or private_key');

  console.log(`[auth] Authenticating as: ${creds.client_email}`);
  const auth = new google.auth.JWT(
    creds.client_email, null, creds.private_key,
    ['https://www.googleapis.com/auth/spreadsheets.readonly']
  );
  try {
    await auth.authorize();
    console.log('[auth] JWT authorization OK');
  } catch (err) {
    const d = err.response?.data || err.message;
    const hint = (d?.error === 'invalid_grant') ? ' → Regenerate service account key or sync clock.'
      : (String(d).includes('PERMISSION_DENIED')) ? ' → Share spreadsheet with service account email.'
      : '';
    throw new Error(`[auth] Authorization failed: ${JSON.stringify(d)}${hint}`);
  }
  return auth;
}

// ── Header detection: scan first 10 rows for the real header row ─────────────
// A row qualifies as header if it contains ≥2 known column keywords.
const HEADER_KEYWORDS = [
  'region', 'regional', 'site', 'status', 'vendor', 'pic', 'progress',
  'area', 'cluster', 'issue', 'remark', 'plan', 'actual', 'date',
  'engineer', 'owner', 'partner', 'completion', 'node', 'duid', 'du',
  'approval', 'doc', 'qc', 'reject', 'percent', '%',
];

function detectHeaderRow(rows) {
  const scanLimit = Math.min(10, rows.length);
  let bestIdx = 0;
  let bestScore = 0;

  for (let i = 0; i < scanLimit; i++) {
    const row = rows[i];
    if (!row || row.length === 0) continue;
    const score = row.filter(cell => {
      if (!cell) return false;
      const c = String(cell).toLowerCase().trim();
      return HEADER_KEYWORDS.some(kw => c.includes(kw));
    }).length;
    if (score > bestScore) { bestScore = score; bestIdx = i; }
  }

  console.log(`[sheets] Header detected at row index ${bestIdx} (score: ${bestScore})`);
  return bestIdx;
}

// ── Fetch all sheets ─────────────────────────────────────────────────────────
async function fetchAllSheets() {
  console.log('[sheets] Starting fetch...');
  const auth = await getAuth();
  const sheets = google.sheets({ version: 'v4', auth });
  const spreadsheetId = process.env.SPREADSHEET_ID;

  let meta;
  try {
    meta = await sheets.spreadsheets.get({ spreadsheetId });
  } catch (err) {
    const d = err.response?.data || err.message;
    throw new Error(`[sheets] spreadsheets.get failed: ${JSON.stringify(d)}\nShare the spreadsheet with the service account.`);
  }

  const sheetNames = meta.data.sheets.map(s => s.properties.title);
  console.log(`[sheets] Found ${sheetNames.length} sheet(s): ${sheetNames.join(', ')}`);

  const result = [];

  for (const name of sheetNames) {
    try {
      const res = await sheets.spreadsheets.values.get({ spreadsheetId, range: name });
      const rows = res.data.values || [];

      if (rows.length === 0) { console.warn(`[sheets] "${name}" empty — skip`); continue; }

      // Detect real header row (not always row 0)
      const headerIdx = detectHeaderRow(rows);
      const headers = rows[headerIdx].map(h => String(h ?? '').trim());
      const dataRows = rows.slice(headerIdx + 1);

      if (dataRows.length === 0) { console.warn(`[sheets] "${name}" has header but no data — skip`); continue; }

      console.log(`[sheets] "${name}": headers=[${headers.join(' | ')}]`);

      const data = dataRows.map(row =>
        headers.reduce((obj, h, i) => {
          const val = (row[i] !== undefined && row[i] !== '') ? row[i] : null;
          obj[h] = val === null ? { value: null, isNull: true } : val;
          return obj;
        }, {})
      );

      // Validation log
      const nonEmpty = data.filter(r => Object.values(r).some(v => !(v && typeof v === 'object' && v.isNull)));
      console.log(`[sheets] "${name}": ${data.length} rows (${nonEmpty.length} non-empty)`);
      result.push({ sheet: name, headers, data });
    } catch (err) {
      const d = err.response?.data || err.message;
      console.error(`[sheets] Failed to fetch "${name}": ${JSON.stringify(d)} — skipping`);
    }
  }

  if (result.length === 0)
    throw new Error('[sheets] No sheets returned data. Check contents and permissions.');

  console.log(`[sheets] Fetch complete: ${result.length} sheet(s) with data`);
  return result;
}

module.exports = { fetchAllSheets };
