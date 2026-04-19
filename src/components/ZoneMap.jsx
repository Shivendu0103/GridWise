// src/components/ZoneMap.jsx
// Google Maps integration with zone polygon overlays and heatmap coloring
import { useEffect, useRef, useState } from 'react';
import { Loader } from '@googlemaps/js-api-loader';

const MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';

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

let loaderInstance = null;

function getLoader() {
  if (!loaderInstance) {
    loaderInstance = new Loader({
      apiKey: MAPS_API_KEY,
      version: 'weekly',
      libraries: ['visualization'],
    });
  }
  return loaderInstance;
}

export default function ZoneMap({ zones, selectedZoneId, onZoneClick }) {
  const mapRef     = useRef(null);
  const googleRef  = useRef(null);
  const mapInstance = useRef(null);
  const polygonsRef = useRef({});
  const [mapLoaded, setMapLoaded] = useState(false);
  const [mapError, setMapError] = useState(null);

  // Initialize map once
  useEffect(() => {
    if (!MAPS_API_KEY) {
      setMapError('Google Maps API key not set. Add VITE_GOOGLE_MAPS_API_KEY to your .env file.');
      return;
    }

    getLoader().load().then((google) => {
      googleRef.current = google;

      mapInstance.current = new google.maps.Map(mapRef.current, {
        center:           { lat: 22.5, lng: 80.5 },
        zoom:             5,
        mapTypeId:        'roadmap',
        disableDefaultUI: true,
        zoomControl:      true,
        styles: DARK_MAP_STYLE,
      });

      setMapLoaded(true);
    }).catch((err) => {
      console.error('[Maps] Load error:', err);
      setMapError('Failed to load Google Maps. Check your API key and billing.');
    });
  }, []);

  // Draw / update polygons whenever zones change
  useEffect(() => {
    if (!mapLoaded || !googleRef.current || !zones) return;
    const google = googleRef.current;

    Object.values(zones).forEach((zone) => {
      const { zoneId, bounds, status } = zone;
      if (!bounds) return;

      const { north, south, east, west } = bounds;
      const paths = [
        { lat: north, lng: west },
        { lat: north, lng: east },
        { lat: south, lng: east },
        { lat: south, lng: west },
      ];
      const color = loadColor(status);

      if (polygonsRef.current[zoneId]) {
        // Update existing polygon
        const poly = polygonsRef.current[zoneId];
        poly.setOptions({
          fillColor:   color.fill,
          strokeColor: color.stroke,
          strokeWeight: selectedZoneId === zoneId ? 3 : 1.5,
          fillOpacity:  selectedZoneId === zoneId ? 0.55 : 0.3,
        });
      } else {
        // Create new polygon
        const poly = new google.maps.Polygon({
          paths,
          fillColor:    color.fill,
          fillOpacity:  0.3,
          strokeColor:  color.stroke,
          strokeOpacity: 0.9,
          strokeWeight: 1.5,
        });
        poly.setMap(mapInstance.current);

        // Click handler
        poly.addListener('click', () => onZoneClick?.(zone));

        // Info window on hover
        const infoWindow = new google.maps.InfoWindow();
        poly.addListener('mouseover', (e) => {
          infoWindow.setContent(`
            <div style="font-family:Inter,sans-serif;color:#111;padding:4px">
              <strong>${zone.name}</strong><br/>
              Load: <b>${zone.currentLoad?.toFixed(1)}%</b> &nbsp;|&nbsp;
              Status: <b style="color:${color.fill}">${zone.status?.toUpperCase()}</b><br/>
              ${Math.round(zone.activeMW || 0)} / ${zone.capacityMW} MW
            </div>
          `);
          infoWindow.setPosition(e.latLng);
          infoWindow.open(mapInstance.current);
        });
        poly.addListener('mouseout', () => infoWindow.close());

        polygonsRef.current[zoneId] = poly;
      }
    });
  }, [zones, mapLoaded, selectedZoneId, onZoneClick]);

  if (mapError) {
    return (
      <div className="map-wrapper" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12 }}>
        <span style={{ fontSize: 36 }}>🗺️</span>
        <p style={{ color: 'var(--text-secondary)', fontSize: 14, textAlign: 'center', maxWidth: 360 }}>
          {mapError}
        </p>
      </div>
    );
  }

  return (
    <div className="map-wrapper">
      <div ref={mapRef} className="map-container" id="gridwise-map" />

      {/* Legend */}
      <div className="map-legend">
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

// ─────────────────────────────────────────────────────────
//  Dark map style — matches GridWise dark theme
// ─────────────────────────────────────────────────────────
const DARK_MAP_STYLE = [
  { elementType: 'geometry',       stylers: [{ color: '#0f1629' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#080c18' }] },
  { elementType: 'labels.text.fill',   stylers: [{ color: '#475569' }] },
  { featureType: 'administrative.country', elementType: 'geometry.stroke', stylers: [{ color: '#1e2d4a' }] },
  { featureType: 'administrative.province', elementType: 'geometry.stroke', stylers: [{ color: '#1e2d4a' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#141a2e' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#1a2240' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#060a14' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#1e3455' }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
];
