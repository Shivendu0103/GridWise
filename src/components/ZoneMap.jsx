// src/components/ZoneMap.jsx
// Leaflet integration with zone polygon overlays and heatmap coloring (No API key required)
import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Polygon, Tooltip as LeafletTooltip, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

// Status → fill color mapping
function loadColor(status) {
  const map = {
    surplus:  { fill: '#6366f1', stroke: '#818cf8' },
    low:      { fill: '#3b82f6', stroke: '#60a5fa' },
    normal:   { fill: '#10b981', stroke: '#34d399' },
    overload: { fill: '#f59e0b', stroke: '#fbbf24' },
    critical: { fill: '#ef4444', stroke: '#f87171' },
  };
  return map[status] || map.normal;
}

// Helper to center the map on the selected zone
function MapCenterer({ selectedZoneId, zones }) {
  const map = useMap();
  useEffect(() => {
    if (selectedZoneId && zones) {
      const zone = Object.values(zones).find(z => z.zoneId === selectedZoneId);
      if (zone) {
        map.setView([zone.lat, zone.lng], 7, { animate: true });
      }
    }
  }, [selectedZoneId, zones, map]);
  return null;
}

export default function ZoneMap({ zones, selectedZoneId, onZoneClick }) {
  const [mapReady, setMapReady] = useState(false);

  // Fix Leaflet container styling issue where it sometimes renders zero height
  useEffect(() => {
    setMapReady(true);
  }, []);

  if (!mapReady) return null;

  return (
    <div className="map-wrapper" style={{ position: 'relative', width: '100%', height: '100%', borderRadius: 'inherit', overflow: 'hidden' }}>
      <MapContainer
        center={[22.5, 80.5]}
        zoom={5}
        style={{ width: '100%', height: '100%', background: '#0f1629' }}
        zoomControl={false}
        attributionControl={false}
      >
        {/* Dark-themed OpenStreetMap tiles (CartoDB Dark Matter) */}
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> contributors'
        />

        <MapCenterer selectedZoneId={selectedZoneId} zones={zones} />

        {zones && Object.values(zones).map((zone) => {
          const { zoneId, bounds, status } = zone;
          if (!bounds) return null;

          const { north, south, east, west } = bounds;
          const positions = [
            [north, west],
            [north, east],
            [south, east],
            [south, west],
          ];
          
          const color = loadColor(status);
          const isSelected = selectedZoneId === zoneId;

          return (
            <Polygon
              key={zoneId}
              positions={positions}
              pathOptions={{
                fillColor: color.fill,
                fillOpacity: isSelected ? 0.55 : 0.3,
                color: color.stroke,
                weight: isSelected ? 3 : 1.5,
                opacity: 0.9,
              }}
              eventHandlers={{
                click: () => onZoneClick?.(zone),
              }}
            >
              <LeafletTooltip sticky className="custom-leaflet-tooltip">
                <div style={{ fontFamily: 'Inter, sans-serif', color: '#111', padding: '4px' }}>
                  <strong>{zone.name}</strong><br/>
                  Load: <b>{zone.currentLoad?.toFixed(1)}%</b> &nbsp;|&nbsp;
                  Status: <b style={{ color: color.fill }}>{zone.status?.toUpperCase()}</b><br/>
                  {Math.round(zone.activeMW || 0)} / {zone.capacityMW} MW
                </div>
              </LeafletTooltip>
            </Polygon>
          );
        })}
      </MapContainer>

      {/* Legend */}
      <div className="map-legend" style={{ zIndex: 1000 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 1 }}>
          Load Status
        </div>
        {[
          { label: 'Surplus (≤30%)',  color: '#6366f1' },
          { label: 'Low (30–50%)',    color: '#3b82f6' },
          { label: 'Normal (50–85%)', color: '#10b981' },
          { label: 'Overload (85%+)', color: '#f59e0b' },
          { label: 'Critical (95%+)', color: '#ef4444' },
        ].map(({ label, color }) => (
          <div key={label} className="legend-item">
            <div className="legend-dot" style={{ background: color }} />
            {label}
          </div>
        ))}
      </div>
    </div>
  );
}
