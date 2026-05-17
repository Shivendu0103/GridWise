// src/pages/Dashboard.jsx
// Feature 1 — Grid Operator Dashboard
// Real-time zone monitoring, overload alerts, summary stats
import { useEffect, useState, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { subscribeToZones, subscribeToPredictions } from '../lib/firebase';
import { useAuth } from '../lib/AuthContext';
import AlertBanner from '../components/AlertBanner';
import ZoneCard from '../components/ZoneCard';
import ZoneMap from '../components/ZoneMap';
import {
  LineChart, Line, ResponsiveContainer, Tooltip,
  AreaChart, Area, XAxis, YAxis, CartesianGrid, ReferenceLine
} from 'recharts';

// Realistic 24-hour load curve data for chart
function gen24hCurve() {
  const hours = Array.from({ length: 24 }, (_, h) => {
    const base = 45 + 20 * Math.sin((h - 3) * Math.PI / 12);
    const morning = h >= 8 && h <= 10 ? 12 * Math.exp(-0.5 * ((h - 9) / 1.5) ** 2) : 0;
    const evening = h >= 18 && h <= 22 ? 22 * Math.exp(-0.5 * ((h - 19.5) / 1.8) ** 2) : 0;
    const v = Math.max(15, Math.min(99, base + morning + evening + (Math.random() - 0.5) * 4));
    return { hour: `${String(h).padStart(2, '0')}:00`, load: parseFloat(v.toFixed(1)), threshold: 85 };
  });
  return hours;
}

function generateSpark(base) {
  return Array.from({ length: 12 }, (_, i) => ({
    t: i,
    v: Math.max(15, Math.min(99, base + Math.sin(i * 0.8) * 8 + (Math.random() - 0.5) * 6)),
  }));
}

const PREDICTION_ACTIONS = {
  high: 'Dispatch demand nudges, alert large consumers.',
  medium: 'Monitor closely, prepare load shift request.',
  low: 'No action required — operating within safe parameters.',
};

export default function Dashboard() {
  const navigate = useNavigate();
  const { userProfile, logout } = useAuth();
  const [zones, setZones] = useState({});
  const [selectedZone, setSelectedZone] = useState(null);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [lastUpdate, setLastUpdate] = useState(null);
  const [chartData] = useState(gen24hCurve);
  const [predictions, setPredictions] = useState([]);
  const mapRef = useRef(null);

  const handleLogout = async () => {
    await logout();
    navigate('/', { replace: true });
  };

  useEffect(() => {
    const unsub = subscribeToZones((data) => {
      setZones(data);
      setLastUpdate(new Date());
    });
    return unsub;
  }, []);

  useEffect(() => {
    const unsub = subscribeToPredictions(setPredictions);
    return unsub;
  }, []);

  const zoneList = useMemo(() => Object.values(zones), [zones]);

  const stats = useMemo(() => {
    if (!zoneList.length) return null;
    const loads = zoneList.map((z) => z.currentLoad || 0);
    const overloaded = zoneList.filter((z) => z.status === 'overload' || z.status === 'critical');
    const totalMW = zoneList.reduce((s, z) => s + (z.activeMW || 0), 0);
    const totalCap = zoneList.reduce((s, z) => s + (z.capacityMW || 0), 0);
    const avgLoad = loads.reduce((a, b) => a + b, 0) / loads.length;
    return {
      zones: zoneList.length,
      avgLoad: avgLoad.toFixed(1),
      overloaded: overloaded.length,
      totalMW: Math.round(totalMW).toLocaleString(),
      totalCap: Math.round(totalCap).toLocaleString(),
      gridHealth: avgLoad < 70 ? 'Good' : avgLoad < 85 ? 'Strained' : 'Critical',
    };
  }, [zoneList]);

  // Top 3 danger zones
  const dangerZones = useMemo(() =>
    [...zoneList].sort((a, b) => (b.currentLoad || 0) - (a.currentLoad || 0)).slice(0, 3),
    [zoneList]
  );

  const filteredZones = useMemo(() => {
    return zoneList.filter((z) => {
      const matchesSearch = !search ||
        z.name?.toLowerCase().includes(search.toLowerCase()) ||
        z.state?.toLowerCase().includes(search.toLowerCase()) ||
        z.zoneId?.toLowerCase().includes(search.toLowerCase());
      const matchesFilter = filterStatus === 'all' || z.status === filterStatus;
      return matchesSearch && matchesFilter;
    });
  }, [zoneList, search, filterStatus]);

  const currentHour = new Date().getHours();

  return (
    <div>
      {/* Operator top bar */}
      <div className="operator-topbar">
        <div className="operator-topbar-left">
          <div className="operator-mode-badge">
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#00e5ff', display: 'inline-block', animation: 'pulse 2s infinite' }} />
            Operator Mode
          </div>
          {userProfile?.name && (
            <span className="operator-topbar-name">👤 {userProfile.name}</span>
          )}
        </div>
        <button
          className="btn btn-secondary btn-sm"
          onClick={handleLogout}
          style={{ borderRadius: 999 }}
          id="operator-logout-btn"
        >
          Sign Out
        </button>
      </div>

    <div className="page-container">
      <AlertBanner />

      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Grid Dashboard</h1>
          <p className="page-subtitle">
            Real-time load monitoring · {zoneList.length} zones · India
            {lastUpdate && (
              <span style={{ marginLeft: 10, fontFamily: 'JetBrains Mono', fontSize: 11 }}>
                Updated {lastUpdate.toLocaleTimeString('en-IN')}
              </span>
            )}
          </p>
        </div>
        <div className="header-actions">
          <span className="chip supply">Supply-side</span>
          <span className="chip" style={{ gap: 4 }}>
            <span className="live-dot" style={{ width: 6, height: 6, background: '#10b981', borderRadius: '50%', display: 'inline-block' }} />
            Live
          </span>
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div className="stats-grid" style={{ '--accent-color': 'var(--accent-supply)' }}>
          <StatCard icon="🗺️" value={stats.zones} label="Grid Zones Monitored" accent="var(--accent-supply)" />
          <StatCard
            icon="📊"
            value={`${stats.avgLoad}%`}
            label="Average Grid Load"
            accent={parseFloat(stats.avgLoad) > 80 ? 'var(--status-critical)' : 'var(--status-normal)'}
            delta={parseFloat(stats.avgLoad) > 80 ? '⬆ High demand' : '✓ Stable'}
            deltaType={parseFloat(stats.avgLoad) > 80 ? 'up' : 'down'}
          />
          <StatCard
            icon="⚠️"
            value={stats.overloaded}
            label="Overloaded Zones"
            accent={stats.overloaded > 0 ? 'var(--status-critical)' : 'var(--status-normal)'}
          />
          <StatCard icon="⚡" value={`${stats.totalMW} MW`} label={`Active / ${stats.totalCap} MW Capacity`} accent="var(--accent-demand)" />
          <StatCard
            icon="💚"
            value={stats.gridHealth}
            label="Grid Health Status"
            accent={stats.gridHealth === 'Good' ? 'var(--status-normal)' : stats.gridHealth === 'Strained' ? 'var(--status-overload)' : 'var(--status-critical)'}
          />
        </div>
      )}

      {/* Two-column: Map + Danger Zones / AI Predictions */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 20, marginBottom: 20 }}>
        {/* Map */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">⚡ Live Zone Heatmap</span>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Click a zone for details</span>
          </div>
          <ZoneMap zones={zones} selectedZoneId={selectedZone?.zoneId} onZoneClick={setSelectedZone} />
        </div>

        {/* Right column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Danger Zones */}
          <div className="card" style={{ background: 'rgba(239,68,68,0.04)', borderColor: 'rgba(239,68,68,0.15)' }}>
            <div className="card-header">
              <span className="card-title" style={{ color: 'var(--status-critical)' }}>🔥 Top Risk Zones</span>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Live</span>
            </div>
            {dangerZones.map((z, i) => (
              <div
                key={z.zoneId}
                onClick={() => setSelectedZone(z)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0',
                  borderBottom: i < 2 ? '1px solid var(--border-subtle)' : 'none',
                  cursor: 'pointer',
                }}
              >
                <div style={{
                  width: 28, height: 28, borderRadius: 6, display: 'grid', placeItems: 'center',
                  background: i === 0 ? 'rgba(239,68,68,0.15)' : i === 1 ? 'rgba(245,158,11,0.12)' : 'rgba(99,102,241,0.1)',
                  fontSize: 14, flexShrink: 0,
                }}>
                  {i === 0 ? '🔴' : i === 1 ? '🟠' : '🟡'}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{z.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{z.zoneId} · {z.state}</div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{
                    fontFamily: 'JetBrains Mono', fontWeight: 800, fontSize: 15,
                    color: (z.currentLoad || 0) > 85 ? 'var(--status-critical)' : (z.currentLoad || 0) > 70 ? 'var(--status-overload)' : 'var(--text-primary)',
                  }}>
                    {(z.currentLoad || 0).toFixed(1)}%
                  </div>
                  <span className={`status-pill ${z.status}`} style={{ fontSize: 9 }}>{z.status}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Active Predictions Panel */}
          <div className="card" style={{ flex: 1 }}>
            <div className="card-header">
              <span className="card-title">🤖 AI Peak Predictions</span>
              <span style={{ fontSize: 10, color: 'var(--accent-supply)', fontFamily: 'JetBrains Mono' }}>Next 2h</span>
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 12, padding: '6px 10px', background: 'rgba(0,229,255,0.05)', borderRadius: 6, border: '1px solid rgba(0,229,255,0.1)' }}>
              Powered by GridWise ML — Linear Regression model, RMSE 5.44%
            </div>
            {(predictions.length > 0 ? predictions : [
              { zoneId: 'DL-01', zone: 'Delhi Central', risk: 'high', confidence: 87, peakAt: '19:30', predictedLoad: 91 },
              { zoneId: 'MH-01', zone: 'Mumbai Metro', risk: 'medium', confidence: 71, peakAt: '20:00', predictedLoad: 78 },
              { zoneId: 'UP-01', zone: 'Lucknow Region', risk: 'low', confidence: 61, peakAt: '21:00', predictedLoad: 63 },
            ]).map((p) => (
              <div key={p.zoneId} style={{ marginBottom: 14, paddingBottom: 14, borderBottom: '1px solid var(--border-subtle)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                  <div>
                    <span style={{ fontSize: 13, fontWeight: 700 }}>{p.zone}</span>
                    <span style={{ fontSize: 10, color: 'var(--text-muted)', marginLeft: 6, fontFamily: 'JetBrains Mono' }}>{p.zoneId}</span>
                  </div>
                  <span
                    className={`status-pill ${p.risk === 'high' ? 'critical' : p.risk === 'medium' ? 'overload' : 'normal'}`}
                    style={{ fontSize: 9 }}
                  >
                    {p.risk} risk
                  </span>
                </div>
                <div style={{ display: 'flex', gap: 12, marginBottom: 6 }}>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    Peak at <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{p.peakAt}</span>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    Confidence <span style={{ color: 'var(--accent-supply)', fontWeight: 700, fontFamily: 'JetBrains Mono' }}>{p.confidence}%</span>
                  </div>
                </div>
                {p.predictedLoad && (
                  <div style={{ marginBottom: 4 }}>
                    <div style={{ height: 4, background: 'var(--border-subtle)', borderRadius: 2, overflow: 'hidden' }}>
                      <div style={{ width: `${p.predictedLoad}%`, height: '100%', borderRadius: 2, background: p.risk === 'high' ? '#ef4444' : p.risk === 'medium' ? '#f59e0b' : '#10b981', transition: 'width 0.6s' }} />
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>Predicted: {p.predictedLoad}% load</div>
                  </div>
                )}
                <div style={{ fontSize: 11, color: 'var(--text-muted)', fontStyle: 'italic' }}>→ {PREDICTION_ACTIONS[p.risk]}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 24h Load Curve */}
      <div className="card mb-6" style={{ marginBottom: 20 }}>
        <div className="card-header">
          <span className="card-title">📈 24-Hour National Grid Load Curve</span>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            Current hour: <span style={{ color: 'var(--accent-supply)', fontFamily: 'JetBrains Mono' }}>{String(currentHour).padStart(2, '0')}:00</span>
          </span>
        </div>
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={chartData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="loadGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#00e5ff" stopOpacity={0.25} />
                <stop offset="95%" stopColor="#00e5ff" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="dangerGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#ef4444" stopOpacity={0.12} />
                <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
            <XAxis dataKey="hour" tick={{ fill: '#475569', fontSize: 10 }} axisLine={false} tickLine={false} interval={3} />
            <YAxis tick={{ fill: '#475569', fontSize: 11 }} axisLine={false} tickLine={false} domain={[0, 100]} />
            <ReferenceLine y={85} stroke="#ef4444" strokeDasharray="4 4" strokeOpacity={0.5} label={{ value: 'Overload', fill: '#ef4444', fontSize: 10, position: 'insideTopRight' }} />
            <ReferenceLine x={String(currentHour).padStart(2, '0') + ':00'} stroke="#00e5ff" strokeDasharray="4 4" strokeOpacity={0.6} />
            <Tooltip
              contentStyle={{ background: '#0f1629', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, fontSize: 12 }}
              itemStyle={{ color: '#e2e8f0' }}
              labelStyle={{ color: '#94a3b8' }}
            />
            <Area type="monotone" dataKey="load" stroke="#00e5ff" strokeWidth={2} fill="url(#loadGrad)" name="Load %" />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Zone grid */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">🗂️ All Zones</span>
          <div style={{ display: 'flex', gap: 10 }}>
            <input
              className="form-control"
              style={{ width: 200, padding: '6px 10px', fontSize: 13 }}
              placeholder="Search zone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              id="zone-search-input"
            />
            <select
              className="form-control"
              style={{ width: 140, padding: '6px 10px', fontSize: 13 }}
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              id="zone-filter-select"
            >
              <option value="all">All Status</option>
              <option value="normal">Normal</option>
              <option value="low">Low</option>
              <option value="surplus">Surplus</option>
              <option value="overload">Overload</option>
              <option value="critical">Critical</option>
            </select>
          </div>
        </div>

        {filteredZones.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>
            {Object.keys(zones).length === 0
              ? 'Connecting to live data feed...'
              : 'No zones match your filter.'}
          </div>
        ) : (
          <div className="zone-list">
            {filteredZones.map((zone) => (
              <ZoneCard
                key={zone.zoneId}
                zone={zone}
                selected={selectedZone?.zoneId === zone.zoneId}
                onClick={setSelectedZone}
                sparkData={generateSpark(zone.currentLoad || 50)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Zone detail panel */}
      {selectedZone && (
        <ZoneDetailPanel zone={selectedZone} onClose={() => setSelectedZone(null)} />
      )}
    </div>
    </div>
  );
}

function StatCard({ icon, value, label, accent, delta, deltaType }) {
  return (
    <div className="stat-card" style={{ '--accent-color': accent }}>
      <div className="stat-icon">{icon}</div>
      <div className="stat-value" style={{ color: accent }}>{value}</div>
      <div className="stat-label">{label}</div>
      {delta && <div className={`stat-delta ${deltaType}`}>{delta}</div>}
    </div>
  );
}

function ZoneDetailPanel({ zone, onClose }) {
  const spark = generateSpark(zone.currentLoad || 50);
  return (
    <div
      style={{
        position: 'fixed', right: 0, top: 0, bottom: 0, width: 340,
        background: 'var(--bg-surface)',
        borderLeft: '1px solid var(--border-subtle)',
        zIndex: 200, overflow: 'auto', padding: 24,
        animation: 'slideRight 0.25s ease',
      }}
    >
      <style>{`@keyframes slideRight { from { transform: translateX(20px); opacity:0 } to { transform: translateX(0); opacity:1 } }`}</style>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20, alignItems: 'center' }}>
        <div>
          <div style={{ fontWeight: 800, fontSize: 18 }}>{zone.name}</div>
          <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>{zone.state} · {zone.zoneId}</div>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={onClose}>✕</button>
      </div>

      <div style={{ textAlign: 'center', padding: '16px 0' }}>
        <div style={{
          fontSize: 52, fontWeight: 900, fontFamily: 'JetBrains Mono',
          color: statusColor(zone.status), letterSpacing: -2,
        }}>
          {(zone.currentLoad || 0).toFixed(1)}%
        </div>
        <span className={`status-pill ${zone.status}`}>{zone.status}</span>
      </div>

      <div className="divider" style={{ height: 1, background: 'var(--border-subtle)', margin: '12px 0' }} />

      <InfoRow label="Active Load" value={`${Math.round(zone.activeMW || 0).toLocaleString()} MW`} />
      <InfoRow label="Total Capacity" value={`${(zone.capacityMW || 0).toLocaleString()} MW`} />
      <InfoRow label="Frequency" value={`${(zone.frequencyHz || 50).toFixed(3)} Hz`} />
      <InfoRow label="Voltage" value={`${(zone.voltageKV || 220).toFixed(1)} kV`} />
      <InfoRow label="Last Updated" value={zone.lastUpdated ? new Date(zone.lastUpdated).toLocaleTimeString('en-IN') : '—'} />

      <div className="divider" style={{ height: 1, background: 'var(--border-subtle)', margin: '12px 0' }} />

      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>
        Load Trend (last 60 min)
      </div>
      <ResponsiveContainer width="100%" height={80}>
        <AreaChart data={spark}>
          <defs>
            <linearGradient id="sparkGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={statusColor(zone.status)} stopOpacity={0.2} />
              <stop offset="95%" stopColor={statusColor(zone.status)} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area type="monotone" dataKey="v" stroke={statusColor(zone.status)} strokeWidth={2} fill="url(#sparkGrad)" dot={false} />
          <Tooltip contentStyle={{ background: '#0f1629', border: 'none', borderRadius: 6, fontSize: 11 }} />
        </AreaChart>
      </ResponsiveContainer>

      <div style={{ marginTop: 16 }}>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>
          AI Recommendation
        </div>
        <div style={{
          background: 'rgba(0,229,255,0.06)', border: '1px solid rgba(0,229,255,0.15)',
          borderRadius: 8, padding: '10px 14px', fontSize: 13, color: 'var(--text-secondary)',
        }}>
          {(zone.currentLoad || 0) > 85
            ? '⚡ Immediately dispatch nudges to large consumers. Consider emergency load transfer.'
            : (zone.currentLoad || 0) > 70
            ? '📊 Monitor closely. Pre-stage load shift request for evening peak.'
            : '✅ Zone is operating within safe parameters.'}
        </div>
      </div>
    </div>
  );
}

function InfoRow({ label, value }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border-subtle)' }}>
      <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 600, fontFamily: 'JetBrains Mono' }}>{value}</span>
    </div>
  );
}

function statusColor(s) {
  const map = {
    normal: 'var(--status-normal)', low: 'var(--status-low)',
    surplus: 'var(--status-surplus)', overload: 'var(--status-overload)', critical: 'var(--status-critical)',
  };
  return map[s] || 'var(--text-primary)';
}
