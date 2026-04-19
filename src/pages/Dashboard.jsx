// src/pages/Dashboard.jsx
// Feature 1 — Grid Operator Dashboard
// Real-time zone monitoring, overload alerts, summary stats
import { useEffect, useState, useMemo } from 'react';
import { subscribeToZones } from '../lib/firebase';
import AlertBanner from '../components/AlertBanner';
import ZoneCard from '../components/ZoneCard';
import ZoneMap from '../components/ZoneMap';
import {
  LineChart, Line, ResponsiveContainer, Tooltip,
  AreaChart, Area, XAxis, YAxis, CartesianGrid
} from 'recharts';

// Mock historical spark data (replace with RTDB history in production)
function generateSpark(base) {
  return Array.from({ length: 12 }, (_, i) => ({
    t: i,
    v: Math.max(15, Math.min(99, base + Math.sin(i * 0.8) * 8 + (Math.random() - 0.5) * 6)),
  }));
}

export default function Dashboard() {
  const [zones, setZones] = useState({});
  const [selectedZone, setSelectedZone] = useState(null);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [lastUpdate, setLastUpdate] = useState(null);

  useEffect(() => {
    const unsub = subscribeToZones((data) => {
      setZones(data);
      setLastUpdate(new Date());
    });
    return unsub;
  }, []);

  const zoneList = useMemo(() => Object.values(zones), [zones]);

  // Summary stats
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

  // Filter zones
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

  // Area chart data for overview
  const chartData = useMemo(() => {
    if (!zoneList.length) return [];
    return zoneList
      .sort((a, b) => (b.currentLoad || 0) - (a.currentLoad || 0))
      .slice(0, 8)
      .map((z) => ({ name: z.zoneId, load: z.currentLoad || 0, cap: 100 }));
  }, [zoneList]);

  return (
    <div className="page-container">
      {/* Alerts */}
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
          <StatCard
            icon="🗺️"
            value={stats.zones}
            label="Grid Zones Monitored"
            accent="var(--accent-supply)"
          />
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
          <StatCard
            icon="⚡"
            value={`${stats.totalMW} MW`}
            label={`Active / ${stats.totalCap} MW Capacity`}
            accent="var(--accent-demand)"
          />
          <StatCard
            icon="💚"
            value={stats.gridHealth}
            label="Grid Health Status"
            accent={stats.gridHealth === 'Good' ? 'var(--status-normal)' : stats.gridHealth === 'Strained' ? 'var(--status-overload)' : 'var(--status-critical)'}
          />
        </div>
      )}

      {/* Map */}
      <div className="card mb-6">
        <div className="card-header">
          <span className="card-title">⚡ Live Zone Heatmap</span>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Click a zone for details</span>
        </div>
        <ZoneMap
          zones={zones}
          selectedZoneId={selectedZone?.zoneId}
          onZoneClick={setSelectedZone}
        />
      </div>

      {/* Load chart */}
      {chartData.length > 0 && (
        <div className="card mb-6">
          <div className="card-header">
            <span className="card-title">📈 Top-8 Zones by Load</span>
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={chartData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="loadGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#00e5ff" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#00e5ff" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="name" tick={{ fill: '#475569', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#475569', fontSize: 11 }} axisLine={false} tickLine={false} domain={[0, 100]} />
              <Tooltip
                contentStyle={{ background: '#0f1629', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, fontSize: 12 }}
                itemStyle={{ color: '#e2e8f0' }}
                labelStyle={{ color: '#94a3b8' }}
              />
              <Area type="monotone" dataKey="load" stroke="#00e5ff" strokeWidth={2} fill="url(#loadGrad)" name="Load %" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

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
        animation: 'slideRight 0.25s ease'
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
          color: statusColor(zone.status), letterSpacing: -2
        }}>
          {(zone.currentLoad || 0).toFixed(1)}%
        </div>
        <span className={`status-pill ${zone.status}`}>{zone.status}</span>
      </div>

      <div className="divider" />

      <InfoRow label="Active Load"    value={`${Math.round(zone.activeMW || 0).toLocaleString()} MW`} />
      <InfoRow label="Total Capacity" value={`${(zone.capacityMW || 0).toLocaleString()} MW`} />
      <InfoRow label="Frequency"      value={`${(zone.frequencyHz || 50).toFixed(3)} Hz`} />
      <InfoRow label="Voltage"        value={`${(zone.voltageKV || 220).toFixed(1)} kV`} />
      <InfoRow label="Last Updated"   value={zone.lastUpdated ? new Date(zone.lastUpdated).toLocaleTimeString('en-IN') : '—'} />

      <div className="divider" />

      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>
        Load Trend (simulated)
      </div>
      <ResponsiveContainer width="100%" height={80}>
        <LineChart data={spark}>
          <Line type="monotone" dataKey="v" stroke={statusColor(zone.status)} strokeWidth={2} dot={false} />
          <Tooltip contentStyle={{ background: '#0f1629', border: 'none', borderRadius: 6, fontSize: 11 }} />
        </LineChart>
      </ResponsiveContainer>
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
