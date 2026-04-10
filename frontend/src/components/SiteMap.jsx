import React, { useEffect, useRef } from 'react';
import { MapContainer, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import 'leaflet.markercluster';

const STATUS_COLORS = {
  completed:   '#22c55e',
  on_progress: '#3b82f6',
  delayed:     '#ef4444',
  not_started: '#6b7280',
};

function statusColor(status) {
  return STATUS_COLORS[status] || '#6b7280';
}

function makeDotIcon(color) {
  return L.divIcon({
    className: '',
    html: `<div style="width:10px;height:10px;border-radius:50%;background:${color};border:1.5px solid rgba(255,255,255,0.6);box-shadow:0 0 4px ${color}88"></div>`,
    iconSize: [10, 10],
    iconAnchor: [5, 5],
  });
}

// Inner component that adds cluster layer imperatively
function ClusterLayer({ points }) {
  const map = useMap();
  const clusterRef = useRef(null);

  useEffect(() => {
    if (clusterRef.current) {
      map.removeLayer(clusterRef.current);
    }
    const cluster = L.markerClusterGroup({
      maxClusterRadius: 40,
      iconCreateFunction(c) {
        const count = c.getChildCount();
        const size = count > 100 ? 44 : count > 20 ? 36 : 28;
        return L.divIcon({
          html: `<div style="width:${size}px;height:${size}px;border-radius:50%;background:rgba(59,130,246,0.85);border:2px solid #fff;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:#fff;box-shadow:0 2px 6px #0006">${count}</div>`,
          className: '',
          iconSize: [size, size],
          iconAnchor: [size / 2, size / 2],
        });
      },
    });

    for (const pt of points) {
      const color = statusColor(pt.status);
      const marker = L.marker([pt.lat, pt.lng], { icon: makeDotIcon(color) });
      marker.bindTooltip(
        `<div style="font-size:12px;line-height:1.6">
          <strong>${pt.site_id || 'Unknown Site'}</strong><br/>
          Region: ${pt.region}<br/>
          Status: <span style="color:${color};font-weight:600">${pt.status}</span><br/>
          Vendor: ${pt.vendor}<br/>
          PIC: ${pt.pic}<br/>
          Progress: ${pt.progress !== null ? pt.progress + '%' : '—'}
        </div>`,
        { direction: 'top', opacity: 0.97 }
      );
      cluster.addLayer(marker);
    }

    map.addLayer(cluster);
    clusterRef.current = cluster;

    return () => { map.removeLayer(cluster); };
  }, [points, map]);

  return null;
}

export default function SiteMap({ points = [], filters = {}, height = 420 }) {
  // Apply filters + geographic bounds (Indonesia: lat -11 to 6, lng 95 to 141)
  const filtered = points.filter(pt => {
    if (pt.lat > 6 || pt.lat < -11) return false;
    if (pt.lng < 95 || pt.lng > 141) return false;
    if (filters.region && filters.region !== 'all' && pt.region !== filters.region) return false;
    if (filters.vendor && filters.vendor !== 'all' && pt.vendor !== filters.vendor) return false;
    if (filters.status && filters.status !== 'all' && pt.status !== filters.status) return false;
    return true;
  });

  return (
    <div>
      <MapContainer
        center={[-2.5, 118.0]}
        zoom={5}
        style={{ height: `${height}px`, width: '100%', borderRadius: '0.5rem', background: '#111827' }}
        scrollWheelZoom
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          attribution='&copy; <a href="https://carto.com/">CARTO</a>'
        />
        <ClusterLayer points={filtered} />
      </MapContainer>
      <div className="flex items-center gap-4 mt-2 flex-wrap">
        {Object.entries(STATUS_COLORS).map(([s, c]) => (
          <span key={s} className="flex items-center gap-1 text-xs text-gray-400">
            <span style={{ background: c, width: 10, height: 10, borderRadius: '50%', display: 'inline-block' }} />
            {s.replace('_', ' ')}
          </span>
        ))}
        <span className="text-xs text-gray-600 ml-auto">{filtered.length} sites shown</span>
      </div>
    </div>
  );
}
