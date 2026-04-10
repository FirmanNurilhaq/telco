import { useMemo } from 'react';

const UNKNOWN_LABELS = ['unknown vendor', 'unknown region', 'unassigned', 'unknown', ''];

function rankUnknownLast(arr, key) {
  const real    = arr.filter(r => !UNKNOWN_LABELS.includes(String(r[key] || '').toLowerCase().trim()));
  const unknown = arr.filter(r =>  UNKNOWN_LABELS.includes(String(r[key] || '').toLowerCase().trim()));
  return [...real, ...unknown];
}

export function useAggregations(rows) {
  return useMemo(() => {
    if (!rows.length) return null;

    const total       = rows.length;
    const completed   = rows.filter(r => r._status === 'completed').length;
    const on_progress = rows.filter(r => r._status === 'on_progress').length;
    const delayed     = rows.filter(r => r._status === 'delayed').length;
    const not_started = rows.filter(r => r._status === 'not_started').length;
    const overdue     = rows.filter(r => r._is_overdue).length;
    const completion_rate = total > 0 ? Math.round((completed / total) * 100) : 0;
    // Reconciliation check
    const total_status = completed + on_progress + delayed + not_started;
    if (total_status !== total) {
      console.warn(`[useAggregations] KPI mismatch: ${total_status} ≠ ${total}`);
    }

    // Region — mutually exclusive status buckets
    const regionMap = {};
    for (const row of rows) {
      const r = row._region || 'Unknown Region';
      if (!regionMap[r]) regionMap[r] = { region: r, completed: 0, on_progress: 0, delayed: 0, not_started: 0, total: 0, overdue: 0 };
      regionMap[r].total++;
      if      (row._status === 'completed')   regionMap[r].completed++;
      else if (row._status === 'on_progress') regionMap[r].on_progress++;
      else if (row._status === 'delayed')     regionMap[r].delayed++;
      else                                    regionMap[r].not_started++;
      if (row._is_overdue) regionMap[r].overdue++;
    }
    const by_region = Object.values(regionMap).map(r => ({
      ...r,
      delay_rate:      r.total > 0 ? Math.round((r.delayed / r.total) * 100) : 0,
      completion_rate: r.total > 0 ? Math.round((r.completed / r.total) * 100) : 0,
    }));

    // Vendor — mutually exclusive
    const vendorMap = {};
    for (const row of rows) {
      const v = row._vendor || 'Unknown Vendor';
      if (!vendorMap[v]) vendorMap[v] = { vendor: v, total: 0, completed: 0, delayed: 0, on_progress: 0 };
      vendorMap[v].total++;
      if      (row._status === 'completed')   vendorMap[v].completed++;
      else if (row._status === 'on_progress') vendorMap[v].on_progress++;
      else if (row._status === 'delayed')     vendorMap[v].delayed++;
    }
    const vendor_performance = rankUnknownLast(
      Object.values(vendorMap).map(v => ({
        ...v,
        completion_rate: v.total > 0 ? Math.round((v.completed / v.total) * 100) : 0,
        delay_rate:      v.total > 0 ? Math.round((v.delayed / v.total) * 100) : 0,
      })).sort((a, b) => b.total - a.total),
      'vendor'
    );

    // PIC — mutually exclusive
    const picMap = {};
    for (const row of rows) {
      const p = row._pic || 'Unassigned';
      if (!picMap[p]) picMap[p] = { pic: p, total: 0, completed: 0, on_progress: 0, delayed: 0 };
      picMap[p].total++;
      if      (row._status === 'completed')   picMap[p].completed++;
      else if (row._status === 'on_progress') picMap[p].on_progress++;
      else if (row._status === 'delayed')     picMap[p].delayed++;
    }
    const workload_per_pic = rankUnknownLast(
      Object.values(picMap).sort((a, b) => b.total - a.total),
      'pic'
    );

    // Delay reasons — only from sites whose status IS delayed
    const kwCount = {};
    for (const row of rows) {
      if (row._status !== 'delayed') continue;
      const kw = row._issue_keyword || 'other';
      kwCount[kw] = (kwCount[kw] || 0) + 1;
    }
    const delay_by_keyword = Object.entries(kwCount)
      .map(([reason, count]) => ({ reason, count }))
      .sort((a, b) => b.count - a.count);

    // Progress distribution — dynamic bins
    const BINS = [
      { label: '0–10%',   min: 0,   max: 10  },
      { label: '10–25%',  min: 10,  max: 25  },
      { label: '25–50%',  min: 25,  max: 50  },
      { label: '50–75%',  min: 50,  max: 75  },
      { label: '75–90%',  min: 75,  max: 90  },
      { label: '90–99%',  min: 90,  max: 99  },
      { label: '100%',    min: 100, max: 100 },
    ];
    const buckets = BINS.map(b => ({ ...b, count: 0 }));
    let progressTotal = 0;
    for (const row of rows) {
      const p = row._progress;
      if (p === null) continue;
      progressTotal++;
      for (const b of buckets) { if (p >= b.min && p <= b.max) { b.count++; break; } }
    }
    const distribution = buckets.map(({ label, count }) => ({
      label, count,
      pct: progressTotal > 0 ? parseFloat(((count / progressTotal) * 100).toFixed(1)) : 0,
    }));

    // Plan vs actual
    const timelineMap = {};
    for (const row of rows) {
      if (!row._plan_date) continue;
      const month = row._plan_date.slice(0, 7);
      if (!timelineMap[month]) timelineMap[month] = { month, planned: 0, actual: 0 };
      timelineMap[month].planned++;
      if (row._actual_date) timelineMap[month].actual++;
    }
    const plan_vs_actual = Object.values(timelineMap).sort((a, b) => a.month.localeCompare(b.month));

    return {
      summary: { total_sites: total, completed, on_progress, delayed, not_started, overdue, completion_rate },
      by_region,
      vendor_performance,
      workload_per_pic,
      delay_by_keyword,
      distribution: distribution,
      plan_vs_actual,
    };
  }, [rows]);
}
