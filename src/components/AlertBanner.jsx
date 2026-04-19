// src/components/AlertBanner.jsx
// Live overload alert banners — reads from Firebase RTDB /alerts
import { useEffect, useState } from 'react';
import { subscribeToAlerts, resolveAlert } from '../lib/firebase';

export default function AlertBanner() {
  const [alerts, setAlerts] = useState([]);

  useEffect(() => {
    const unsub = subscribeToAlerts((data) => setAlerts(data.slice(0, 3))); // top 3
    return unsub;
  }, []);

  if (alerts.length === 0) return null;

  return (
    <div style={{ marginBottom: 20 }}>
      {alerts.map((alert) => (
        <div
          key={alert.id}
          className={`alert-banner ${alert.status}`}
        >
          <span className="alert-banner-icon">
            {alert.status === 'critical' ? '🔴' : '🟠'}
          </span>
          <div className="alert-banner-content">
            <div className="alert-banner-title">
              {alert.status === 'critical' ? 'CRITICAL OVERLOAD' : 'OVERLOAD WARNING'} — {alert.zoneName}
            </div>
            <div className="alert-banner-desc">
              {alert.state} · {alert.load}% load ({alert.activeMW} / {alert.capacityMW} MW)
            </div>
          </div>
          <span className="alert-banner-time">
            {new Date(alert.timestamp).toLocaleTimeString('en-IN', {
              hour: '2-digit', minute: '2-digit', second: '2-digit'
            })}
          </span>
          <button
            className="btn btn-secondary btn-sm"
            style={{ marginLeft: 10 }}
            onClick={() => resolveAlert(alert.id)}
          >
            Resolve
          </button>
        </div>
      ))}
    </div>
  );
}
