import React from 'react';

export function SkeletonCard() {
  return (
    <div className="bg-gray-800 rounded-xl p-4 animate-pulse">
      <div className="h-3 bg-gray-700 rounded w-1/2 mb-3" />
      <div className="h-8 bg-gray-700 rounded w-1/3" />
    </div>
  );
}

export function SkeletonChart({ height = 260 }) {
  return (
    <div className="bg-gray-800 rounded-xl p-4 animate-pulse">
      <div className="h-3 bg-gray-700 rounded w-1/3 mb-4" />
      <div className="bg-gray-700 rounded" style={{ height }} />
    </div>
  );
}
