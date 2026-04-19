// src/components/ZoneMap.jsx
// Google Maps integration with zone polygon overlays and heatmap coloring
// Uses the new functional API (setOptions + importLibrary) for @googlemaps/js-api-loader
import { useEffect, useRef, useState } from 'react';

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

// Dark map style — matches GridWise dark theme
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

// Lazy-load Google Maps using dynamic import to avoid top-level Loader crash
let mapsPromise = null;

function loadGoogleMaps() {
  if (mapsPromise) return mapsPromise;

  if (!MAPS_API_KEY) {
    mapsPromise = Promise.reject(new Error('No API key'));
    return mapsPromise;
  }

  mapsPromise = (async () => {
    // Dynamic import so it doesn't crash at module level
    const { APILoader } = await import('@googlemaps/js-api-loader');
    // Try the new functional API first
    if (typeof APILoader !== 'undefined') {
      const loader = new APILoader({ apiKey: MAPS_API_KEY, version: 'weekly' });
      await loader.load();
      return window.google;
    }
    // Fallback: use importLibrary directly if available
    throw new Error('Loader not available');
  })().catch(async () => {
    // Ultimate fallback: inject script tag directly
    if (window.google?.maps) return window.google;

    return new Promise((resolve, reject) => {
      if (document.querySelector(`script[src*="maps.googleapis.com"]`)) {
        // Script already loading
        const check = setInterval(() => {
          if (window.google?.maps) { clearInterval(check); resolve(window.google); }
        }, 100);
        setTimeout(() => { clearInterval(check); reject(new Error('Maps timeout')); }, 10000);
        return;
      }

      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${MAPS_API_KEY}&libraries=visualization&v=weekly`;
      script.async = true;
      script.defer = true;
      script.onload = () => resolve(window.google);
      script.onerror = () => reject(new Error('Failed to load Google Maps script'));
      document.head.appendChild(script);
    });
  });

  return mapsPromise;
}

export default function ZoneMap({ zones, selectedZoneId, onZoneClick }) {
  const mapRef      = useRef(null);
  const googleRef   = useRef(null);
  const mapInstance  = useRef(null);
  const polygonsRef  = useRef({});
  const [mapLoaded, setMapLoaded] = useState(false);
  const [mapError, setMapError]   = useState(null);

  // Initialize map once
  useEffect(() => {
    if (!MAPS_API_KEY) {
      setMapError('Google Maps API key not set. Add VITE_GOOGLE_MAPS_API_KEY to your .env file.');
      return;
    }

    loadGoogleMaps()
      .then((google) => {
        googleRef.current = google;

        mapInstance.current = new google.maps.Map(mapRef.current, {
          center:           { lat: 22.5, lng: 80.5 },
          zoom:             5,
          mapTypeId:        'roadmap',
          disableDefaultUI: true,
          zoomControl:      true,
          styles:           DARK_MAP_STYLE,
        });

        setMapLoaded(true);
      })
      .catch((err) => {
        console.error('[Maps] Load error:', err);
        setMapError('Failed to load Google Maps. Check your API key.');
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
        const poly = polygonsRef.current[zoneId];
        poly.setOptions({
          fillColor:    color.fill,
          strokeColor:  color.stroke,
          strokeWeight: selectedZoneId === zoneId ? 3 : 1.5,
          fillOpacity:  selectedZoneId === zoneId ? 0.55 : 0.3,
        });
      } else {
        const poly = new google.maps.Polygon({
          paths,
          fillColor:     color.fill,
          fillOpacity:   0.3,
          strokeColor:   color.stroke,
          strokeOpacity: 0.9,
          strokeWeight:  1.5,
        });
        poly.setMap(mapInstance.current);
        poly.addListener('click', () => onZoneClick?.(zone));

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

  // ── Fallback UI when no key or error ──
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
