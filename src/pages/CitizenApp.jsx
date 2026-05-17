// src/pages/CitizenApp.jsx
// Feature 4 — Crowdsourced outage/overload reports with geolocation, real-time feed
import { useEffect, useState, useRef } from 'react';
import { subscribeToAllCitizenReports, updateCitizenReportStatus, signInAnon, onAuth } from '../lib/firebase';
import zonesData from '../../data/zones.json';

const ZONES = zonesData.zones;

const REPORT_TYPES = [
  { id: 'outage',      label: 'Power Outage',          icon: '🔌', color: '#ef4444' },
  { id: 'flicker',     label: 'Flickering / Sag',      icon: '💡', color: '#f59e0b' },
  { id: 'lowvoltage',  label: 'Low Voltage',            icon: '📉', color: '#3b82f6' },
  { id: 'overload',    label: 'Suspected Overload',     icon: '🔥', color: '#f97316' },
  { id: 'transformer', label: 'Transformer Fault',      icon: '⚡', color: '#a855f7' },
  { id: 'other',       label: 'Other Issue',            icon: '📝', color: '#94a3b8' },
];

// Simulated "recently received" reports for the impact view
const IMPACT_STATS = [
  { label: 'Reports today',       value: 143,  icon: '📡' },
  { label: 'Zones with reports',  value: 8,    icon: '🗺️' },
  { label: 'Avg response time',   value: '4m', icon: '⚡' },
  { label: 'Issues resolved',     value: 91,   icon: '✅' },
];

