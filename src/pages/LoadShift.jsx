// src/pages/LoadShift.jsx — Feature 2: Load Shifting Scheduler
import { useEffect, useState } from 'react';
import { subscribeToZones } from '../lib/firebase';

const CONSUMER_TYPES = ['Factory / Heavy Industry', 'Shopping Mall', 'Hospital', 'Data Centre', 'University', 'Water Treatment Plant', 'Airport'];

const MESSAGE_TEMPLATES = [
  'Peak load expected in your zone between {start}–{end}. Please shift non-critical heavy machinery runs to after {end} for a 15% rate discount.',
  'Grid Alert: Your zone is approaching capacity. Defer EV charging, HVAC, and compressor loads to {end}+ for priority billing benefits.',
  'Demand Response Request: Critical peak forecast. Reduce consumption 15–20% during {start}–{end}. Compliance earns Silver Tier discount.',
  'Emergency Load Shift Notice: Immediate action required. Suspend deferrable loads in your facility until {end} to prevent grid instability.',
];

const MOCK_HISTORY = [
  { id:'ls1', zone:'UP-01', consumer:'Lucknow Steel Mill',        shiftFrom:'18:00', shiftTo:'23:00', mw:42, consumers:8,  compliance:'92%', date:'2026-04-29', status:'completed', tier:'gold'   },
  { id:'ls2', zone:'MH-01', consumer:'Mumbai Port Trust',         shiftFrom:'19:00', shiftTo:'22:30', mw:65, consumers:12, compliance:'88%', date:'2026-04-29', status:'completed', tier:'silver' },
  { id:'ls3', zone:'DL-01', consumer:'IGI Airport Terminal 3',    shiftFrom:'20:00', shiftTo:'23:00', mw:38, consumers:5,  compliance:'—',   date:'2026-04-29', status:'active',    tier:'gold'   },
  { id:'ls4', zone:'KA-01', consumer:'Bangalore IT Park Cluster', shiftFrom:'19:30', shiftTo:'22:00', mw:27, consumers:23, compliance:'—',   date:'2026-04-29', status:'sent',      tier:'bronze' },
];

const TIERS = [
  { id: 'bronze', label: 'Bronze',  range: '0–40% compliance',  discount: '5%',  color: '#cd7f32', min: 0,  max: 40  },
  { id: 'silver', label: 'Silver',  range: '40–70% compliance', discount: '10%', color: '#94a3b8', min: 40, max: 70  },
  { id: 'gold',   label: 'Gold',    range: '70%+ compliance',   discount: '15%', color: '#f59e0b', min: 70, max: 100 },
];

function tierForCompliance(pct) {
  if (pct >= 70) return 'gold';
  if (pct >= 40) return 'silver';
  return 'bronze';
}

