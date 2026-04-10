import React, { useState } from 'react';
import { LABELS, STATUS_ID } from '../constants/labels';

const STATUS_OPTIONS = [
  { value: 'all',         label: 'Semua Status' },
  { value: 'completed',   label: STATUS_ID.completed   },
  { value: 'on_progress', label: STATUS_ID.on_progress },
  { value: 'delayed',     label: STATUS_ID.delayed     },
  { value: 'not_started', label: STATUS_ID.not_started },
];

function Select({ value, onChange, options, label }) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className="bg-gray-700 text-gray-200 text-xs rounded px-3 py-1.5 outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer min-w-0"
      aria-label={label}
    >
      {options.map(o => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
}

export default function FilterBar({ filters, onChange, regions = [], vendors = [] }) {
  const [open, setOpen] = useState(false);

  const regionOptions = [
    { value: 'all', label: LABELS.semuaRegional },
    ...regions.map(r => ({ value: r, label: r })),
  ];
  const vendorOptions = [
    { value: 'all', label: LABELS.semuaVendor },
    ...vendors.map(v => ({ value: v, label: v })),
  ];

  const activeCount = Object.entries(filters)
    .filter(([k, v]) => k !== 'search' && v && v !== 'all').length
    + (filters.search ? 1 : 0);

  const clearAll = () => onChange({ region: 'all', vendor: 'all', status: 'all', dateFrom: '', dateTo: '', search: '' });

  return (
    <div className="bg-gray-800/60 rounded-xl px-4 py-3 mb-4">
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-xs text-gray-400 font-semibold uppercase tracking-wider shrink-0">{LABELS.filter}</span>
        <div className="relative flex-1 min-w-[160px] max-w-xs">
          <input
            type="text"
            placeholder={LABELS.cari}
            value={filters.search || ''}
            onChange={e => onChange({ ...filters, search: e.target.value })}
            className="w-full bg-gray-700 text-gray-200 text-xs rounded px-3 py-1.5 pl-7 outline-none focus:ring-1 focus:ring-blue-500"
          />
          <svg className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
          </svg>
        </div>
        <button onClick={() => setOpen(o => !o)} className="sm:hidden text-xs text-gray-400 border border-gray-600 rounded px-2 py-1">
          {open ? LABELS.tutup : `${LABELS.filter}${activeCount > 0 ? ` (${activeCount})` : ''}`}
        </button>
        <div className="hidden sm:flex items-center gap-2 flex-wrap">
          <Select label={LABELS.semuaRegional} value={filters.region || 'all'} onChange={v => onChange({ ...filters, region: v })} options={regionOptions} />
          <Select label={LABELS.semuaVendor}   value={filters.vendor || 'all'} onChange={v => onChange({ ...filters, vendor: v })} options={vendorOptions} />
          <Select label="Semua Status"          value={filters.status || 'all'} onChange={v => onChange({ ...filters, status: v })} options={STATUS_OPTIONS} />
          <input type="date" value={filters.dateFrom || ''} onChange={e => onChange({ ...filters, dateFrom: e.target.value })}
            className="bg-gray-700 text-gray-200 text-xs rounded px-2 py-1.5 outline-none focus:ring-1 focus:ring-blue-500" aria-label={LABELS.dariTanggal} />
          <span className="text-gray-500 text-xs">&rarr;</span>
          <input type="date" value={filters.dateTo || ''} onChange={e => onChange({ ...filters, dateTo: e.target.value })}
            className="bg-gray-700 text-gray-200 text-xs rounded px-2 py-1.5 outline-none focus:ring-1 focus:ring-blue-500" aria-label={LABELS.sampaiTanggal} />
        </div>
        {activeCount > 0 && (
          <button onClick={clearAll} className="text-xs text-blue-400 hover:text-blue-300 ml-auto shrink-0">
            {LABELS.hapusFilter} {activeCount}
          </button>
        )}
      </div>
      {open && (
        <div className="sm:hidden mt-3 flex flex-col gap-2">
          <Select label={LABELS.semuaRegional} value={filters.region || 'all'} onChange={v => onChange({ ...filters, region: v })} options={regionOptions} />
          <Select label={LABELS.semuaVendor}   value={filters.vendor || 'all'} onChange={v => onChange({ ...filters, vendor: v })} options={vendorOptions} />
          <Select label="Semua Status"          value={filters.status || 'all'} onChange={v => onChange({ ...filters, status: v })} options={STATUS_OPTIONS} />
          <div className="flex items-center gap-2">
            <input type="date" value={filters.dateFrom || ''} onChange={e => onChange({ ...filters, dateFrom: e.target.value })}
              className="flex-1 bg-gray-700 text-gray-200 text-xs rounded px-2 py-1.5 outline-none" aria-label={LABELS.dariTanggal} />
            <span className="text-gray-500 text-xs">&rarr;</span>
            <input type="date" value={filters.dateTo || ''} onChange={e => onChange({ ...filters, dateTo: e.target.value })}
              className="flex-1 bg-gray-700 text-gray-200 text-xs rounded px-2 py-1.5 outline-none" aria-label={LABELS.sampaiTanggal} />
          </div>
        </div>
      )}
    </div>
  );
}