export default function CitizenApp() {
  const [user, setUser]             = useState(null);
  const [reports, setReports]       = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted]   = useState(false);
  const [activeTab, setActiveTab]   = useState('feed');
  const [locating, setLocating]     = useState(false);
  const [detectedZone, setDetectedZone] = useState(null);
  const [form, setForm] = useState({ zoneId: '', type: 'outage', description: '', severity: '3' });
  const [selectedReport, setSelectedReport] = useState(null);

  useEffect(() => {
    const unsub = onAuth(async (u) => { if (u) setUser(u); else await signInAnon(); });
    return unsub;
  }, []);

  useEffect(() => {
    const unsub = subscribeToAllCitizenReports(setReports);
    return unsub;
  }, []);

  // Geolocation: find nearest zone
  const detectLocation = () => {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        // Find nearest zone by haversine (simplified)
        let nearest = null, minDist = Infinity;
        ZONES.forEach((z) => {
          const d = Math.sqrt((z.lat - latitude) ** 2 + (z.lng - longitude) ** 2);
          if (d < minDist) { minDist = d; nearest = z; }
        });
        if (nearest) {
          setDetectedZone(nearest);
          setForm((f) => ({ ...f, zoneId: nearest.zoneId }));
        }
        setLocating(false);
      },
      () => setLocating(false),
      { timeout: 8000 }
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.zoneId || !form.description.trim()) return;
    setSubmitting(true);
    try {
      const zone = ZONES.find((z) => z.zoneId === form.zoneId);
      await submitReport({
        ...form, severity: parseInt(form.severity),
        zoneName: zone?.name || '', state: zone?.state || '',
        userId: user?.uid || 'anon', lat: zone?.lat, lng: zone?.lng,
      });
      setSubmitted(true);
      setForm({ zoneId: '', type: 'outage', description: '', severity: '3' });
      setDetectedZone(null);
      setTimeout(() => setSubmitted(false), 4000);
    } catch (err) { console.error(err); }
    setSubmitting(false);
  };

  const handleStatusUpdate = async (id, status) => {
    try {
      await updateCitizenReportStatus(id, status);
      if (selectedReport && selectedReport.id === id) {
        setSelectedReport({ ...selectedReport, status });
      }
    } catch (err) {
      console.error('Failed to update report status:', err);
    }
  };

  const rt = (id) => REPORT_TYPES.find(t => t.id === id);

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Citizen Reports</h1>
          <p className="page-subtitle">Crowdsource real-time grid issues · Your report appears on the operator map instantly</p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span className="chip data">Data collection</span>
          {user && <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Anon: {user.uid.slice(0, 8)}…</span>}
        </div>
      </div>

      {/* Impact stats strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
        {IMPACT_STATS.map((s) => (
          <div key={s.label} className="stat-card" style={{ '--accent-color': 'var(--accent-data)' }}>
            <div className="stat-icon">{s.icon}</div>
            <div className="stat-value" style={{ color: 'var(--accent-data)', fontSize: 22 }}>{s.value}</div>
            <div className="stat-label">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {[['feed', `📡 Live Feed (${reports.length})`], ['report', '📝 Submit Report']].map(([id, label]) => (
          <button key={id} className={`btn ${activeTab === id ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setActiveTab(id)} id={`tab-${id}`}>
            {label}
          </button>
        ))}
      </div>

      {/* Report tab */}
      {activeTab === 'report' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 20 }}>
          <div className="card">
            {submitted ? (
              <div style={{ textAlign: 'center', padding: '48px 20px' }}>
                <div style={{ fontSize: 64, marginBottom: 12 }}>✅</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--accent-data)' }}>Report Submitted!</div>
                <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 10, lineHeight: 1.7 }}>
                  Pinned on the operator map and visible to grid engineers within seconds.<br />
                  You may earn <strong style={{ color: 'var(--accent-demand)' }}>5 Energy Coins</strong> if your report is verified.
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} id="citizen-report-form">
                <div className="card-title" style={{ marginBottom: 20 }}>Report a Grid Issue</div>

                {/* Geolocation */}
                <div className="form-group">
                  <label className="form-label">Grid Zone *</label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <select
                      className="form-control"
                      value={form.zoneId}
                      onChange={e => setForm({ ...form, zoneId: e.target.value })}
                      required
                      id="report-zone-select"
                      style={{ flex: 1 }}
                    >
                      <option value="">Select your zone…</option>
                      {ZONES.map(z => <option key={z.zoneId} value={z.zoneId}>{z.zoneId} — {z.name}, {z.state}</option>)}
                    </select>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={detectLocation}
                      disabled={locating}
                      style={{ whiteSpace: 'nowrap', flexShrink: 0 }}
                      title="Auto-detect your zone using GPS"
                    >
                      {locating ? '⏳' : '📍'} {locating ? 'Locating…' : 'Auto-detect'}
                    </button>
                  </div>
                  {detectedZone && (
                    <div style={{
                      marginTop: 8, fontSize: 12, color: 'var(--accent-data)',
                      background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)',
                      borderRadius: 6, padding: '6px 10px',
                    }}>
                      📍 Detected: <strong>{detectedZone.name}</strong>, {detectedZone.state} ({detectedZone.zoneId})
                    </div>
                  )}
                </div>

                {/* Issue type */}
                <div className="form-group">
                  <label className="form-label">Issue Type *</label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    {REPORT_TYPES.map(rt => (
                      <label key={rt.id} style={{
                        padding: '10px 12px', borderRadius: 8, cursor: 'pointer', fontSize: 13,
                        border: `1px solid ${form.type === rt.id ? rt.color + '60' : 'var(--border-subtle)'}`,
                        background: form.type === rt.id ? rt.color + '10' : 'rgba(255,255,255,0.02)',
                        display: 'flex', alignItems: 'center', gap: 8,
                        transition: 'all 0.15s',
                      }}>
                        <input type="radio" name="type" value={rt.id} checked={form.type === rt.id} onChange={e => setForm({ ...form, type: e.target.value })} style={{ display: 'none' }} />
                        <span>{rt.icon}</span>
                        <span style={{ color: form.type === rt.id ? rt.color : 'var(--text-secondary)' }}>{rt.label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Severity */}
                <div className="form-group">
                  <label className="form-label">Severity</label>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    {[1, 2, 3, 4, 5].map(s => (
                      <button
                        key={s} type="button"
                        onClick={() => setForm({ ...form, severity: String(s) })}
                        style={{
                          flex: 1, height: 40, borderRadius: 8, border: 'none', cursor: 'pointer',
                          background: form.severity === String(s)
                            ? s <= 2 ? 'rgba(59,130,246,0.25)' : s === 3 ? 'rgba(245,158,11,0.2)' : 'rgba(239,68,68,0.25)'
                            : 'rgba(255,255,255,0.04)',
                          color: form.severity === String(s)
                            ? s <= 2 ? 'var(--status-low)' : s === 3 ? 'var(--accent-demand)' : 'var(--status-critical)'
                            : 'var(--text-muted)',
                          fontWeight: 700, fontSize: 16, transition: 'all 0.15s',
                        }}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>
                    <span>Minor</span><span>Critical</span>
                  </div>
                </div>

                {/* Description */}
                <div className="form-group">
                  <label className="form-label">Description *</label>
                  <textarea
                    className="form-control"
                    placeholder="Area affected, duration, physical signs (e.g. sparking transformer, complete blackout for 3 blocks)…"
                    value={form.description}
                    onChange={e => setForm({ ...form, description: e.target.value })}
                    required
                    id="report-description"
                    style={{ minHeight: 90 }}
                  />
                </div>

                <button type="submit" className="btn btn-primary" disabled={submitting || !form.zoneId} id="report-submit-btn" style={{ width: '100%', justifyContent: 'center', padding: '13px 0' }}>
                  {submitting ? '⏳ Submitting…' : '📍 Submit Report'}
                </button>
              </form>
            )}
          </div>

          {/* Right column: guidelines + ground truth card */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="card" style={{ background: 'linear-gradient(135deg,rgba(16,185,129,0.07),rgba(5,150,105,0.03))', borderColor: 'rgba(16,185,129,0.2)' }}>
              <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--accent-data)', marginBottom: 12 }}>🧠 Ground Truth for AI</div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
                India has ~200 million homes without smart meters. Citizen reports are the only real-time signal we have from these areas.
                <br /><br />
                When <strong style={{ color: 'var(--text-primary)' }}>3+ power cut reports</strong> arrive from the same zone within 30 minutes, GridWise automatically elevates that zone's risk score on the operator dashboard — even with no sensor data.
              </div>
            </div>

            <div className="card">
              <div className="card-title" style={{ marginBottom: 14 }}>Report Guidelines</div>
              {[
                { icon: '📍', title: 'Select the correct zone', desc: 'Choose the grid zone covering your location. Use auto-detect for accuracy.' },
                { icon: '⚡', title: 'Be specific about symptoms', desc: 'Mention duration, affected appliances, and if neighbours are affected too.' },
                { icon: '🕒', title: 'Report immediately', desc: 'Real-time reports are 10x more actionable than reports filed hours later.' },
                { icon: '🔒', title: 'Anonymous & private', desc: 'Reports are submitted anonymously. No personal data is stored.' },
                { icon: '🪙', title: 'Earn coins for verified reports', desc: 'If your report matches a confirmed outage, you earn 5 Energy Coins.' },
              ].map(g => (
                <div key={g.title} style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
                  <span style={{ fontSize: 20, flexShrink: 0 }}>{g.icon}</span>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{g.title}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{g.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Feed tab */}
      {activeTab === 'feed' && (
        <div className="card">
          <div className="card-title" style={{ marginBottom: 16 }}>📡 Live Report Feed</div>
          {reports.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>
              <div style={{ fontSize: 40, marginBottom: 10 }}>📡</div>
              No reports yet. Be the first to report an issue in your area.
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr><th>Time</th><th>Zone</th><th>Type</th><th>Severity</th><th>Description</th><th>Status</th></tr>
              </thead>
              <tbody>
                {reports.map(r => {
                  const type = rt(r.type);
                  return (
                    <tr key={r.id} onClick={() => setSelectedReport(r)} style={{ cursor: 'pointer', transition: 'background 0.2s' }} onMouseOver={e => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'} onMouseOut={e => e.currentTarget.style.background = 'transparent'}>
                      <td className="mono" style={{ fontSize: 11 }}>
                        {new Date(r.timestamp).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td>
                        <span className="zone-id">{r.zoneId}</span>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{r.zoneName}</div>
                      </td>
                      <td>
                        <span style={{ color: type?.color || 'var(--text-muted)', fontSize: 13 }}>
                          {type?.icon} {type?.label || r.type}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 2 }}>
                          {[1,2,3,4,5].map(s => (
                            <div key={s} style={{ width: 8, height: 8, borderRadius: 2, background: s <= r.severity ? 'var(--status-critical)' : 'rgba(255,255,255,0.1)' }} />
                          ))}
                        </div>
                      </td>
                      <td style={{ color: 'var(--text-secondary)', fontSize: 12, maxWidth: 200 }}>{r.description}</td>
                      <td>
                        <span className={`status-pill ${
                          r.status === 'verified_resolved' ? 'normal' : 
                          r.status === 'operator_resolved' ? 'normal' : // maybe different color
                          r.status === 'in_progress' ? 'low' : 'critical'
                        }`} style={{
                          background: r.status === 'verified_resolved' ? 'rgba(16,185,129,0.1)' :
                                      r.status === 'operator_resolved' ? 'rgba(168,85,247,0.1)' :
                                      r.status === 'in_progress' ? 'rgba(59,130,246,0.1)' : 'rgba(245,158,11,0.1)',
                          color: r.status === 'verified_resolved' ? '#10b981' :
                                 r.status === 'operator_resolved' ? '#a855f7' :
                                 r.status === 'in_progress' ? '#3b82f6' : '#f59e0b',
                          border: `1px solid ${
                            r.status === 'verified_resolved' ? 'rgba(16,185,129,0.2)' :
                            r.status === 'operator_resolved' ? 'rgba(168,85,247,0.2)' :
                            r.status === 'in_progress' ? 'rgba(59,130,246,0.2)' : 'rgba(245,158,11,0.2)'
                          }`
                        }}>
                          {r.status === 'verified_resolved' ? 'Verified Resolved' :
                           r.status === 'operator_resolved' ? 'Operator Resolved' :
                           r.status === 'in_progress' ? 'In Progress' : 'Pending'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Modal */}
      {selectedReport && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)',
          zIndex: 100, display: 'grid', placeItems: 'center', padding: 20
        }} onClick={() => setSelectedReport(null)}>
          <div className="card" style={{ width: '100%', maxWidth: 500, cursor: 'default' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h2 className="card-title" style={{ margin: 0 }}>Report Details</h2>
              <button onClick={() => setSelectedReport(null)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 20 }}>✕</button>
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Zone</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{selectedReport.zoneId} — {selectedReport.zoneName}</div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Time</div>
                <div style={{ fontSize: 14, color: 'var(--text-primary)' }}>{new Date(selectedReport.timestamp).toLocaleString()}</div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Issue Type</div>
                <div style={{ fontSize: 14, color: rt(selectedReport.type)?.color }}>{rt(selectedReport.type)?.icon} {rt(selectedReport.type)?.label || selectedReport.type}</div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Severity</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--status-critical)' }}>{selectedReport.severity} / 5</div>
              </div>
            </div>

            <div style={{ background: 'rgba(255,255,255,0.02)', padding: 16, borderRadius: 8, marginBottom: 24, border: '1px solid var(--border-subtle)' }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>Description</div>
              <div style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                {selectedReport.description}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', borderTop: '1px solid var(--border-subtle)', paddingTop: 20 }}>
              {(!selectedReport.status || selectedReport.status === 'pending') && (
                <button className="btn btn-secondary" onClick={() => handleStatusUpdate(selectedReport.id, 'in_progress')}>
                  Mark In Progress
                </button>
              )}
              {(!selectedReport.status || selectedReport.status === 'pending' || selectedReport.status === 'in_progress') && (
                <button className="btn btn-primary" onClick={() => handleStatusUpdate(selectedReport.id, 'operator_resolved')}>
                  Mark as Resolved
                </button>
              )}
              {selectedReport.status === 'operator_resolved' && (
                <div style={{ fontSize: 13, color: '#a855f7', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span>⏳</span> Waiting for citizen to verify fix...
                </div>
              )}
              {selectedReport.status === 'verified_resolved' && (
                <div style={{ fontSize: 13, color: '#10b981', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span>✅</span> Citizen verified issue resolved
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
