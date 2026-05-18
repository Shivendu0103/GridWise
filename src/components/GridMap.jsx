import { useState, useEffect } from 'react';
import { MapContainer, TileLayer, CircleMarker, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix Leaflet's default marker icon issue
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: null,
  iconUrl: null,
  shadowUrl: null
});

// Helper for zone colors
function getZoneColor(status) {
  switch (status) {
    case 'surplus':
    case 'low': return '#3b82f6'; // Blue
    case 'normal': return '#10b981'; // Green
    case 'warning':
    case 'overload': return '#f59e0b'; // Amber
    case 'critical': return '#ef4444'; // Red
    default: return '#10b981';
  }
}

// Custom DivIcons for citizen reports
const getReportIcon = (type) => {
  let color = '#9ca3af'; // Grey for other
  switch (type) {
    case 'power_cut':
    case 'outage': color = '#ef4444'; break;
    case 'voltage_fluctuation':
    case 'voltage': color = '#f59e0b'; break;
    case 'transformer_fault':
    case 'transformer': color = '#f97316'; break;
    case 'low_voltage':
    case 'lowvoltage': color = '#eab308'; break;
  }
  
  return L.divIcon({
    className: 'custom-report-icon',
    html: `<div style="background-color: ${color}; width: 8px; height: 8px; border-radius: 50%; border: 1px solid white;"></div>`,
    iconSize: [8, 8],
    iconAnchor: [4, 4]
  });
};

