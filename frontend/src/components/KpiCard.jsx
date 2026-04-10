import React from 'react';

export default function KpiCard({ label, value, color = 'text-white', sub, onClick, active }) {
  return (
    <div
      onClick={onClick}
      className={`bg-gray-800 rounded-xl p-4 flex flex-col gap-1 shadow transition-all
        ${onClick ? 'cursor-pointer hover:bg-gray-700 hover:ring-1 hover:ring-blue-500' : ''}
        ${active ? 'ring-2 ring-blue-500 bg-gray-700' : ''}`}
    >
      <span className="text-xs text-gray-400 uppercase tracking-wider leading-tight">{label}</span>
      <span className={`text-2xl sm:text-3xl font-bold ${color}`}>{value ?? '—'}</span>
      {sub && <span className="text-xs text-gray-500">{sub}</span>}
    </div>
  );
}
