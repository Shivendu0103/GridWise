// src/pages/MicroGrid.jsx — Feature 3: Rural Micro-Grid Scenario Dashboard
// Full animated solar arc, scenario editor sliders, crisis playback
import { useState, useEffect, useRef, useCallback } from 'react';
import { AreaChart, Area, ResponsiveContainer, XAxis, YAxis, Tooltip, ReferenceLine } from 'recharts';

// Solar arc: kW output by hour (5kW peak at noon)
function solarOutput(hour, peakKw) {
  if (hour < 6 || hour > 19) return 0;
  const center = 12.5;
  const sigma = 3.2;
  return Math.max(0, peakKw * Math.exp(-0.5 * ((hour - center) / sigma) ** 2));
}

// Build 24h timeline data
function buildTimeline(peakKw, batterySize, loads, gridOnline) {
  let battery = batterySize * 0.8; // start at 80%
  return Array.from({ length: 24 }, (_, h) => {
    const solar = parseFloat(solarOutput(h, peakKw).toFixed(2));
    const totalDemand = loads.reduce((s, l) => s + l.kw, 0);
    const net = solar - totalDemand;
    if (net > 0) {
      battery = Math.min(batterySize, battery + net * 0.9);
    } else if (!gridOnline || battery > batterySize * 0.1) {
      battery = Math.max(0, battery + net);
    }
    const battPct = Math.round((battery / batterySize) * 100);
    return {
      hour: `${String(h).padStart(2, '0')}:00`,
      solar,
      demand: totalDemand,
      battery: battPct,
    };
  });
}

const DEFAULT_LOADS = [
  { id: 'hospital',   name: '🏥 PHC (Health Centre)',    kw: 1.2,  priority: 1, always: true  },
  { id: 'water',      name: '💧 Water Pump Station',      kw: 0.8,  priority: 2, always: true  },
  { id: 'lighting',   name: '💡 Street Lighting',         kw: 0.5,  priority: 3, always: false },
  { id: 'homes',      name: '🏠 Residential Homes (50)',  kw: 2.1,  priority: 4, always: false },
  { id: 'school',     name: '🏫 School / Anganwadi',      kw: 0.6,  priority: 5, always: false },
  { id: 'irrigation', name: '🌾 Irrigation Pumps',        kw: 1.8,  priority: 6, always: false },
];

const CRISES_STEPS = [
  { label: 'Solar peak — all loads active',               hour: 12, battDelta: 0    },
  { label: 'Solar fading at sunset',                      hour: 17, battDelta: -5   },
  { label: 'Evening peak — heavy load',                   hour: 19, battDelta: -15  },
  { label: 'Grid goes offline — battery critical',        hour: 21, battDelta: -20  },
  { label: 'AI sheds irrigation & homes',                 hour: 22, battDelta: -5   },
  { label: 'Only hospital & water active',                hour: 23, battDelta: -2   },
];

function BatteryRing({ pct }) {
  const r = 50, circ = 2 * Math.PI * r;
  const color = pct > 50 ? 'var(--status-normal)' : pct > 20 ? 'var(--accent-demand)' : 'var(--status-critical)';
  return (
    <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 130, height: 130 }}>
      <svg width="130" height="130" viewBox="0 0 130 130">
        <circle cx="65" cy="65" r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="12" />
        <circle cx="65" cy="65" r={r} fill="none" stroke={color} strokeWidth="12"
          strokeDasharray={circ} strokeDashoffset={circ * (1 - pct / 100)}
          strokeLinecap="round" transform="rotate(-90 65 65)"
          style={{ transition: 'stroke-dashoffset 0.8s ease, stroke 0.4s ease' }}
        />
      </svg>
      <div style={{ position: 'absolute', textAlign: 'center' }}>
        <div style={{ fontSize: 26, fontWeight: 900, fontFamily: 'JetBrains Mono', color }}>{pct}%</div>
        <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Battery</div>
      </div>
    </div>
  );
}

