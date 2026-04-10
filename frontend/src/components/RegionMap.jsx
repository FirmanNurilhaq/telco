import React, { useEffect } from 'react';
import { MapContainer, TileLayer, CircleMarker, Tooltip } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

// Fix Leaflet default icon path issue with Vite
import L from 'leaflet';
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// Color bubble by completion rate
function bubbleColor(rate) {
  if (rate >= 75) return '#22c55e';
  if (rate >= 50) return '#3b82f6';
  if (rate >= 25) return '#f59e0b';
  return '#ef4444';
}

export default function RegionMap({ regions = [], height = 380 }) {
  if (!regions.length) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500 text-sm">
        No region data available
      </div>
    );
  }

  const maxTotal = Math.max(...regions.map(r => r.total), 1);

  return (
    <MapContainer
      center={[-2.5, 118.0]}
      zoom={5}
      style={{ height: `${height}px`, width: '100%', borderRadius: '0.5rem', background: '#111827' }}
      scrollWheelZoom={false}
    >
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        attribution='&copy; <a href="https://carto.com/">CARTO</a>'
      />
      {regions.map((r) => {
        if (!r.coords) return null;
        // Bubble radius: 8–40px scaled by site count
        const radius = 8 + Math.round((r.total / maxTotal) * 32);
        return (
          <CircleMarker
            key={r.region}
            center={r.coords}
            radius={radius}
            pathOptions={{
              fillColor: bubbleColor(r.completion_rate),
              fillOpacity: 0.75,
              color: '#fff',
              weight: 1,
            }}
          >
            <Tooltip direction="top" offset={[0, -radius]} opacity={0.95}>
              <div style={{ fontSize: 12, lineHeight: 1.5 }}>
                <strong>{r.region}</strong><br />
                Total: {r.total} sites<br />
                Completed: {r.completed} ({r.completion_rate}%)<br />
                On Progress: {r.on_progress}<br />
                Delayed: {r.delayed}
              </div>
            </Tooltip>
          </CircleMarker>
        );
      })}
    </MapContainer>
  );
}