function formatTimeAgo(dateString) {
  const diff = Date.now() - new Date(dateString).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins} mins ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hours ago`;
  return `${Math.floor(hrs / 24)} days ago`;
}

export default function GridMap({ zones, reports = [], predictions = [] }) {
  const [showZones, setShowZones] = useState(true);
  const [showReports, setShowReports] = useState(true);
  const [mapReady, setMapReady] = useState(false);

  useEffect(() => {
    setMapReady(true);
  }, []);

  if (!mapReady) return null;

  return (
    <div className="map-wrapper" style={{ position: 'relative', width: '100%', minHeight: '600px', height: '100%', flex: 1, borderRadius: 'inherit', overflow: 'hidden' }}>
      
      {/* Toggles */}
      <div style={{ position: 'absolute', top: 10, right: 10, zIndex: 1000, display: 'flex', gap: 8 }}>
        <button 
          onClick={() => setShowZones(!showZones)}
          style={{
            padding: '6px 12px', fontSize: 12, borderRadius: 6, cursor: 'pointer', border: '1px solid var(--border-subtle)',
            background: showZones ? 'var(--accent-supply)' : 'var(--bg-surface)',
            color: showZones ? '#000' : 'var(--text-primary)',
            fontWeight: 600
          }}
        >
          Zone Heatmap
        </button>
        <button 
          onClick={() => setShowReports(!showReports)}
          style={{
            padding: '6px 12px', fontSize: 12, borderRadius: 6, cursor: 'pointer', border: '1px solid var(--border-subtle)',
            background: showReports ? 'var(--accent-demand)' : 'var(--bg-surface)',
            color: showReports ? '#000' : 'var(--text-primary)',
            fontWeight: 600
          }}
        >
          Citizen Reports
        </button>
      </div>

      <MapContainer
        center={[20.5937, 78.9629]}
        zoom={5}
        style={{ width: '100%', height: '100%', background: '#0f1629' }}
        zoomControl={true}
        attributionControl={false}
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> contributors'
        />

        {showZones && zones.map(zone => {
          if (!zone.lat || !zone.lng) return null;
          
          const radius = Math.max(12, Math.min(28, Math.sqrt(zone.capacityMW || 1000) * 0.6));
          const color = getZoneColor(zone.status);
          const prediction = predictions.find(p => p.zoneId === zone.zoneId);

          return (
            <CircleMarker
              key={zone.zoneId}
              center={[zone.lat, zone.lng]}
              radius={radius}
              pathOptions={{
                fillColor: color,
                fillOpacity: 0.7,
                color: '#ffffff',
                weight: 1.5,
              }}
            >
              <Popup className="dark-popup">
                <div style={{ padding: '4px', minWidth: 200 }}>
                  <div style={{ fontWeight: 800, fontSize: 14 }}>{zone.name}</div>
                  <div style={{ fontSize: 11, color: '#64748b', marginBottom: 8 }}>{zone.state}</div>
                  
                  <div style={{ marginBottom: 8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                      <span>Current Load</span>
                      <span style={{ fontWeight: 700 }}>{(zone.currentLoad || 0).toFixed(1)}%</span>
                    </div>
                    <div style={{ width: '100%', height: 6, background: '#334155', borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{ width: `${Math.min(zone.currentLoad || 0, 100)}%`, height: '100%', background: color }} />
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, borderBottom: '1px solid #334155', paddingBottom: 4, marginBottom: 4 }}>
                    <span style={{ color: '#94a3b8' }}>Capacity</span>
                    <span>{Math.round(zone.capacityMW || 0)} MW</span>
                  </div>

                  {prediction && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, borderBottom: '1px solid #334155', paddingBottom: 4, marginBottom: 4 }}>
                      <span style={{ color: '#94a3b8' }}>Predicted Peak ({prediction.peakAt})</span>
                      <span style={{ fontWeight: 700, color: '#00e5ff' }}>{prediction.predictedLoad}%</span>
                    </div>
                  )}

                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginTop: 6, alignItems: 'center' }}>
                    <span style={{ color: '#94a3b8' }}>Status</span>
                    <span style={{ background: color, color: '#000', padding: '2px 6px', borderRadius: 4, fontWeight: 700, fontSize: 10, textTransform: 'uppercase' }}>
                      {zone.status}
                    </span>
                  </div>
                </div>
              </Popup>
            </CircleMarker>
          );
        })}

        {showReports && reports.map(report => {
          let lat = report.lat;
          let lng = report.lng;
          
          if (!lat || !lng) {
            const zone = zones.find(z => z.zoneId === report.zoneId);
            if (zone && zone.lat && zone.lng) {
              // Add jitter so reports don't perfectly overlap
              lat = zone.lat + (Math.random() - 0.5) * 0.15;
              lng = zone.lng + (Math.random() - 0.5) * 0.15;
            } else {
              return null; // Cannot determine any location
            }
          }

          const typeString = report.issueType || report.type || 'other';

          return (
            <Marker 
              key={report.id} 
              position={[lat, lng]} 
              icon={getReportIcon(typeString)}
            >
              <Popup className="dark-popup">
                <div style={{ padding: '4px' }}>
                  <div style={{ fontWeight: 700, fontSize: 13, textTransform: 'capitalize', marginBottom: 4 }}>
                    {typeString.replace(/_/g, ' ')}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 4 }}>
                    <span style={{ color: '#94a3b8' }}>Severity</span>
                    <span style={{ fontWeight: 600 }}>{report.severity || 'Normal'}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 6 }}>
                    <span style={{ color: '#94a3b8' }}>Reported</span>
                    <span>{report.timestamp ? formatTimeAgo(report.timestamp) : 'Unknown'}</span>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ 
                      background: report.status === 'pending' ? '#ef4444' : report.status === 'in_progress' ? '#f59e0b' : '#10b981', 
                      color: '#fff', padding: '2px 6px', borderRadius: 4, fontSize: 10, textTransform: 'uppercase', fontWeight: 600
                    }}>
                      {report.status ? report.status.replace('_', ' ') : 'Unknown'}
                    </span>
                  </div>
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>

      {/* Legend */}
      <div style={{
        position: 'absolute', bottom: 20, right: 10, zIndex: 1000, 
        background: 'rgba(15, 22, 41, 0.9)', padding: 12, borderRadius: 8, border: '1px solid var(--border-subtle)'
      }}>
        <div style={{ display: 'flex', gap: 24 }}>
          {/* Zone Legend */}
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', marginBottom: 6, textTransform: 'uppercase' }}>Zone Load</div>
            {[
              { label: 'Normal', color: '#10b981' },
              { label: 'Warning', color: '#f59e0b' },
              { label: 'Critical', color: '#ef4444' },
              { label: 'Underload', color: '#3b82f6' }
            ].map(item => (
              <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4, fontSize: 11 }}>
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: item.color }} />
                <span>{item.label}</span>
              </div>
            ))}
          </div>

          {/* Report Legend */}
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', marginBottom: 6, textTransform: 'uppercase' }}>Citizen Reports</div>
            {[
              { label: 'Power Cut', color: '#ef4444' },
              { label: 'Voltage Flux', color: '#f59e0b' },
              { label: 'Transformer', color: '#f97316' },
              { label: 'Other', color: '#9ca3af' }
            ].map(item => (
              <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4, fontSize: 11 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: item.color }} />
                <span>{item.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