export default function LoadShift() {
  const [zones, setZones]         = useState({});
  const [form, setForm]           = useState({ zoneId: '', consumerType: 'Factory / Heavy Industry', windowStart: '18:00', windowEnd: '22:00', message: '' });
  const [sending, setSending]     = useState(false);
  const [sent, setSent]           = useState(false);
  const [history, setHistory]     = useState(MOCK_HISTORY);
  const [templateIdx, setTemplateIdx] = useState(null);

  useEffect(() => {
    const unsub = subscribeToZones(setZones);
    return unsub;
  }, []);

  const overloadedZones = Object.values(zones).filter(z => z.status === 'overload' || z.status === 'critical');

  // Compliance stats (mock)
  const avgCompliance = 76;
  const currentTier   = tierForCompliance(avgCompliance);
  const tierObj       = TIERS.find(t => t.id === currentTier);

  const applyTemplate = (idx) => {
    setTemplateIdx(idx);
    const msg = MESSAGE_TEMPLATES[idx]
      .replace(/\{start\}/g, form.windowStart)
      .replace(/\{end\}/g, form.windowEnd);
    setForm(f => ({ ...f, message: msg }));
  };

  const handleSend = async (e) => {
    e.preventDefault();
    setSending(true);
    await new Promise(r => setTimeout(r, 1200));
    const zone = zones[form.zoneId];
    setHistory(h => [{
      id: `ls${Date.now()}`,
      zone: form.zoneId,
      consumer: `${form.consumerType} (${zone?.name || form.zoneId})`,
      shiftFrom: form.windowStart,
      shiftTo: form.windowEnd,
      mw: Math.round((zone?.activeMW || 100) * 0.05),
      consumers: Math.floor(Math.random() * 20) + 3,
      compliance: '—',
      date: new Date().toISOString().slice(0, 10),
      status: 'sent',
      tier: currentTier,
    }, ...h]);
    setSent(true);
    setTimeout(() => {
      setSent(false);
      setForm(f => ({ ...f, zoneId: '', message: '' }));
      setTemplateIdx(null);
    }, 2500);
    setSending(false);
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Load Shifting</h1>
          <p className="page-subtitle">Schedule demand-reduction requests to large grid consumers via FCM push</p>
        </div>
        <span className="chip supply">Supply-side</span>
      </div>

      {/* Overload alerts */}
      {overloadedZones.length > 0 && (
        <div className="card mb-6" style={{ background: 'rgba(239,68,68,0.05)', borderColor: 'rgba(239,68,68,0.2)', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <span style={{ fontSize: 20 }}>⚠️</span>
            <span style={{ fontWeight: 700, color: 'var(--status-critical)' }}>
              {overloadedZones.length} zone{overloadedZones.length > 1 ? 's' : ''} currently overloaded — Immediate action recommended
            </span>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {overloadedZones.map(z => (
              <button key={z.zoneId} className="btn btn-danger btn-sm" onClick={() => setForm(f => ({ ...f, zoneId: z.zoneId }))}>
                {z.zoneId} — {z.currentLoad?.toFixed(0)}% → Target
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Incentive Tier Panel */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-header">
          <span className="card-title">🏅 Consumer Incentive Tiers</span>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Based on rolling 30-day compliance</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 16 }}>
          {TIERS.map((t) => (
            <div
              key={t.id}
              style={{
                padding: '16px', borderRadius: 10, textAlign: 'center',
                background: currentTier === t.id ? `${t.color}18` : 'rgba(255,255,255,0.02)',
                border: `1px solid ${currentTier === t.id ? t.color + '50' : 'var(--border-subtle)'}`,
                transition: 'all 0.2s',
              }}
            >
              <div style={{ fontSize: 28, marginBottom: 6 }}>
                {t.id === 'bronze' ? '🥉' : t.id === 'silver' ? '🥈' : '🥇'}
              </div>
              <div style={{ fontWeight: 700, color: t.color, fontSize: 14 }}>{t.label}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', margin: '4px 0' }}>{t.range}</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: t.color, fontFamily: 'JetBrains Mono' }}>{t.discount}</div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>rate discount</div>
              {currentTier === t.id && (
                <div style={{ marginTop: 8, fontSize: 10, color: t.color, fontWeight: 700, background: `${t.color}20`, borderRadius: 4, padding: '2px 6px' }}>
                  ← YOUR TIER
                </div>
              )}
            </div>
          ))}
        </div>
        {/* Progress bar */}
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>
          Your avg compliance: <span style={{ color: tierObj?.color, fontWeight: 700, fontFamily: 'JetBrains Mono' }}>{avgCompliance}%</span>
          {' '}— {currentTier === 'gold' ? 'Maximum discount unlocked 🎉' : `${TIERS.find(t => t.id !== currentTier && t.min > avgCompliance)?.min - avgCompliance}% more to reach next tier`}
        </div>
        <div className="load-bar-track">
          <div
            className="load-bar-fill normal"
            style={{ width: `${avgCompliance}%`, background: `linear-gradient(90deg, ${tierObj?.color}88, ${tierObj?.color})` }}
          />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        {/* Scheduler form */}
        <div className="card">
          {sent ? (
            <div style={{ textAlign: 'center', padding: '40px 20px' }}>
              <div style={{ fontSize: 52 }}>📤</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--accent-supply)', marginTop: 12 }}>FCM Push Sent!</div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 8 }}>
                Load-shift notification delivered to registered {form.consumerType} accounts in the selected zone.
              </div>
            </div>
          ) : (
            <form onSubmit={handleSend} id="loadshift-form">
              <div className="card-title" style={{ marginBottom: 20 }}>Schedule Load Shift</div>

              <div className="form-group">
                <label className="form-label">Target Zone *</label>
                <select className="form-control" value={form.zoneId} onChange={e => setForm({ ...form, zoneId: e.target.value })} required id="loadshift-zone">
                  <option value="">Select zone…</option>
                  {Object.values(zones).sort((a, b) => (b.currentLoad || 0) - (a.currentLoad || 0)).map(z => (
                    <option key={z.zoneId} value={z.zoneId}>
                      {z.zoneId} — {z.name} ({z.currentLoad?.toFixed(0)}%) {z.status === 'overload' || z.status === 'critical' ? '⚠️' : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Consumer Type</label>
                <select className="form-control" value={form.consumerType} onChange={e => setForm({ ...form, consumerType: e.target.value })} id="loadshift-consumer">
                  {CONSUMER_TYPES.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Shift Window</label>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <input type="time" className="form-control" value={form.windowStart} onChange={e => setForm({ ...form, windowStart: e.target.value })} style={{ flex: 1 }} id="shift-start" />
                  <span style={{ color: 'var(--text-muted)', flexShrink: 0 }}>→</span>
                  <input type="time" className="form-control" value={form.windowEnd} onChange={e => setForm({ ...form, windowEnd: e.target.value })} style={{ flex: 1 }} id="shift-end" />
                </div>
              </div>

              {/* Message templates */}
              <div className="form-group">
                <label className="form-label">Message Template</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
                  {['Standard Peak', 'Priority', 'Emergency', 'Incentive'].map((label, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => applyTemplate(i)}
                      className={`btn btn-sm ${templateIdx === i ? 'btn-primary' : 'btn-secondary'}`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <textarea
                  className="form-control"
                  placeholder="Custom message for consumers…"
                  value={form.message}
                  onChange={e => setForm({ ...form, message: e.target.value })}
                  style={{ minHeight: 80 }}
                  id="shift-message"
                />
              </div>

              <button type="submit" className="btn btn-primary" disabled={sending || !form.zoneId} id="loadshift-send-btn" style={{ width: '100%', justifyContent: 'center', padding: '12px 0' }}>
                {sending ? '⏳ Sending FCM Push…' : '📤 Send Load-Shift Request'}
              </button>
            </form>
          )}
        </div>

        {/* How it works */}
        <div className="card">
          <div className="card-title" style={{ marginBottom: 14 }}>How Load Shifting Works</div>
          {[
            { icon: '📊', title: 'AI Detects Peak Risk', desc: 'GridWise predicts that a zone will exceed 85% capacity within the next 1–2 hours using the demand forecaster model.' },
            { icon: '📤', title: 'FCM Push to Consumers', desc: 'Registered large consumers (factories, malls, data centres) receive an instant push to shift non-critical loads to off-peak hours.' },
            { icon: '✅', title: 'Consumer Compliance', desc: 'Consumers acknowledge the shift in their dashboard. Compliance is tracked automatically and feeds into the tier system.' },
            { icon: '📉', title: 'Load Reduction', desc: 'A typical shift request reduces zone load by 5–8%, preventing blackouts without any new grid infrastructure investment.' },
            { icon: '🏅', title: 'Tier Rewards', desc: 'Consumers with high compliance scores unlock Bronze → Silver → Gold tiers, earning up to 15% off their electricity rate.' },
          ].map(item => (
            <div key={item.title} style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
              <div style={{ width: 36, height: 36, borderRadius: 8, background: 'rgba(0,229,255,0.08)', border: '1px solid rgba(0,229,255,0.2)', display: 'grid', placeItems: 'center', fontSize: 18, flexShrink: 0 }}>
                {item.icon}
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700 }}>{item.title}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>{item.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* History */}
      <div className="card" style={{ marginTop: 20 }}>
        <div className="card-title" style={{ marginBottom: 16 }}>Shift History</div>
        <table className="data-table">
          <thead>
            <tr>
              <th>Date</th><th>Zone</th><th>Consumer</th><th>Window</th>
              <th>Est. MW Saved</th><th>Notified</th><th>Compliance</th><th>Tier</th><th>Status</th>
            </tr>
          </thead>
          <tbody>
            {history.map(h => {
              const tierInfo = TIERS.find(t => t.id === h.tier);
              return (
                <tr key={h.id}>
                  <td className="mono" style={{ fontSize: 12 }}>{h.date}</td>
                  <td><span className="zone-id">{h.zone}</span></td>
                  <td style={{ fontSize: 13 }}>{h.consumer}</td>
                  <td className="mono" style={{ fontSize: 12 }}>{h.shiftFrom} → {h.shiftTo}</td>
                  <td style={{ fontFamily: 'JetBrains Mono', fontWeight: 700 }}>{h.mw} MW</td>
                  <td style={{ fontFamily: 'JetBrains Mono' }}>{h.consumers || '—'}</td>
                  <td style={{ fontFamily: 'JetBrains Mono', color: 'var(--status-normal)' }}>{h.compliance}</td>
                  <td>
                    {tierInfo && (
                      <span style={{ color: tierInfo.color, fontWeight: 700, fontSize: 12 }}>
                        {h.tier === 'gold' ? '🥇' : h.tier === 'silver' ? '🥈' : '🥉'} {tierInfo.label}
                      </span>
                    )}
                  </td>
                  <td><span className={`status-pill ${h.status === 'completed' ? 'normal' : h.status === 'active' ? 'overload' : 'low'}`}>{h.status}</span></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
