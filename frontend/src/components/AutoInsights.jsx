import React from 'react';
import { LABELS } from '../constants/labels';

const ICONS = ['📊', '🗺️', '🏭', '⚠️', '👤', '📈', '🚨'];

export default function AutoInsights({ insights = [] }) {
  if (!insights.length) return null;
  return (
    <div className="bg-gray-800 rounded-xl p-4 shadow mb-4">
      <p className="text-sm font-semibold text-gray-300 mb-3">{LABELS.ringkasanOtomatis}</p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        {insights.map((text, i) => (
          <div key={i} className="flex items-start gap-2 bg-gray-700/40 rounded-lg px-3 py-2">
            <span className="text-base mt-0.5 shrink-0">{ICONS[i % ICONS.length]}</span>
            <p className="text-xs text-gray-300 leading-relaxed">{text}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
