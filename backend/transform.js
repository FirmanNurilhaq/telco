const dayjs = require('dayjs');
const customParseFormat = require('dayjs/plugin/customParseFormat');
dayjs.extend(customParseFormat);

// ─────────────────────────────────────────────────────────────────────────────
// COLUMN MAP  (canonical key → all known raw header variants, lowercase)
// ─────────────────────────────────────────────────────────────────────────────
const COL_MAP = {
  site_id: [
    'site id','siteid','site_id','site name','sitename','site no','site number',
    'ne id','neid','node','node id','nodeid','id','site',
    'cell id','cellid','enodeb id','enodeb','gnodeb','gnb id',
    'nama site','nama_site','duid','du id','du_id','du name','duname',
    'network element','ne name','nename',
  ],
  region:   ['region','regional','area region','wilayah','reg','area regional','regional area','zona','zone','region name','region_name','nama region','nama wilayah'],
  area:     ['area','city','cluster','kota','kabupaten','kab','sub area','subarea','area name','cluster name','lokasi'],
  // Generic status — will be supplemented by qc_status / approval_status below
  status:   ['status','progress status','remark status','site status','kondisi','state','current status','sts','stat'],
  // Process-specific status columns — kept separate so deriveStatus() can use them
  qc_status:       ['qc status','qc result','rf status','rf result','qc rf status','validation status','check status'],
  approval_status: ['approval status','approved status','doc status','review status','acceptance status','integration status'],
  // Telco pipeline milestone columns (Rule 3 fallback completion check)
  rf_cat_issue:    ['rf cat issue level 2','rf cat issue','rf category issue','rf issue level 2','issue level 2','cat issue level 2'],
  qc_rf_date:      ['qc rf date','qc date','rf date','rf acceptance date','qc acceptance date'],
  dt_date:         ['dt date','drive test date','dt completion','drive test completion','lv date','lv completion'],
  connected_date:  ['connected date','on air date','on-air date','integration date','connected','on air','onair date'],
  progress: ['%','progress','completion','percentage','pct','percent','progress %','completion %','% progress','progress(%)'],
  plan_date:[
    'plan','plan date','plan_date','target date','plan finish','planned date','target finish',
    'rencana','rencana selesai','target','plan complete','scheduled date','plan end',
    'qc rf date','qc date','rf date','m06 date','integration date','lv date','drive test date',
  ],
  actual_date:[
    'actual','actual date','actual_date','done date','completion date','finish date',
    'tanggal selesai','realisasi','actual finish','actual complete','real date','completed date',
    'approval time','approved date','approval date','accepted date','acceptance date','on air date',
  ],
  vendor:  ['vendor','partner','mitra','kontraktor','contractor','sub vendor','subvendor','vendor name','partner name'],
  pic:     [
    'pic','engineer','owner','person in charge','penanggung jawab','pj','assigned to','assignee',
    'teknisi','field engineer','fe','pm','project manager',
    'doc review pic','review pic','qc pic','checker','reviewer','doc pic','rf pic','acceptance pic',
  ],
  issue:   [
    'issue','issues','problem','remark','remarks','notes','note',
    'catatan','kendala','hambatan','blocker','keterangan','ket','comment','comments','description',
    'reject remark','rejection reason','reject reason','reject note',
    'doc remark','qc remark','review remark','finding',
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// REGION LOOKUP  (abbrev → { name, coords })
// ─────────────────────────────────────────────────────────────────────────────
const REGION_LOOKUP = {
  jabar:      { name:'Jawa Barat',              coords:[-6.9,107.6] },
  wj:         { name:'Jawa Barat',              coords:[-6.9,107.6] },
  westjava:   { name:'Jawa Barat',              coords:[-6.9,107.6] },
  jateng:     { name:'Jawa Tengah',             coords:[-7.0,110.4] },
  cj:         { name:'Jawa Tengah',             coords:[-7.0,110.4] },
  centraljava:{ name:'Jawa Tengah',             coords:[-7.0,110.4] },
  jatim:      { name:'Jawa Timur',              coords:[-7.5,112.7] },
  ej:         { name:'Jawa Timur',              coords:[-7.5,112.7] },
  eastjava:   { name:'Jawa Timur',              coords:[-7.5,112.7] },
  jabotabek:  { name:'Jabotabek',               coords:[-6.2,106.8] },
  jabodetabek:{ name:'Jabotabek',               coords:[-6.2,106.8] },
  jabo:       { name:'Jabotabek',               coords:[-6.2,106.8] },
  jakarta:    { name:'Jakarta',                 coords:[-6.2,106.8] },
  banten:     { name:'Banten',                  coords:[-6.4,106.1] },
  diy:        { name:'DI Yogyakarta',           coords:[-7.8,110.4] },
  yogya:      { name:'DI Yogyakarta',           coords:[-7.8,110.4] },
  yogyakarta: { name:'DI Yogyakarta',           coords:[-7.8,110.4] },
  sumbagut:   { name:'Sumatera Bagian Utara',   coords:[3.6,98.7]   },
  sumbagsel:  { name:'Sumatera Bagian Selatan', coords:[-3.3,104.0] },
  sumbarteng: { name:'Sumatera Bagian Tengah',  coords:[-0.9,100.4] },
  sumut:      { name:'Sumatera Utara',          coords:[2.1,99.5]   },
  sumsel:     { name:'Sumatera Selatan',        coords:[-3.3,104.0] },
  sumbar:     { name:'Sumatera Barat',          coords:[-0.9,100.4] },
  riau:       { name:'Riau',                    coords:[0.5,101.4]  },
  kepri:      { name:'Kepulauan Riau',          coords:[1.0,104.0]  },
  aceh:       { name:'Aceh',                    coords:[4.7,96.7]   },
  lampung:    { name:'Lampung',                 coords:[-5.4,105.3] },
  bengkulu:   { name:'Bengkulu',                coords:[-3.8,102.3] },
  jambi:      { name:'Jambi',                   coords:[-1.6,103.6] },
  babel:      { name:'Bangka Belitung',         coords:[-2.7,106.1] },
  kalbar:     { name:'Kalimantan Barat',        coords:[0.0,109.3]  },
  kalteng:    { name:'Kalimantan Tengah',       coords:[-1.7,113.9] },
  kaltim:     { name:'Kalimantan Timur',        coords:[0.5,116.4]  },
  kalsel:     { name:'Kalimantan Selatan',      coords:[-3.1,115.3] },
  kaltara:    { name:'Kalimantan Utara',        coords:[3.1,116.0]  },
  sulsel:     { name:'Sulawesi Selatan',        coords:[-3.7,120.0] },
  sulut:      { name:'Sulawesi Utara',          coords:[1.5,124.8]  },
  sulteng:    { name:'Sulawesi Tengah',         coords:[-1.4,121.4] },
  sultra:     { name:'Sulawesi Tenggara',       coords:[-4.1,122.5] },
  sulbar:     { name:'Sulawesi Barat',          coords:[-2.8,119.4] },
  gorontalo:  { name:'Gorontalo',               coords:[0.7,122.4]  },
  maluku:     { name:'Maluku',                  coords:[-3.2,130.1] },
  malut:      { name:'Maluku Utara',            coords:[1.6,127.8]  },
  papua:      { name:'Papua',                   coords:[-4.3,138.1] },
  papbar:     { name:'Papua Barat',             coords:[-1.3,133.2] },
  bali:       { name:'Bali',                    coords:[-8.4,115.2] },
  ntt:        { name:'Nusa Tenggara Timur',     coords:[-8.7,121.1] },
  ntb:        { name:'Nusa Tenggara Barat',     coords:[-8.6,117.4] },
  national:   { name:'National',                coords:[-2.5,118.0] },
  nasional:   { name:'National',                coords:[-2.5,118.0] },
};

const VENDOR_MAP = {
  huawei:'Huawei', zte:'ZTE', ericsson:'Ericsson', nokia:'Nokia',
  samsung:'Samsung', nec:'NEC', fiberhome:'FiberHome', ciena:'Ciena',
};
const VENDOR_PATTERNS = [
  { pattern:/\bhuawei\b/i,  name:'Huawei'   },
  { pattern:/\bzte\b/i,     name:'ZTE'      },
  { pattern:/\bericsson\b/i,name:'Ericsson' },
  { pattern:/\bnokia\b/i,   name:'Nokia'    },
  { pattern:/\bsamsung\b/i, name:'Samsung'  },
  { pattern:/^(EPO|EPE|GSK|BTU|MTR|NTG|BLI|MGW|KLK|GIN|TAB|SGR|PYA|SBW)/i, name:'Huawei'   },
  { pattern:/^(JKT|JKP|JKU|JKB|JSX|JTX|JPX|BKS|BKX|CKR|CBN|DMK|EPG)/i,    name:'Ericsson' },
];

const UNKNOWN_LABELS = ['unknown vendor','unknown region','unassigned','unknown','n/a','-',''];

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────
function getRaw(val) {
  if (val === null || val === undefined) return null;
  if (typeof val === 'object' && val.isNull) return null;
  return val;
}
function isNullish(val) {
  const raw = getRaw(val);
  if (raw === null) return true;
  const s = String(raw).trim();
  return s === '' || s === '-' || s.toLowerCase() === 'n/a' || s.toLowerCase() === 'null' || s === '#N/A' || s === '#REF!';
}
function nullCell() { return { value: null, isNull: true }; }
function safeStr(val) {
  if (isNullish(val)) return null;
  return String(getRaw(val)).trim();
}
function rankWithUnknownLast(arr, keyField) {
  const real    = arr.filter(r => !UNKNOWN_LABELS.includes(String(r[keyField]||'').toLowerCase().trim()));
  const unknown = arr.filter(r =>  UNKNOWN_LABELS.includes(String(r[keyField]||'').toLowerCase().trim()));
  return [...real, ...unknown];
}

// ─────────────────────────────────────────────────────────────────────────────
// HEADER → CANONICAL KEY  (3-pass fuzzy)
// ─────────────────────────────────────────────────────────────────────────────
function normalizeHeader(header) {
  const h = String(header).toLowerCase().trim().replace(/\s+/g,' ');
  for (const [key, aliases] of Object.entries(COL_MAP)) {
    if (aliases.includes(h)) return key;
  }
  for (const [key, aliases] of Object.entries(COL_MAP)) {
    if (aliases.some(a => h.includes(a) || a.includes(h))) return key;
  }
  const words = h.split(/\s+/);
  for (const [key, aliases] of Object.entries(COL_MAP)) {
    for (const a of aliases) {
      if (words.some(w => a.split(/\s+/).includes(w) && w.length > 2)) return key;
    }
  }
  return h.replace(/\s+/g,'_');
}

// ─────────────────────────────────────────────────────────────────────────────
// VALUE NORMALIZERS
// ─────────────────────────────────────────────────────────────────────────────
function normalizeStatusStr(val) {
  if (isNullish(val)) return null;
  const s = String(getRaw(val)).toLowerCase().trim();

  // Exact / near-exact matches first — most reliable
  if (/^(done|complete|completed|finish|finished|selesai|sukses|success|approved|accepted|on.?air|pass|passed|ok)$/.test(s))
    return 'completed';
  if (/^(on.?progress|in.?progress|ongoing|wip|berjalan|proses|sedang|running|approving|reviewing|under.?review|on.?review)$/.test(s))
    return 'on_progress';
  // Only hard delay keywords — not "pending", not "hold" alone
  if (/^(delay|delayed|late|terlambat|blocked|stuck|tertunda|rejected|reject|failed|fail|cancel|cancelled)$/.test(s))
    return 'delayed';
  if (/^(not.?start|not.?started|belum.?mulai|open|new|todo|planned)$/.test(s))
    return 'not_started';

  // Keyword fallback — only clear signals
  if (s.includes('approv') && !s.includes('reject')) return s.includes('ing') ? 'on_progress' : 'completed';
  if (s.includes('pass') && !s.includes('fail'))     return 'completed';
  if (s.includes('done') || s.includes('complete') || s.includes('finish') || s.includes('selesai')) return 'completed';
  if (s.includes('reject') || s.includes('cancel'))  return 'delayed';
  if (s.includes('progress') || s.includes('ongoing') || s.includes('review')) return 'on_progress';
  if (s.includes('delay') || s.includes('blocked'))  return 'delayed';

  return null; // unknown — let deriveStatus continue down the chain
}

const CRITICAL_ISSUE_KEYWORDS = ['reject','rejected','failed','failure','blocked','on hold','on-hold','cancel','cancelled','pending approval'];

function containsCriticalIssue(issueText) {
  if (!issueText) return false;
  const lower = issueText.toLowerCase();
  return CRITICAL_ISSUE_KEYWORDS.some(k => lower.includes(k));
}

// ─────────────────────────────────────────────────────────────────────────────
// DERIVE STATUS  — RF Category state machine (primary driver)
//
// RF Cat Issue Level 2 numeric prefix defines pipeline stage:
//   >= 8.2  → completed        (QC Accepted / formal closure)
//   >= 7.0  → on_progress      (QC stage)
//   >= 5.0  → on_progress      (execution stage)
//   >= 4.0  → delayed          (issue stage)
//   >= 2.0  → on_progress      (early stage)
//   <  2.0  → not_started
//
// Approval status overrides to completed regardless of RF category.
// Fallback (no RF category): qc → progress → issue → default.
// ─────────────────────────────────────────────────────────────────────────────

// Extract first numeric value ANYWHERE in RF Cat string e.g. "Level 4.1 Alarm" → 4.1
function parseRfCatLevel(val) {
  if (isNullish(val)) return null;
  const raw = String(getRaw(val)).trim();
  const match = raw.match(/(\d+(?:\.\d+)?)/); // first number anywhere in string
  if (!match) return null;
  const n = parseFloat(match[1]);
  return isNaN(n) ? null : n;
}

function deriveStatus(merged) {
  const approval = (safeStr(merged.approval_status) || '').toLowerCase();
  const progress = parseProgressNum(merged.progress);
  const issue    = (safeStr(merged.issue)           || '').toLowerCase();

  // APPROVAL OVERRIDE — wins over everything including RF category
  if (approval.includes('approv') || approval.includes('accepted'))
    return { status: 'completed', source: 'approval' };

  // RF CATEGORY STATE MACHINE — primary driver when present
  const rfLevel = parseRfCatLevel(merged.rf_cat_issue);
  if (rfLevel !== null) {
    if (rfLevel >= 8.2) return { status: 'completed',   source: 'rf_cat' };
    if (rfLevel >= 7.0) return { status: 'on_progress', source: 'rf_cat' }; // QC stage
    if (rfLevel >= 5.0) return { status: 'on_progress', source: 'rf_cat' }; // execution
    if (rfLevel >= 4.0) return { status: 'delayed',     source: 'rf_cat' }; // issue stage
    if (rfLevel >= 2.0) return { status: 'on_progress', source: 'rf_cat' }; // early stage
    return { status: 'not_started', source: 'rf_cat' };
  }

  // FALLBACK — no RF category, use secondary signals
  const qc = (safeStr(merged.qc_status) || '').toLowerCase();
  if (qc.includes('pass') || qc.includes('done') || qc.includes('ok') || qc.includes('complete'))
    return { status: 'on_progress', source: 'qc_passed' };

  if (progress !== null && progress > 0)
    return { status: 'on_progress', source: 'progress' };

  if (issue && containsCriticalIssue(issue))
    return { status: 'delayed', source: 'issue' };

  if (issue && !containsCriticalIssue(issue))
    return { status: 'on_progress', source: 'issue_non_critical' };

  return { status: 'not_started', source: 'default' };
}

function parseProgressNum(val) {
  if (isNullish(val)) return null;
  const raw = String(getRaw(val)).replace('%','').trim();
  const n = parseFloat(raw);
  return isNaN(n) ? null : Math.min(100, Math.max(0, n));
}

// Explicit short-code aliases not covered by REGION_LOOKUP keys
const REGION_ALIAS_MAP = {
  // Short codes used in region fields
  'wj':          'Jawa Barat',
  'ej':          'Jawa Timur',
  'cj':          'Jawa Tengah',
  'nj':          'Jabotabek',
  'jabar':       'Jawa Barat',
  'jatim':       'Jawa Timur',
  'jateng':      'Jawa Tengah',
  'jabotabek':   'Jabotabek',
  'jabo':        'Jabotabek',
  'jabodetabek': 'Jabotabek',
  'bali':        'Bali',
  'ntb':         'Nusa Tenggara Barat',
  'ntt':         'Nusa Tenggara Timur',
  'sumut':       'Sumatera Utara',
  'sumsel':      'Sumatera Selatan',
  'sumbar':      'Sumatera Barat',
  'sumbagut':    'Sumatera Bagian Utara',
  'sumbagsel':   'Sumatera Bagian Selatan',
  'kalbar':      'Kalimantan Barat',
  'kaltim':      'Kalimantan Timur',
  'kalteng':     'Kalimantan Tengah',
  'kalsel':      'Kalimantan Selatan',
  'kaltara':     'Kalimantan Utara',
  'sulsel':      'Sulawesi Selatan',
  'sulut':       'Sulawesi Utara',
  'sulteng':     'Sulawesi Tengah',
  'sultra':      'Sulawesi Tenggara',
  'sulbar':      'Sulawesi Barat',
  'papua':       'Papua',
  'papbar':      'Papua Barat',
  'maluku':      'Maluku',
  'malut':       'Maluku Utara',
  'aceh':        'Aceh',
  'riau':        'Riau',
  'kepri':       'Kepulauan Riau',
  'lampung':     'Lampung',
  'jambi':       'Jambi',
  'babel':       'Bangka Belitung',
  'bengkulu':    'Bengkulu',
  'gorontalo':   'Gorontalo',
  // Tokens commonly found as LAST segment of site_id (Layer 2)
  'jabo2':       'Jabotabek',
  'jabotabek2':  'Jabotabek',
  'dis':         null,   // "Dis" = distribution suffix, not a region — ignore
  '208':         null,   // numeric cluster codes — not regions
  '228':         null,
  '222':         null,
  '706':         null,
  '712':         null,
  '683':         null,
  '687':         null,
  '881':         null,
  '483':         null,
};

// Values that are explicitly invalid — treat as null
const INVALID_REGION_VALUES = new Set(['-','n/a','na','null','unknown','none','','tbd','?']);

function normalizeRegion(val) {
  if (isNullish(val)) return null;
  const raw = String(getRaw(val)).trim();
  if (!raw) return null;

  // Reject known invalid placeholders
  if (INVALID_REGION_VALUES.has(raw.toLowerCase())) return null;

  // Strip to alpha-only lowercase key for lookup
  const key = raw.toLowerCase().replace(/[^a-z]/g, '');
  if (!key) return null;

  // 1. Explicit alias map (short codes)
  if (REGION_ALIAS_MAP[key]) return REGION_ALIAS_MAP[key];

  // 2. REGION_LOOKUP exact key match
  if (REGION_LOOKUP[key]) return REGION_LOOKUP[key].name;

  // 3. REGION_LOOKUP partial match (key contains abbr or abbr contains key)
  for (const [abbr, info] of Object.entries(REGION_LOOKUP)) {
    if (key === abbr || key.includes(abbr) || abbr.includes(key)) return info.name;
  }

  // 4. Return original trimmed value (may be a full region name not in lookup)
  return raw;
}

// Layer 2: extract region token from site_id
// Pattern: split by "_", take last token, validate against alias map
function inferRegionFromSiteId(siteId) {
  if (!siteId || typeof siteId !== 'string') return null;
  const tokens = siteId.trim().split('_');
  // Walk tokens from last to first — region token is usually at the end
  for (let i = tokens.length - 1; i >= 0; i--) {
    const token = tokens[i].toLowerCase().replace(/[^a-z0-9]/g, '');
    if (!token) continue;
    // Must exist in alias map AND map to a non-null region
    if (Object.prototype.hasOwnProperty.call(REGION_ALIAS_MAP, token)) {
      const mapped = REGION_ALIAS_MAP[token];
      if (mapped) return mapped; // valid region token
      continue;                  // null entry = known non-region token, skip
    }
    // Also check REGION_LOOKUP
    if (REGION_LOOKUP[token]) return REGION_LOOKUP[token].name;
  }
  return null;
}

function normalizeVendor(val, siteId, issueText) {
  if (!isNullish(val)) {
    const raw = String(getRaw(val)).trim();
    const key = raw.toLowerCase().replace(/[^a-z]/g,'');
    for (const [pattern, name] of Object.entries(VENDOR_MAP)) {
      if (key.includes(pattern)) return { vendor: name, inferred: false };
    }
    if (raw) return { vendor: raw, inferred: false };
  }
  const searchText = `${siteId||''} ${issueText||''}`;
  for (const { pattern, name } of VENDOR_PATTERNS) {
    if (pattern.test(searchText)) return { vendor: name, inferred: true };
  }
  return { vendor: 'Unknown Vendor', inferred: true };
}

// Deterministic hash for stable variation — same site_id always gets same offset
function deterministicHash(key) {
  let hash = 0;
  const s = String(key || '');
  for (let i = 0; i < s.length; i++) {
    hash = s.charCodeAt(i) + ((hash << 5) - hash);
    hash |= 0; // convert to 32-bit int
  }
  return Math.abs(hash);
}

function inferProgress(status, rawVal, rfCatIssue, siteId) {
  // Step 1: use real value if present
  const n = parseProgressNum(rawVal);
  if (n !== null) return { progress: n, inferred: false };

  // Step 2: derive from RF category level (pipeline stage)
  const rfLevel = parseRfCatLevel(rfCatIssue);
  if (rfLevel !== null) {
    const hash = deterministicHash(siteId);
    let base, range;
    if (rfLevel >= 8.2)      { return { progress: 100, inferred: true }; }
    else if (rfLevel >= 7.0) { base = 85; range = 10; }  // QC stage: 85–95
    else if (rfLevel >= 5.0) { base = 50; range = 30; }  // execution: 50–80
    else if (rfLevel >= 4.0) { base = 30; range = 20; }  // issue stage: 30–50
    else if (rfLevel >= 2.0) { base = 10; range = 20; }  // early: 10–30
    else                     { base = 0;  range = 10; }  // pre-start: 0–10
    const progress = Math.min(100, base + (hash % (range + 1)));
    return { progress, inferred: true };
  }

  // Step 3: fallback from status only
  if (status === 'completed')   return { progress: 100, inferred: true };
  if (status === 'not_started') return { progress: 0,   inferred: true };
  if (status === 'on_progress') return { progress: 40,  inferred: true };
  if (status === 'delayed')     return { progress: 25,  inferred: true };
  return { progress: null, inferred: false };
}

const DATE_FORMATS = [
  'DD/MM/YYYY','D/M/YYYY','DD-MM-YYYY','D-M-YYYY',
  'YYYY-MM-DD','YYYY/MM/DD','MM/DD/YYYY','M/D/YYYY',
  'DD MMM YYYY','D MMM YYYY','YYYY-MM-DDTHH:mm:ss',
  'DD/MM/YY','D/M/YY','MM/DD/YY',
];
function parseDate(val) {
  if (isNullish(val)) return null;
  const raw = String(getRaw(val)).trim();
  const serial = parseFloat(raw);
  if (!isNaN(serial) && serial > 40000 && serial < 60000) {
    const d = dayjs(new Date((serial - 25569) * 86400 * 1000));
    if (d.isValid()) return d;
  }
  for (const fmt of DATE_FORMATS) {
    const d = dayjs(raw, fmt, true);
    if (d.isValid()) return d;
  }
  const d = dayjs(raw);
  return d.isValid() ? d : null;
}

function extractIssueKeyword(issueText) {
  if (!issueText) return null; // null = no issue text, do NOT classify
  const t = issueText.toLowerCase().trim();
  if (!t) return null;

  // Ordered: most specific first, "other" only when text exists but nothing matches
  if (['power','listrik','pln','genset','electricity'].some(k => t.includes(k)))
    return 'power';
  if (['material','device','equipment','spare','perangkat'].some(k => t.includes(k)))
    return 'material';
  if (['access','izin','permit','perizinan','entry','akses'].some(k => t.includes(k)))
    return 'access';
  if (['fiber','microwave','mw link','transmission','backbone','link down','transmisi'].some(k => t.includes(k)))
    return 'transmission';
  if (['waiting approval','pending approval','approval','menunggu approval'].some(k => t.includes(k)))
    return 'approval';
  if (['document','doc','dokumen','surat','berkas','imb','isr','report'].some(k => t.includes(k)))
    return 'document';
  if (['install','installation','pasang','pemasangan'].some(k => t.includes(k)))
    return 'installation';
  if (['config','parameter','konfigurasi','setting'].some(k => t.includes(k)))
    return 'config';
  if (['civil','sipil','konstruksi','construction','tower','fondasi'].some(k => t.includes(k)))
    return 'civil';

  return 'other'; // text exists but no keyword matched
}

// ─────────────────────────────────────────────────────────────────────────────
// STEP 1: Parse a single raw row into a flat canonical object
// ─────────────────────────────────────────────────────────────────────────────
function parseRow(rawRow, sheetName) {
  const mapped = { _source_sheets: [sheetName] };
  for (const [origKey, val] of Object.entries(rawRow)) {
    const normKey = normalizeHeader(origKey);
    // Collision: prefer non-null
    if (mapped[normKey] !== undefined && !isNullish(mapped[normKey])) continue;
    mapped[normKey] = val;
  }
  return mapped;
}

// ─────────────────────────────────────────────────────────────────────────────
// STEP 2: CROSS-SHEET MERGE
// Key: site_id (global, not per-sheet)
// When same site_id appears in multiple sheets, merge fields:
//   - prefer non-null values
//   - for status fields, keep ALL (approval_status, qc_status, status) so
//     deriveStatus() can use the richest signal
// ─────────────────────────────────────────────────────────────────────────────
function mergeAcrossSheets(rawSheets) {
  // site_id → merged canonical object
  const siteMap = new Map();
  // Rows with no site_id — kept as-is
  const orphans = [];

  for (const { sheet, data } of rawSheets) {
    for (const rawRow of data) {
      const parsed = parseRow(rawRow, sheet);

      // Resolve site_id
      const siteId = safeStr(parsed.site_id)
        || safeStr(parsed.ne_id) || safeStr(parsed.node) || safeStr(parsed.cell_id) || null;

      if (!siteId) {
        orphans.push(parsed);
        continue;
      }

      const key = siteId.trim().toUpperCase(); // normalize key

      if (!siteMap.has(key)) {
        parsed._site_key = key;
        siteMap.set(key, parsed);
      } else {
        // Merge: for each field in incoming row, fill gaps in existing record
        const existing = siteMap.get(key);
        existing._source_sheets = [...new Set([...existing._source_sheets, sheet])];

        for (const [field, val] of Object.entries(parsed)) {
          if (field === '_source_sheets') continue;
          // Region: never overwrite a valid value with null/invalid
          if (field === 'region') {
            const existingRegion = normalizeRegion(existing[field]);
            const incomingRegion = normalizeRegion(val);
            if (!existingRegion && incomingRegion) existing[field] = val;
            continue;
          }
          // All other fields: fill gaps (prefer non-null)
          if (isNullish(existing[field]) && !isNullish(val)) {
            existing[field] = val;
          }
          // Special: for status-type fields, prefer the most advanced signal
          // (approval_status > qc_status > status)
          if (['approval_status','qc_status','status'].includes(field) && !isNullish(val)) {
            const existingNorm = normalizeStatusStr(safeStr(existing[field]));
            const incomingNorm = normalizeStatusStr(safeStr(val));
            const rank = { completed:4, on_progress:3, delayed:2, not_started:1, null:0 };
            if ((rank[incomingNorm]||0) > (rank[existingNorm]||0)) {
              existing[field] = val;
            }
          }
        }
      }
    }
  }

  const merged = [...siteMap.values(), ...orphans];
  console.log(`[merge] ${siteMap.size} unique sites + ${orphans.length} orphan rows = ${merged.length} total`);
  return merged;
}

// ─────────────────────────────────────────────────────────────────────────────
// STEP 3: Enrich each merged record into a final normalized row
// ─────────────────────────────────────────────────────────────────────────────
function enrichRow(merged) {
  const siteId = safeStr(merged.site_id)
    || safeStr(merged.ne_id) || safeStr(merged.node) || safeStr(merged.cell_id) || null;

  const issueRaw     = safeStr(merged.issue);
  const issueKeyword = extractIssueKeyword(issueRaw);

  // DERIVE STATUS from multiple fields
  const { status, source: statusSource } = deriveStatus(merged);
  const statusInferred = statusSource !== 'status' && statusSource !== 'approval_status' && statusSource !== 'qc_status';

  // Progress
  const { progress, inferred: progressInferred } = inferProgress(status, merged.progress, merged.rf_cat_issue, siteId);

  const planDate   = parseDate(merged.plan_date);
  const actualDate = parseDate(merged.actual_date);

  // 3-layer region resolution
  // Layer 1: direct field normalization
  let region = normalizeRegion(merged.region);
  let regionSource = region ? 'direct' : null;
  // Layer 2: infer from site_id when direct mapping fails
  if (!region && siteId) {
    region = inferRegionFromSiteId(siteId);
    if (region) regionSource = 'site_id';
  }
  // Layer 3: safe fallback — never leave null
  if (!region) { region = 'Unknown Region'; regionSource = 'fallback'; }
  const { vendor, inferred: vendorInferred } = normalizeVendor(merged.vendor, siteId, issueRaw);
  const pic        = safeStr(merged.pic) || 'Unassigned';
  const picInferred= !safeStr(merged.pic);
  const area       = safeStr(merged.area);

  // Delay detection — TWO separate flags:
  // _is_delayed  = status is 'delayed' (used for KPI counting — mutually exclusive)
  // _is_overdue  = date-based overrun (informational, does NOT affect status KPI)
  const isDelayed = (status === 'delayed');
  let isOverdue = false;
  let delayDuration = null;
  if (planDate && actualDate && actualDate.isAfter(planDate)) {
    isOverdue = true;
    delayDuration = actualDate.diff(planDate, 'day');
  } else if (planDate && !actualDate && dayjs().isAfter(planDate) && status !== 'completed') {
    isOverdue = true;
    delayDuration = dayjs().diff(planDate, 'day');
  }
  // Date anomaly: actual before plan
  const dateAnomaly = (planDate && actualDate && actualDate.isBefore(planDate))
    ? `actual_date (${actualDate.format('YYYY-MM-DD')}) is before plan_date (${planDate.format('YYYY-MM-DD')})`
    : null;

  const qualityFlags = [];
  if (!siteId)         qualityFlags.push('missing_site_id');
  if (statusInferred)  qualityFlags.push('inferred_status');
  if (progressInferred)qualityFlags.push('inferred_progress');
  if (!region)         qualityFlags.push('missing_region');
  if (vendorInferred)  qualityFlags.push('inferred_vendor');

  // Confidence score — normalized 0–1
  let rawScore = 0;
  if (!isNullish(merged.approval_status)) rawScore += 2;
  if (!isNullish(merged.qc_status))       rawScore += 2;
  if (parseProgressNum(merged.progress) !== null) rawScore += 1;
  if (issueRaw && containsCriticalIssue(issueRaw)) rawScore -= 1;
  if (statusSource === 'default') rawScore -= 1;
  const confidenceScore = parseFloat(Math.max(0, Math.min(1, rawScore / 5)).toFixed(2));

  return {
    // Display fields
    source_sheet: (merged._source_sheets || []).join(', '),
    site_id:      siteId || nullCell(),
    region:       region || nullCell(),
    area:         area   || nullCell(),
    status:       !isNullish(merged.status)       ? getRaw(merged.status)       : nullCell(),
    qc_status:    !isNullish(merged.qc_status)    ? getRaw(merged.qc_status)    : nullCell(),
    approval_status: !isNullish(merged.approval_status) ? getRaw(merged.approval_status) : nullCell(),
    progress:     !isNullish(merged.progress)     ? getRaw(merged.progress)     : nullCell(),
    plan_date:    !isNullish(merged.plan_date)     ? getRaw(merged.plan_date)    : nullCell(),
    actual_date:  !isNullish(merged.actual_date)   ? getRaw(merged.actual_date)  : nullCell(),
    vendor:       vendor || nullCell(),
    pic:          pic,
    issue:        issueRaw || nullCell(),
    // Computed fields (prefixed _)
    _status:         status,
    _status_source:  statusSource,
    _rf_cat_raw:     safeStr(merged.rf_cat_issue), // raw value for debug/validation
    _progress:       progress,
    _plan_date:      planDate   ? planDate.format('YYYY-MM-DD')   : null,
    _actual_date:    actualDate ? actualDate.format('YYYY-MM-DD') : null,
    _region:         region,
    _region_source:  regionSource,
    _vendor:         vendor,
    _pic:            pic,
    _issue_keyword:  issueKeyword,
    _is_delayed:     isDelayed,   // status === 'delayed' — used for KPI
    _is_overdue:     isOverdue,   // date-based overrun — informational only
    _delay_duration: delayDuration,
    _date_anomaly:   dateAnomaly,
    _quality_flags:  qualityFlags,
    _confidence_score: confidenceScore,
    _inferred: { status: statusInferred, progress: progressInferred, vendor: vendorInferred, pic: picInferred },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// VALIDATION LAYER
// ─────────────────────────────────────────────────────────────────────────────
function validateDataset(rows) {
  const errors = [];
  const warnings = [];
  const total = rows.length;

  // 1. KPI reconciliation — MUST be exact
  const completed   = rows.filter(r => r._status === 'completed').length;
  const on_progress = rows.filter(r => r._status === 'on_progress').length;
  const delayed     = rows.filter(r => r._status === 'delayed').length;
  const not_started = rows.filter(r => r._status === 'not_started').length;
  const total_status = completed + on_progress + delayed + not_started;

  if (total_status !== total) {
    errors.push(`KPI MISMATCH: completed(${completed}) + on_progress(${on_progress}) + delayed(${delayed}) + not_started(${not_started}) = ${total_status} ≠ total(${total}). Rows with unrecognised status: ${total - total_status}`);
  }

  // 2. Duplicate site_ids (should be 0 after merge)
  const siteIds = rows.map(r => typeof r.site_id === 'string' ? r.site_id.toUpperCase() : null).filter(Boolean);
  const uniqueSiteIds = new Set(siteIds);
  const duplicates = siteIds.length - uniqueSiteIds.size;
  if (duplicates > 0) {
    errors.push(`DUPLICATE SITES: ${duplicates} duplicate site_id(s) detected after merge.`);
  }

  // 3. Missing status
  const missingStatus = rows.filter(r => !r._status).length;
  if (missingStatus > 0) {
    errors.push(`MISSING STATUS: ${missingStatus} rows have no derivable status.`);
  }

  // 4. Progress consistency
  const progressViolations = rows.filter(r => {
    if (r._status === 'completed' && r._progress !== null && r._progress < 100) return true;
    if (r._status === 'not_started' && r._progress !== null && r._progress > 0) return true;
    return false;
  });
  if (progressViolations.length > 0) {
    warnings.push(`PROGRESS INCONSISTENCY: ${progressViolations.length} rows have progress values inconsistent with their status.`);
  }

  // 5. Date anomalies
  const dateAnomalies = rows.filter(r => r._date_anomaly).length;
  if (dateAnomalies > 0) {
    warnings.push(`DATE ANOMALIES: ${dateAnomalies} rows have actual_date before plan_date.`);
  }

  // 6. Unknown vendor ratio
  const unknownVendor = rows.filter(r => !r._vendor || r._vendor === 'Unknown Vendor').length;
  const unknownVendorRatio = total > 0 ? unknownVendor / total : 0;
  if (unknownVendorRatio > 0.3) {
    warnings.push(`DATA QUALITY: ${Math.round(unknownVendorRatio * 100)}% of rows have unknown vendor (threshold: 30%).`);
  }

  // 7. Unknown PIC ratio
  const unknownPic = rows.filter(r => !r._pic || r._pic === 'Unassigned').length;
  const unknownPicRatio = total > 0 ? unknownPic / total : 0;
  if (unknownPicRatio > 0.3) {
    warnings.push(`DATA QUALITY: ${Math.round(unknownPicRatio * 100)}% of rows have unassigned PIC (threshold: 30%).`);
  }

  // 8. Issue classification effectiveness
  const otherIssues = rows.filter(r => r._issue_keyword === 'other').length;
  const otherRatio = total > 0 ? otherIssues / total : 0;
  if (otherRatio > 0.7) {
    warnings.push(`CLASSIFICATION: ${Math.round(otherRatio * 100)}% of issues classified as "other" — classification may be ineffective.`);
  }

  const isValid = errors.length === 0;

  if (!isValid) {
    for (const e of errors) console.error(`[validate] ERROR: ${e}`);
  }
  for (const w of warnings) console.warn(`[validate] WARNING: ${w}`);
  if (isValid) console.log('[validate] Dataset VALID ✓');

  return {
    isValid,
    errors,
    warnings,
    stats: {
      total_sites: total,
      completed, on_progress, delayed, not_started,
      total_status_check: total_status,
      duplicate_sites_detected: duplicates,
      missing_status_count: missingStatus,
      unknown_vendor_ratio: parseFloat(unknownVendorRatio.toFixed(3)),
      unknown_pic_ratio:    parseFloat(unknownPicRatio.toFixed(3)),
      date_anomalies:       dateAnomalies,
      progress_violations:  progressViolations.length,
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// AGGREGATIONS
// ─────────────────────────────────────────────────────────────────────────────
function computeSummary(rows, validation) {
  const total       = rows.length;
  // KPI counts come EXCLUSIVELY from _status — single source of truth
  const completed   = rows.filter(r => r._status === 'completed').length;
  const on_progress = rows.filter(r => r._status === 'on_progress').length;
  const delayed     = rows.filter(r => r._status === 'delayed').length;
  const not_started = rows.filter(r => r._status === 'not_started').length;
  // Overdue is informational — sites past their plan date regardless of status
  const overdue     = rows.filter(r => r._is_overdue).length;
  const completion_rate = total > 0 ? Math.round((completed / total) * 100) : 0;
  const quality_issues  = rows.reduce((a, r) => a + r._quality_flags.length, 0);

  const inf_status   = rows.filter(r => r._inferred.status).length;
  const inf_progress = rows.filter(r => r._inferred.progress).length;
  const inf_vendor   = rows.filter(r => r._inferred.vendor).length;
  const inf_pic      = rows.filter(r => r._inferred.pic).length;
  const mapped_region= rows.filter(r => r._region !== null).length;

  const statusSources = {};
  for (const r of rows) {
    statusSources[r._status_source] = (statusSources[r._status_source] || 0) + 1;
  }

  const confidenceAvg = total > 0
    ? parseFloat((rows.reduce((s, r) => s + (r._confidence_score || 0), 0) / total).toFixed(2))
    : 0;

  console.log(`[summary] total=${total} completed=${completed} on_progress=${on_progress} delayed=${delayed} not_started=${not_started} overdue=${overdue}`);
  console.log(`[summary] sum_check=${completed+on_progress+delayed+not_started} === total=${total} → ${completed+on_progress+delayed+not_started === total ? 'OK ✓' : 'MISMATCH ✗'}`);
  console.log(`[summary] confidence_avg=${confidenceAvg} status_sources=${JSON.stringify(statusSources)}`);

  return {
    total_sites: total, completed, on_progress, delayed, not_started, overdue,
    completion_rate, quality_issues,
    data_valid: validation.isValid,
    validation_errors:   validation.errors,
    validation_warnings: validation.warnings,
    data_health: {
      valid:          validation.isValid,
      confidence_avg: confidenceAvg,
      issues: [
        ...validation.errors.map(e => ({ level: 'error', message: e })),
        ...validation.warnings.map(w => ({ level: 'warning', message: w })),
      ],
    },
    _debug: {
      total_rows: total,
      total_status_check: completed + on_progress + delayed + not_started,
      inferred_status_count:   inf_status,
      inferred_progress_count: inf_progress,
      missing_vendor_count:    inf_vendor,
      missing_pic_count:       inf_pic,
      mapped_region_count:     mapped_region,
      status_sources:          statusSources,
      confidence_avg:          confidenceAvg,
      ...validation.stats,
    },
  };
}

function computeProgressByRegion(rows) {
  const map = {};
  for (const row of rows) {
    const region = row._region || 'Unknown Region';
    if (!map[region]) map[region] = { region, completed:0, on_progress:0, delayed:0, not_started:0, total:0, overdue:0 };
    map[region].total++;
    // Mutually exclusive status buckets — each site counted exactly once
    if      (row._status === 'completed')   map[region].completed++;
    else if (row._status === 'on_progress') map[region].on_progress++;
    else if (row._status === 'delayed')     map[region].delayed++;
    else                                    map[region].not_started++;
    // Overdue is additive/informational — not part of status bucket
    if (row._is_overdue) map[region].overdue++;
  }
  return Object.values(map).map(r => ({
    ...r,
    delay_rate:      r.total > 0 ? Math.round((r.delayed  / r.total) * 100) : 0,
    completion_rate: r.total > 0 ? Math.round((r.completed / r.total) * 100) : 0,
  }));
}

function computeVendorPerformance(rows) {
  const map = {};
  for (const row of rows) {
    const vendor = row._vendor || 'Unknown Vendor';
    if (!map[vendor]) map[vendor] = { vendor, total:0, completed:0, delayed:0, on_progress:0 };
    map[vendor].total++;
    if      (row._status === 'completed')   map[vendor].completed++;
    else if (row._status === 'on_progress') map[vendor].on_progress++;
    else if (row._status === 'delayed')     map[vendor].delayed++;
  }
  return rankWithUnknownLast(
    Object.values(map).map(v => ({
      ...v,
      completion_rate: v.total > 0 ? Math.round((v.completed / v.total) * 100) : 0,
      delay_rate:      v.total > 0 ? Math.round((v.delayed / v.total) * 100) : 0,
    })).sort((a, b) => b.total - a.total),
    'vendor'
  );
}

function computeDelayReasons(rows) {
  const kwCount = {};
  const rawCount = {};
  for (const row of rows) {
    // Count only rows whose STATUS is delayed — consistent with KPI
    if (row._status !== 'delayed') continue;
    const kw = row._issue_keyword;
    if (!kw) continue;
    kwCount[kw] = (kwCount[kw] || 0) + 1;
    const rawIssue = typeof row.issue === 'string' ? row.issue : null;
    if (rawIssue) rawCount[rawIssue] = (rawCount[rawIssue] || 0) + 1;
  }
  if (Object.keys(kwCount).length === 0) kwCount['no_delays'] = 0;
  return {
    by_keyword: Object.entries(kwCount).map(([reason,count]) => ({reason,count})).sort((a,b) => b.count-a.count),
    by_raw:     Object.entries(rawCount).map(([reason,count]) => ({reason,count})).sort((a,b) => b.count-a.count).slice(0,10),
  };
}

function computeWorkloadPerPic(rows) {
  const map = {};
  for (const row of rows) {
    const pic = row._pic || 'Unassigned';
    if (!map[pic]) map[pic] = { pic, total:0, completed:0, on_progress:0, delayed:0 };
    map[pic].total++;
    if      (row._status === 'completed')   map[pic].completed++;
    else if (row._status === 'on_progress') map[pic].on_progress++;
    else if (row._status === 'delayed')     map[pic].delayed++;
  }
  return rankWithUnknownLast(Object.values(map).sort((a,b) => b.total-a.total), 'pic');
}

function computeProgressDistribution(rows) {
  const buckets = [
    {label:'0–25%', min:0,  max:25,  count:0},
    {label:'25–50%',min:25, max:50,  count:0},
    {label:'50–75%',min:50, max:75,  count:0},
    {label:'75–99%',min:75, max:99,  count:0},
    {label:'100%',  min:100,max:100, count:0},
  ];
  for (const row of rows) {
    const p = row._progress;
    if (p === null) continue;
    for (const b of buckets) { if (p >= b.min && p <= b.max) { b.count++; break; } }
  }
  return buckets.map(({label,count}) => ({label,count}));
}

function computePlanVsActual(rows) {
  const map = {};
  for (const row of rows) {
    if (!row._plan_date) continue;
    const month = row._plan_date.slice(0,7);
    if (!map[month]) map[month] = {month, planned:0, actual:0};
    map[month].planned++;
    if (row._actual_date) map[month].actual++;
  }
  return Object.values(map).sort((a,b) => a.month.localeCompare(b.month));
}

function computeRegionMapData(rows) {
  const map = {};
  for (const row of rows) {
    const regionName = row._region || 'Unknown Region';
    if (!map[regionName]) {
      const entry = Object.values(REGION_LOOKUP).find(r => r.name === regionName);
      map[regionName] = { region:regionName, coords: entry ? entry.coords : [-2.5,118.0], total:0, completed:0, on_progress:0, delayed:0, not_started:0 };
    }
    map[regionName].total++;
    if (row._status === 'completed')        map[regionName].completed++;
    else if (row._status === 'on_progress') map[regionName].on_progress++;
    else if (row._status === 'delayed')     map[regionName].delayed++;
    else                                    map[regionName].not_started++;
  }
  return Object.values(map).map(r => ({
    ...r,
    completion_rate: r.total > 0 ? Math.round((r.completed / r.total) * 100) : 0,
  }));
}

function getDeterministicOffset(key) {
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = key.charCodeAt(i) + ((hash << 5) - hash);
  }
  return ((hash % 1000) / 1000 - 0.5) * 0.2;
}

function computeMapPoints(rows) {
  return rows.map(row => {
    const regionName = row._region || 'Unknown Region';
    const entry = Object.values(REGION_LOOKUP).find(r => r.name === regionName);
    const base = entry ? entry.coords : [-2.5, 118.0];
    const siteKey = typeof row.site_id === 'string' ? row.site_id : 'x';
    const lat = base[0] + getDeterministicOffset(siteKey);
    const lng = base[1] + getDeterministicOffset(siteKey + 'lng');
    return {
      site_id:  typeof row.site_id === 'string' ? row.site_id : null,
      lat:      parseFloat(lat.toFixed(4)),
      lng:      parseFloat(lng.toFixed(4)),
      status:   row._status   || 'not_started',
      region:   row._region   || 'Unknown',
      vendor:   row._vendor   || 'Unknown',
      pic:      row._pic      || 'Unassigned',
      progress: row._progress,
    };
  });
}

function computeAutoInsights(rows, summary, vendorPerf, regionPerf) {
  // Gate: do not generate insights from invalid data
  if (!summary.data_valid) {
    return [
      'Kualitas data tidak mencukupi untuk menghasilkan ringkasan.',
      ...summary.validation_errors.map(e => `⚠ ${e}`),
    ];
  }

  const insights = [];
  const total = summary.total_sites;
  if (!total) return ['Tidak ada data tersedia untuk menghasilkan ringkasan.'];

  insights.push(`Tingkat penyelesaian keseluruhan adalah ${summary.completion_rate}% — ${summary.completed} dari ${total} site telah selesai.`);

  const realRegions = regionPerf.filter(r => !UNKNOWN_LABELS.includes(r.region.toLowerCase()));
  const worstRegion = [...realRegions].sort((a,b) => b.delay_rate - a.delay_rate)[0];
  if (worstRegion && worstRegion.delayed > 0) {
    insights.push(`Regional "${worstRegion.region}" memiliki tingkat keterlambatan tertinggi sebesar ${worstRegion.delay_rate}% (${worstRegion.delayed} dari ${worstRegion.total} site tertunda).`);
  }

  const realVendors = vendorPerf.filter(v => !UNKNOWN_LABELS.includes(v.vendor.toLowerCase()) && v.total >= 2);
  if (realVendors.length >= 1) {
    const best  = [...realVendors].sort((a,b) => b.completion_rate - a.completion_rate)[0];
    const worst = [...realVendors].sort((a,b) => a.completion_rate - b.completion_rate)[0];
    if (best && worst && best.vendor !== worst.vendor) {
      insights.push(`Vendor "${best.vendor}" memimpin dengan tingkat penyelesaian ${best.completion_rate}% (${best.completed}/${best.total} site). "${worst.vendor}" tertinggal di ${worst.completion_rate}% (${worst.completed}/${worst.total} site).`);
    } else if (best) {
      insights.push(`Vendor "${best.vendor}" memiliki tingkat penyelesaian ${best.completion_rate}% dari ${best.total} site.`);
    }
  }

  const kwCount = {};
  for (const row of rows) {
    if (row._issue_keyword && row._issue_keyword !== 'other') kwCount[row._issue_keyword] = (kwCount[row._issue_keyword]||0) + 1;
  }
  const topKw = Object.entries(kwCount).sort((a,b) => b[1]-a[1])[0];
  if (topKw) insights.push(`Kategori kendala terbanyak adalah "${topKw[0]}", mempengaruhi ${topKw[1]} site — hambatan utama dalam rollout ini.`);

  const picMap = {};
  for (const row of rows) {
    if (row._pic && row._pic !== 'Unassigned') picMap[row._pic] = (picMap[row._pic]||0) + 1;
  }
  const busiestPic = Object.entries(picMap).sort((a,b) => b[1]-a[1])[0];
  if (busiestPic) insights.push(`PIC "${busiestPic[0]}" menangani beban kerja tertinggi dengan ${busiestPic[1]} site yang ditugaskan.`);

  const buckets = {'0–25%':0,'25–50%':0,'50–75%':0,'75–99%':0,'100%':0};
  for (const row of rows) {
    const p = row._progress;
    if (p === null) continue;
    if (p <= 25) buckets['0–25%']++;
    else if (p <= 50) buckets['25–50%']++;
    else if (p <= 75) buckets['50–75%']++;
    else if (p < 100) buckets['75–99%']++;
    else buckets['100%']++;
  }
  const topBucket = Object.entries(buckets).sort((a,b) => b[1]-a[1])[0];
  if (topBucket && topBucket[1] > 0) {
    const stage = topBucket[0] === '0–25%' ? 'tahap awal' : topBucket[0] === '100%' ? 'hampir selesai' : 'tahap menengah';
    insights.push(`Sebagian besar site (${topBucket[1]}) berada di rentang progres ${topBucket[0]} — menunjukkan bottleneck ${stage}.`);
  }

  if (summary.delayed > 0) {
    const pct = Math.round((summary.delayed / total) * 100);
    insights.push(`${summary.delayed} site (${pct}%) saat ini tertunda. Perhatian segera diperlukan untuk mencegah keterlambatan lebih lanjut.`);
  }

  // Transparansi sumber status
  const debug = summary._debug;
  if (debug?.status_sources) {
    const sources = Object.entries(debug.status_sources)
      .filter(([k]) => k !== 'default')
      .map(([k,v]) => `${k}: ${v}`)
      .join(', ');
    if (sources) insights.push(`Status diturunkan dari: ${sources}.`);
  }

  return insights;
}

function computeInsights(rows, vendorPerf, regionPerf) {
  const worstVendor = [...vendorPerf].sort((a,b) => b.delay_rate - a.delay_rate)[0];
  const worstRegion = [...regionPerf].sort((a,b) => b.delay_rate - a.delay_rate)[0];
  const kwCount = {};
  for (const row of rows) {
    if (row._issue_keyword) kwCount[row._issue_keyword] = (kwCount[row._issue_keyword]||0) + 1;
  }
  const topIssue = Object.entries(kwCount).sort((a,b) => b[1]-a[1])[0];
  const picMap = {};
  for (const row of rows) {
    const p = row._pic || 'Unassigned';
    picMap[p] = (picMap[p]||0) + 1;
  }
  const busiestPic = Object.entries(picMap).sort((a,b) => b[1]-a[1])[0];
  return {
    region_highest_delay:    worstRegion ? {region:worstRegion.region, delay_rate:worstRegion.delay_rate} : null,
    vendor_worst_performance:worstVendor ? {vendor:worstVendor.vendor, delay_rate:worstVendor.delay_rate} : null,
    most_common_issue:       topIssue    ? {keyword:topIssue[0], count:topIssue[1]} : null,
    pic_highest_workload:    busiestPic  ? {pic:busiestPic[0], count:busiestPic[1]} : null,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// REGION DEBUG  — read-only diagnostic, no normalization applied
// Operates on mergedRecords (pre-enrichment) to capture raw values
// ─────────────────────────────────────────────────────────────────────────────
function computeRegionDebug(mergedRecords) {
  const INVALID_RAW = new Set([null, undefined, '', '-', 'n/a', 'na', 'null', 'unknown', 'none', 'tbd', '?']);
  const freq = {};   // raw value → count (original casing preserved)
  const invalidSamples = [];

  for (const rec of mergedRecords) {
    // Collect from all possible raw region fields, in priority order
    const candidates = [rec.region, rec.regional, rec.area_region, rec.region_name];
    let raw = null;
    for (const c of candidates) {
      const s = getRaw(c);
      if (s !== null && s !== undefined) { raw = String(s).trim(); break; }
    }

    // Use the string "null" as a key for missing values so JSON serialises it
    const key = (raw === null || raw === undefined) ? '(null)' : raw;
    freq[key] = (freq[key] || 0) + 1;

    // Collect invalid samples (up to 20)
    if (INVALID_RAW.has(raw === null ? null : raw.toLowerCase()) && invalidSamples.length < 20) {
      invalidSamples.push({ raw: key, site_id: getRaw(rec.site_id) || '(no id)' });
    }
  }

  const total = mergedRecords.length;

  // Sort by count desc, keep top 50
  const topValues = Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 50)
    .map(([value, count]) => ({ value, count, pct: total > 0 ? parseFloat(((count / total) * 100).toFixed(1)) : 0 }));

  // Invalid count = sum of entries whose key is in INVALID_RAW
  const invalidCount = Object.entries(freq)
    .filter(([k]) => INVALID_RAW.has(k === '(null)' ? null : k.toLowerCase()))
    .reduce((s, [, c]) => s + c, 0);

  // Suspected duplicates: group by lowercase-stripped key, flag groups with >1 distinct raw value
  const lowerGroup = {};
  for (const [raw] of Object.entries(freq)) {
    const lk = raw.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (!lowerGroup[lk]) lowerGroup[lk] = [];
    lowerGroup[lk].push(raw);
  }
  const suspectedDuplicates = Object.entries(lowerGroup)
    .filter(([, variants]) => variants.length > 1)
    .map(([, variants]) => variants)
    .slice(0, 20);

  const uniqueValues = Object.keys(freq).length;

  // Console summary
  console.log(`[region_debug] total=${total} unique=${uniqueValues} invalid=${invalidCount} (${total > 0 ? ((invalidCount/total)*100).toFixed(1) : 0}%)`);
  console.log(`[region_debug] top 10: ${topValues.slice(0,10).map(v => `"${v.value}"=${v.count}`).join(', ')}`);

  return {
    total_rows:           total,
    unique_values:        uniqueValues,
    invalid_count:        invalidCount,
    top_values:           topValues,
    sample_invalid:       invalidSamples,
    suspected_duplicates: suspectedDuplicates,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN ENTRY POINT
// ─────────────────────────────────────────────────────────────────────────────
function processAll(rawSheets) {
  console.log(`[transform] Processing ${rawSheets.length} sheet(s)...`);
  for (const { sheet, headers } of rawSheets) {
    console.log(`[transform] "${sheet}" headers: ${headers.map(h => `${h}→${normalizeHeader(h)}`).join(' | ')}`);
  }

  // STEP 1+2: Cross-sheet merge by site_id
  const mergedRecords = mergeAcrossSheets(rawSheets);

  // STEP 3: Enrich each merged record
  const allRows = mergedRecords.map(r => enrichRow(r));
  console.log(`[transform] Enriched ${allRows.length} rows`);

  // STEP 4: Validate dataset — must pass before aggregation
  const validation = validateDataset(allRows);

  // Validation log + RF/issue debug counts
  const withStatus       = allRows.filter(r => r._status).length;
  const withVendor       = allRows.filter(r => r._vendor && r._vendor !== 'Unknown Vendor').length;
  const withPic          = allRows.filter(r => r._pic && r._pic !== 'Unassigned').length;
  const withIssue        = allRows.filter(r => typeof r.issue === 'string' && r.issue.length > 0).length;
  const rfParsed         = allRows.filter(r => r._status_source === 'rf_cat').length;
  const rfMissing        = allRows.filter(r => isNullish(r._rf_cat_raw)).length;
  const delayedFromRf    = allRows.filter(r => r._status === 'delayed' && r._status_source === 'rf_cat').length;
  const issueClassified  = allRows.filter(r => r._issue_keyword && r._issue_keyword !== 'other').length;
  const issueOtherCount  = allRows.filter(r => r._issue_keyword === 'other').length;
  const regionFilled     = allRows.filter(r => r._region && r._region !== 'Unknown Region').length;
  const regionMissing    = allRows.filter(r => !r._region || r._region === 'Unknown Region').length;
  const regionDirect     = allRows.filter(r => r._region_source === 'direct').length;
  const regionFromSiteId = allRows.filter(r => r._region_source === 'site_id').length;
  const regionUnknown    = allRows.filter(r => r._region_source === 'fallback').length;
  console.log(`[transform] status=${withStatus} vendor=${withVendor} pic=${withPic} issue=${withIssue}`);
  console.log(`[transform] rf_parsed=${rfParsed} rf_missing=${rfMissing} delayed_from_rf=${delayedFromRf} issue_classified=${issueClassified} issue_other_count=${issueOtherCount}`);
  console.log(`[transform] region: total=${allRows.length} direct=${regionDirect} from_site_id=${regionFromSiteId} unknown=${regionUnknown} (filled=${regionFilled} missing=${regionMissing})`);

  // STEP 5: Aggregate — all charts from the SAME allRows, never recomputed separately
  const summary    = computeSummary(allRows, validation);
  const vendorPerf = computeVendorPerformance(allRows);
  const regionPerf = computeProgressByRegion(allRows);

  return {
    summary,
    progress_by_region:    regionPerf,
    vendor_performance:    vendorPerf,
    delay_reasons:         computeDelayReasons(allRows),
    workload_per_pic:      computeWorkloadPerPic(allRows),
    progress_distribution: computeProgressDistribution(allRows),
    plan_vs_actual:        computePlanVsActual(allRows),
    region_map:            computeRegionMapData(allRows),
    map_points:            computeMapPoints(allRows),
    insights:              computeInsights(allRows, vendorPerf, regionPerf),
    auto_insights:         computeAutoInsights(allRows, summary, vendorPerf, regionPerf),
    region_debug:          computeRegionDebug(mergedRecords),
    raw:                   allRows,
  };
}

module.exports = { processAll };
