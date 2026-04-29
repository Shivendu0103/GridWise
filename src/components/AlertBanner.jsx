// src/components/AlertBanner.jsx
// Live overload alert banners with toast stack, dismiss animation, sound toggle
import { useEffect, useState, useRef, useCallback } from 'react';
import { subscribeToAlerts, resolveAlert } from '../lib/firebase';

export default function AlertBanner() {
  const [alerts, setAlerts] = useState([]);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [dismissed, setDismissed] = useState(new Set());
  const prevAlertIds = useRef(new Set());
  const audioCtx = useRef(null);

  const playBeep = useCallback(() => {
    if (!soundEnabled) return;
    try {
      if (!audioCtx.current) audioCtx.current = new (window.AudioContext || window.webkitAudioContext)();
      const ctx = audioCtx.current;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.3);
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.4);
    } catch { /* ignore */ }
  }, [soundEnabled]);

  useEffect(() => {
    const unsub = subscribeToAlerts((data) => {
      const newAlerts = data.slice(0, 5);
      // Detect new alerts
      newAlerts.forEach((a) => {
        if (!prevAlertIds.current.has(a.id)) playBeep();
      });
      prevAlertIds.current = new Set(newAlerts.map((a) => a.id));
      setAlerts(newAlerts);
    });
    return unsub;
  }, [playBeep]);

  const handleDismiss = (alertId) => {
    setDismissed((prev) => new Set([...prev, alertId]));
    setTimeout(() => resolveAlert(alertId), 300);
  };

  const visible = alerts.filter((a) => !dismissed.has(a.id));
  if (visible.length === 0) return null;

  return (
    <div style={{ marginBottom: 20 }}>
      {/* Sound toggle */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 6 }}>
        <button
          onClick={() => setSoundEnabled((s) => !s)}
          className="btn btn-secondary btn-sm"
          style={{ fontSize: 11, gap: 4 }}
          title="Toggle alert sound"
        >
          {soundEnabled ? '🔔' : '🔕'} Alert Sound {soundEnabled ? 'On' : 'Off'}
        </button>
      </div>

      {/* Toast stack */}
      {visible.map((alert) => (
        <div
          key={alert.id}
          className={`alert-banner ${alert.status}`}
          style={{
            animation: dismissed.has(alert.id)
              ? 'alertDismiss 0.3s ease forwards'
              : 'alertIn 0.35s cubic-bezier(0.34,1.56,0.64,1)',
            marginBottom: 10,
          }}
        >
          <style>{`
            @keyframes alertIn { from { opacity:0; transform:translateY(-12px) scale(0.97); } to { opacity:1; transform:translateY(0) scale(1); } }
            @keyframes alertDismiss { to { opacity:0; transform:translateX(20px); max-height:0; padding:0; margin:0; } }
          `}</style>

          <span className="alert-banner-icon">
            {alert.status === 'critical' ? '🔴' : '🟠'}
          </span>

          <div className="alert-banner-content">
            <div className="alert-banner-title">
              {alert.status === 'critical' ? 'CRITICAL OVERLOAD' : 'OVERLOAD WARNING'} — {alert.zoneName}
            </div>
            <div className="alert-banner-desc">
              {alert.state} · {alert.load?.toFixed ? alert.load.toFixed(1) : alert.load}% load
              {alert.activeMW ? ` · ${Math.round(alert.activeMW)} / ${alert.capacityMW} MW` : ''}
            </div>
          </div>

          <span className="alert-banner-time">
            {new Date(alert.timestamp).toLocaleTimeString('en-IN', {
              hour: '2-digit', minute: '2-digit', second: '2-digit',
            })}
          </span>

          <button
            className="btn btn-secondary btn-sm"
            style={{ marginLeft: 10 }}
            onClick={() => handleDismiss(alert.id)}
          >
            ✓ Resolve
          </button>
        </div>
      ))}
    </div>
  );
}
