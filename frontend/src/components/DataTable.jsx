import React, { useState, useMemo } from 'react';

function cellValue(val) {
  if (val && typeof val === 'object' && val.isNull) return { display: 'NULL', isNull: true };
  if (val === null || val === undefined || val === '') return { display: '—', isNull: false };
  return { display: String(val), isNull: false };
}

const DISPLAY_COLS = ['_sheet', 'region', 'area', 'site_id', 'status', 'progress', 'plan_date', 'actual_date', 'vendor', 'pic', 'issue'];

export default function DataTable({ rows = [] }) {
  const [search, setSearch] = useState('');
  const [sortCol, setSortCol] = useState(null);
  const [sortDir, setSortDir] = useState('asc');
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 20;

  const cols = useMemo(() => {
    if (!rows.length) return [];
    const keys = Object.keys(rows[0]).filter(k => !k.startsWith('_') || k === '_sheet');
    const ordered = DISPLAY_COLS.filter(c => keys.includes(c));
    const rest = keys.filter(k => !DISPLAY_COLS.includes(k) && !k.startsWith('_'));
    return [...ordered, ...rest];
  }, [rows]);

  const filtered = useMemo(() => {
    if (!search) return rows;
    const q = search.toLowerCase();
    return rows.filter(row =>
      cols.some(c => {
        const { display } = cellValue(row[c]);
        return display.toLowerCase().includes(q);
      })
    );
  }, [rows, search, cols]);

  const sorted = useMemo(() => {
    if (!sortCol) return filtered;
    return [...filtered].sort((a, b) => {
      const av = cellValue(a[sortCol]).display;
      const bv = cellValue(b[sortCol]).display;
      return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
    });
  }, [filtered, sortCol, sortDir]);

  const totalPages = Math.ceil(sorted.length / PAGE_SIZE);
  const paged = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function toggleSort(col) {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortCol(col); setSortDir('asc'); }
    setPage(1);
  }

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-transparent rounded-xl p-4 shadow">
      <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
        <span className="text-sm text-gray-500 dark:text-gray-400">{filtered.length} rows</span>
        <input
          className="bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 text-sm rounded px-3 py-1.5 outline-none focus:ring-1 focus:ring-blue-500 w-64 border border-gray-300 dark:border-transparent"
          placeholder="Search..."
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1); }}
        />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs text-left">
          <thead>
            <tr className="border-b border-gray-200 dark:border-gray-700">
              {cols.map(col => (
                <th
                  key={col}
                  className="px-3 py-2 text-gray-500 dark:text-gray-400 uppercase cursor-pointer select-none whitespace-nowrap hover:text-gray-900 dark:hover:text-white"
                  onClick={() => toggleSort(col)}
                >
                  {col.replace(/_/g, ' ')}
                  {sortCol === col ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ''}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paged.map((row, i) => (
              <tr key={i} className="border-b border-gray-100 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-700/30">
                {cols.map(col => {
                  const { display, isNull } = cellValue(row[col]);
                  return (
                    <td
                      key={col}
                      className={`px-3 py-2 whitespace-nowrap text-gray-700 dark:text-gray-300 ${isNull ? 'bg-red-100 dark:bg-red-900/40 text-red-500 dark:text-red-400 font-semibold' : ''}`}
                    >
                      {display}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {totalPages > 1 && (
        <div className="flex items-center gap-2 mt-3 justify-end text-xs text-gray-500 dark:text-gray-400">
          <button disabled={page === 1} onClick={() => setPage(p => p - 1)} className="px-2 py-1 rounded bg-gray-100 dark:bg-gray-700 disabled:opacity-40">Prev</button>
          <span>{page} / {totalPages}</span>
          <button disabled={page === totalPages} onClick={() => setPage(p => p + 1)} className="px-2 py-1 rounded bg-gray-100 dark:bg-gray-700 disabled:opacity-40">Next</button>
        </div>
      )}
    </div>
  );
}
