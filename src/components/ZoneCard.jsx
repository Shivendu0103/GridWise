// src/components/ZoneCard.jsx
// Reusable zone status card with load bar, metrics, mini sparkline
import { AreaChart, Area, ResponsiveContainer } from 'recharts';

function LoadBar({ pct, status }) {
  return (
    <div className="load-bar-container" style={{ marginTop: 8, marginBottom: 10 }}>
      <div className="load-bar-track">
        <div
          className={`load-bar-fill ${status}`}
          style={{ width: `${Math.min(pct, 100)}%` }}
        />
      </div>
    </div>
  );
}

export default function ZoneCard({ zone, selected, onClick, sparkData }) {
  if (!zone) return null;

  const {
    zoneId,
    name,
    state,
    currentLoad = 0,
    activeMW = 0,
    capacityMW = 0,
    frequencyHz = 50,
    status = 'normal',
  } = zone;

  const color = statusColor(status);

  return (
    <div
      className={`zone-card ${selected ? 'selected' : ''}`}
      onClick={() => onClick?.(zone)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onClick?.(zone)}
      id={`zone-card-${zoneId}`}
    >
      <div className="zone-card-header">
        <div>
          <div className="zone-name">{name}</div>
          <div className="zone-state">{state}</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
          <span className="zone-id">{zoneId}</span>
          <span className={`status-pill ${status}`}>{status}</span>
        </div>
      </div>

      <LoadBar pct={currentLoad} status={status} />

      <div className="zone-metrics">
        <div className="zone-metric">
          <div className="zone-metric-val" style={{ color }}>
            {currentLoad.toFixed(1)}%
          </div>
          <div className="zone-metric-label">Load</div>
        </div>
        <div className="zone-metric">
          <div className="zone-metric-val">
            {Math.round(activeMW).toLocaleString()}
          </div>
          <div className="zone-metric-label">Active MW</div>
        </div>
        <div className="zone-metric">
          <div className="zone-metric-val">
            {frequencyHz?.toFixed(2)}
          </div>
          <div className="zone-metric-label">Hz</div>
        </div>
      </div>

      {/* Mini sparkline */}
      {sparkData && (
        <div style={{ marginTop: 10, height: 36, opacity: 0.7 }}>
          <ResponsiveContainer width="100%" height={36}>
            <AreaChart data={sparkData} margin={{ top: 2, right: 0, left: 0, bottom: 2 }}>
              <defs>
                <linearGradient id={`sg-${zoneId}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={color} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={color} stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area
                type="monotone"
                dataKey="v"
                stroke={color}
                strokeWidth={1.5}
                fill={`url(#sg-${zoneId})`}
                dot={false}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

function statusColor(s) {
  const map = {
    normal:   'var(--status-normal)',
    low:      'var(--status-low)',
    surplus:  'var(--status-surplus)',
    overload: 'var(--status-overload)',
    critical: 'var(--status-critical)',
  };
  return map[s] || 'var(--text-primary)';
}