export default function MicroGrid() {
  // Scenario editor state
  const [peakKw, setPeakKw]           = useState(5.0);
  const [batteryKwh, setBatteryKwh]   = useState(15);
  const [gridOnline, setGridOnline]   = useState(true);
  const [loads, setLoads]             = useState(DEFAULT_LOADS);

  // Time scrubber
  const [currentHour, setCurrentHour] = useState(12);
  const [playing, setPlaying]         = useState(false);
  const playRef = useRef(null);

  // Crisis playback
  const [crisisStep, setCrisisStep]   = useState(null);
  const [crisisRunning, setCrisisRunning] = useState(false);
  const crisisRef = useRef(null);

  // Build timeline
  const timeline = buildTimeline(peakKw, batteryKwh, loads, gridOnline);
  const point = timeline[currentHour] || timeline[0];
  const solar = point.solar;
  const battPct = point.battery;

  // Available power = solar + discharge rate (simplified)
  const availKw = solar + (battPct > 10 ? Math.min(2, batteryKwh * 0.15) : 0) + (gridOnline ? 5 : 0);

  // Greedy priority load switching
  let remaining = availKw;
  const loadsWithStatus = loads.map((l) => {
    if (l.always || remaining >= l.kw) {
      remaining = Math.max(0, remaining - l.kw);
      return { ...l, active: true };
    }
    return { ...l, active: false };
  });

  const totalActivekW = loadsWithStatus.filter(l => l.active).reduce((s, l) => s + l.kw, 0);
  const totalDemandkW = loads.reduce((s, l) => s + l.kw, 0);

  // Auto-play scrubber
  useEffect(() => {
    if (playing) {
      playRef.current = setInterval(() => {
        setCurrentHour((h) => {
          if (h >= 23) { setPlaying(false); return 0; }
          return h + 1;
        });
      }, 600);
    }
    return () => clearInterval(playRef.current);
  }, [playing]);

  // Crisis playback
  const runCrisis = useCallback(() => {
    setCrisisRunning(true);
    setGridOnline(true);
    setCrisisStep(0);
    setCurrentHour(12);
    let step = 0;
    const run = () => {
      if (step >= CRISES_STEPS.length) { setCrisisRunning(false); return; }
      setTimeout(() => {
        const cs = CRISES_STEPS[step];
        setCurrentHour(cs.hour);
        setCrisisStep(step);
        if (step === 3) setGridOnline(false);
        step++;
        run();
      }, 2000);
    };
    run();
  }, []);

  const updateLoad = (id, kw) => {
    setLoads(ls => ls.map(l => l.id === id ? { ...l, kw } : l));
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Micro-Grid Console</h1>
          <p className="page-subtitle">Rural solar + battery optimizer · Priority load-switching simulator</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <span className="chip data">Simulation Mode</span>
          <button
            onClick={() => setGridOnline(g => !g)}
            className={`btn btn-sm ${gridOnline ? 'btn-secondary' : 'btn-danger'}`}
            id="grid-toggle-btn"
          >
            {gridOnline ? '🟢 Grid Online' : '🔴 Grid Offline'}
          </button>
        </div>
      </div>

      {/* Metrics row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 20 }}>
        <div className="card" style={{ textAlign: 'center', padding: 20 }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', marginBottom: 12 }}>Battery State</div>
          <BatteryRing pct={battPct} />
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8 }}>
            {battPct > 50 ? 'Charging / Stable' : battPct > 20 ? 'Discharging' : '⚠️ Low — Shedding'}
          </div>
        </div>

        <div className="card" style={{ textAlign: 'center', padding: 20 }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', marginBottom: 8 }}>Solar Input</div>
          <div style={{ fontSize: 52, margin: '8px 0' }}>☀️</div>
          <div style={{ fontSize: 28, fontWeight: 900, fontFamily: 'JetBrains Mono', color: 'var(--accent-demand)' }}>
            {solar.toFixed(1)} kW
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>of {peakKw} kW peak</div>
          <div className="load-bar-track" style={{ marginTop: 10 }}>
            <div className="load-bar-fill normal" style={{ width: `${(solar / peakKw) * 100}%` }} />
          </div>
        </div>

        <div className="card" style={{ textAlign: 'center', padding: 20 }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', marginBottom: 8 }}>Active Load</div>
          <div style={{ fontSize: 52, margin: '8px 0' }}>⚡</div>
          <div style={{ fontSize: 28, fontWeight: 900, fontFamily: 'JetBrains Mono', color: 'var(--accent-supply)' }}>
            {totalActivekW.toFixed(1)} kW
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>of {totalDemandkW.toFixed(1)} kW demand</div>
          <div className="load-bar-track" style={{ marginTop: 10 }}>
            <div
              className={`load-bar-fill ${totalActivekW / totalDemandkW > 0.9 ? 'normal' : totalActivekW / totalDemandkW > 0.6 ? 'overload' : 'critical'}`}
              style={{ width: `${(totalActivekW / totalDemandkW) * 100}%` }}
            />
          </div>
        </div>

        <div className="card" style={{ textAlign: 'center', padding: 20 }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', marginBottom: 8 }}>Time</div>
          <div style={{ fontSize: 52, margin: '8px 0' }}>🕐</div>
          <div style={{ fontSize: 32, fontWeight: 900, fontFamily: 'JetBrains Mono', color: 'var(--text-primary)' }}>
            {String(currentHour).padStart(2, '0')}:00
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>Simulation hour</div>
        </div>
      </div>

      {/* 24h Chart + Time Scrubber */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-header">
          <span className="card-title">📊 24-Hour Energy Flow</span>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button className="btn btn-secondary btn-sm" onClick={() => setPlaying(p => !p)} id="play-btn">
              {playing ? '⏸ Pause' : '▶ Play Day'}
            </button>
            <button className="btn btn-danger btn-sm" onClick={runCrisis} disabled={crisisRunning} id="crisis-btn">
              {crisisRunning ? '🔴 Crisis Running…' : '⚡ Run Crisis'}
            </button>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={180}>
          <AreaChart data={timeline} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="solarG" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="demandG" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#ef4444" stopOpacity={0.2} />
                <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="hour" tick={{ fill: '#475569', fontSize: 9 }} axisLine={false} tickLine={false} interval={3} />
            <YAxis tick={{ fill: '#475569', fontSize: 10 }} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={{ background: '#0f1629', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, fontSize: 11 }} />
            <ReferenceLine x={String(currentHour).padStart(2, '0') + ':00'} stroke="#00e5ff" strokeDasharray="4 4" strokeOpacity={0.8} label={{ value: 'Now', fill: '#00e5ff', fontSize: 10 }} />
            <Area type="monotone" dataKey="solar"  stroke="#f59e0b" strokeWidth={2} fill="url(#solarG)"  name="Solar (kW)" isAnimationActive={false} />
            <Area type="monotone" dataKey="demand" stroke="#ef4444" strokeWidth={1.5} fill="url(#demandG)" name="Demand (kW)" isAnimationActive={false} />
          </AreaChart>
        </ResponsiveContainer>

        {/* Hour slider */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 12 }}>
          <span style={{ fontSize: 11, color: 'var(--text-muted)', flexShrink: 0 }}>00:00</span>
          <input
            type="range" min={0} max={23} value={currentHour}
            onChange={e => { setCurrentHour(parseInt(e.target.value)); setPlaying(false); }}
            style={{ flex: 1, accentColor: 'var(--accent-supply)' }}
            id="hour-slider"
          />
          <span style={{ fontSize: 11, color: 'var(--text-muted)', flexShrink: 0 }}>23:00</span>
        </div>
      </div>

      {/* Crisis step indicator */}
      {crisisStep !== null && (
        <div className="card" style={{ marginBottom: 20, background: 'rgba(239,68,68,0.05)', borderColor: 'rgba(239,68,68,0.2)' }}>
          <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
            <div style={{ fontSize: 28 }}>🚨</div>
            <div>
              <div style={{ fontWeight: 700, color: 'var(--status-critical)', marginBottom: 4 }}>Crisis Simulation — Step {crisisStep + 1}/{CRISES_STEPS.length}</div>
              <div style={{ fontSize: 14, color: 'var(--text-secondary)' }}>{CRISES_STEPS[crisisStep]?.label}</div>
              <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
                {CRISES_STEPS.map((s, i) => (
                  <div key={i} style={{ height: 4, flex: 1, borderRadius: 2, background: i <= crisisStep ? 'var(--status-critical)' : 'rgba(255,255,255,0.1)', transition: 'background 0.4s' }} />
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Two columns: priority loads + scenario editor */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 20 }}>
        {/* Priority Load Switching */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">🔌 Priority Load Switching</span>
            <span style={{ fontSize: 11, color: 'var(--accent-supply)', fontFamily: 'JetBrains Mono' }}>
              Available: {availKw.toFixed(1)} kW
            </span>
          </div>
          {loadsWithStatus.map((l) => (
            <div key={l.id} style={{
              display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0',
              borderBottom: '1px solid var(--border-subtle)',
              opacity: l.active ? 1 : 0.4,
              transition: 'opacity 0.5s',
            }}>
              {/* Priority badge */}
              <div style={{
                width: 28, height: 28, borderRadius: 6, display: 'grid', placeItems: 'center',
                background: l.active ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.1)',
                border: `1px solid ${l.active ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.2)'}`,
                fontSize: 12, fontWeight: 700, color: l.active ? 'var(--status-normal)' : 'var(--status-critical)',
                flexShrink: 0,
              }}>
                P{l.priority}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 600 }}>{l.name}</div>
                {l.always && <div style={{ fontSize: 10, color: 'var(--status-normal)', marginTop: 2 }}>Always on — Critical priority</div>}
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontFamily: 'JetBrains Mono', fontWeight: 700, fontSize: 15, color: l.active ? 'var(--accent-supply)' : 'var(--text-muted)' }}>
                  {l.kw.toFixed(1)} kW
                </div>
                <span className={`status-pill ${l.active ? 'normal' : 'critical'}`} style={{ fontSize: 9 }}>
                  {l.active ? 'ON' : 'SHED'}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Scenario Editor */}
        <div className="card">
          <div className="card-title" style={{ marginBottom: 16 }}>🎛️ Scenario Editor</div>

          <div className="form-group">
            <label className="form-label">Solar Panel Capacity</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <input type="range" min={1} max={20} step={0.5} value={peakKw}
                onChange={e => setPeakKw(parseFloat(e.target.value))}
                style={{ flex: 1, accentColor: 'var(--accent-demand)' }}
                id="solar-slider"
              />
              <span style={{ fontFamily: 'JetBrains Mono', fontWeight: 700, color: 'var(--accent-demand)', minWidth: 52 }}>
                {peakKw} kW
              </span>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Battery Capacity</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <input type="range" min={5} max={100} step={5} value={batteryKwh}
                onChange={e => setBatteryKwh(parseInt(e.target.value))}
                style={{ flex: 1, accentColor: 'var(--status-normal)' }}
                id="battery-slider"
              />
              <span style={{ fontFamily: 'JetBrains Mono', fontWeight: 700, color: 'var(--status-normal)', minWidth: 52 }}>
                {batteryKwh} kWh
              </span>
            </div>
          </div>

          <div className="card-title" style={{ marginBottom: 12, marginTop: 8 }}>Load Values (kW)</div>
          {loads.map((l) => (
            <div key={l.id} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {l.name.replace(/^[^\s]+\s/, '')}
              </div>
              <input
                type="range" min={0.1} max={5} step={0.1} value={l.kw}
                onChange={e => updateLoad(l.id, parseFloat(e.target.value))}
                style={{ width: 80, accentColor: 'var(--accent-supply)' }}
              />
              <span style={{ fontFamily: 'JetBrains Mono', fontSize: 12, fontWeight: 700, color: 'var(--accent-supply)', minWidth: 36, textAlign: 'right' }}>
                {l.kw.toFixed(1)}
              </span>
            </div>
          ))}

          {/* SDG context */}
          <div style={{ marginTop: 16, padding: 12, background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.15)', borderRadius: 8 }}>
            <div style={{ fontSize: 12, color: 'var(--accent-data)', fontWeight: 700, marginBottom: 4 }}>🌍 SDG 7 — Clean Energy</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.6 }}>
              India has ~67,000 villages with unstable grid access. This simulator models priority-based AI load management for rural microgrids.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
