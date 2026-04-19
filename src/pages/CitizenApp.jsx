// src/pages/CitizenApp.jsx
// Feature 4 — Crowdsourced outage/overload reports
import { useEffect, useState } from 'react';
import { submitReport, subscribeToReports, signInAnon, onAuth } from '../lib/firebase';
import zonesData from '../../data/zones.json';

const ZONES = zonesData.zones;

const REPORT_TYPES = [
  { id: 'outage',      label: '🔌 Power Outage' },
  { id: 'flicker',    label: '💡 Flickering' },
  { id: 'lowvoltage', label: '📉 Low Voltage' },
  { id: 'overload',   label: '🔥 Suspected Overload' },
  { id: 'other',      label: '📝 Other' },
];

export default function CitizenApp() {
  const [user, setUser]       = useState(null);
  const [reports, setReports] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted]   = useState(false);
  const [activeTab, setActiveTab]   = useState('report');
  const [form, setForm] = useState({ zoneId: '', type: 'outage', description: '', severity: '3' });

  useEffect(() => {
    const unsub = onAuth(async (u) => { if (u) setUser(u); else await signInAnon(); });
    return unsub;
  }, []);

  useEffect(() => {
    const unsub = subscribeToReports(setReports);
    return unsub;
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.zoneId || !form.description.trim()) return;
    setSubmitting(true);
    try {
      const zone = ZONES.find((z) => z.zoneId === form.zoneId);
      await submitReport({ ...form, severity: parseInt(form.severity), zoneName: zone?.name || '', state: zone?.state || '', userId: user?.uid || 'anon', lat: zone?.lat, lng: zone?.lng });
      setSubmitted(true);
      setForm({ zoneId: '', type: 'outage', description: '', severity: '3' });
      setTimeout(() => setSubmitted(false), 3000);
    } catch (err) { console.error(err); }
    setSubmitting(false);
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Citizen Reports</h1>
          <p className="page-subtitle">Crowdsource real-time grid issues from the ground</p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span className="chip data">Data collection</span>
          {user && <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Anon ID: {user.uid.slice(0,8)}…</span>}
        </div>
      </div>

      {/* Impact card */}
      <div className="card mb-6" style={{ background:'linear-gradient(135deg,rgba(16,185,129,0.08),rgba(5,150,105,0.04))', borderColor:'rgba(16,185,129,0.2)' }}>
        <div style={{ display:'flex', gap:20, alignItems:'center' }}>
          <div style={{ fontSize:36 }}>🗺️</div>
          <div style={{ flex:1 }}>
            <div style={{ fontWeight:700, fontSize:15, color:'var(--accent-data)' }}>Ground Truth for AI</div>
            <div style={{ fontSize:13, color:'var(--text-secondary)', marginTop:4 }}>
              Your reports train GridWise to detect outages in real-time — especially in rural areas without smart meters. Each report pins instantly on the operator map.
            </div>
          </div>
          <div style={{ textAlign:'right', flexShrink:0 }}>
            <div style={{ fontSize:28, fontWeight:800, color:'var(--accent-data)' }}>{reports.length}</div>
            <div style={{ fontSize:11, color:'var(--text-muted)' }}>Reports total</div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display:'flex', gap:8, marginBottom:20 }}>
        {[['report','📝 Submit Report'],['feed',`📡 Live Feed (${reports.length})`]].map(([id, label]) => (
          <button key={id} className={`btn ${activeTab===id ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setActiveTab(id)} id={`tab-${id}`}>{label}</button>
        ))}
      </div>

      {/* Form tab */}
      {activeTab === 'report' && (
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:20 }}>
          <div className="card">
            {submitted ? (
              <div style={{ textAlign:'center', padding:'40px 20px' }}>
                <div style={{ fontSize:52 }}>✅</div>
                <div style={{ fontSize:18, fontWeight:800, color:'var(--accent-data)', marginTop:12 }}>Report Submitted!</div>
                <div style={{ fontSize:13, color:'var(--text-muted)', marginTop:8 }}>Pinned on operator map and visible to grid engineers.</div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} id="citizen-report-form">
                <div className="card-title" style={{ marginBottom:20 }}>Report a Grid Issue</div>

                <div className="form-group">
                  <label className="form-label">Grid Zone *</label>
                  <select className="form-control" value={form.zoneId} onChange={e=>setForm({...form,zoneId:e.target.value})} required id="report-zone-select">
                    <option value="">Select your zone…</option>
                    {ZONES.map(z => <option key={z.zoneId} value={z.zoneId}>{z.zoneId} — {z.name}, {z.state}</option>)}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Issue Type *</label>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                    {REPORT_TYPES.map(rt => (
                      <label key={rt.id} style={{ padding:'10px 12px', borderRadius:8, border:`1px solid ${form.type===rt.id?'rgba(16,185,129,0.4)':'var(--border-subtle)'}`, background:form.type===rt.id?'rgba(16,185,129,0.08)':'rgba(255,255,255,0.02)', cursor:'pointer', fontSize:13 }}>
                        <input type="radio" name="type" value={rt.id} checked={form.type===rt.id} onChange={e=>setForm({...form,type:e.target.value})} style={{ display:'none' }} />
                        {rt.label}
                      </label>
                    ))}
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Severity (1=minor, 5=critical)</label>
                  <div style={{ display:'flex', gap:8 }}>
                    {[1,2,3,4,5].map(s => (
                      <button key={s} type="button" onClick={()=>setForm({...form,severity:String(s)})} style={{ width:40, height:40, borderRadius:8, border:`1px solid ${form.severity===String(s)?'rgba(16,185,129,0.5)':'var(--border-subtle)'}`, background:form.severity===String(s)?'rgba(16,185,129,0.15)':'rgba(255,255,255,0.03)', color:form.severity===String(s)?'var(--accent-data)':'var(--text-muted)', fontWeight:700, cursor:'pointer', fontSize:15 }}>{s}</button>
                    ))}
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Description *</label>
                  <textarea className="form-control" placeholder="Area affected, duration, physical signs…" value={form.description} onChange={e=>setForm({...form,description:e.target.value})} required id="report-description" />
                </div>

                <button type="submit" className="btn btn-primary" disabled={submitting||!form.zoneId} id="report-submit-btn" style={{ width:'100%', justifyContent:'center', padding:'12px 0' }}>
                  {submitting ? '⏳ Submitting…' : '📍 Submit Report'}
                </button>
              </form>
            )}
          </div>

          <div className="card">
            <div className="card-title" style={{ marginBottom:14 }}>Report Guidelines</div>
            {[
              { icon:'📍', title:'Select the correct zone', desc:'Choose the grid zone covering your location.' },
              { icon:'⚡', title:'Be specific about symptoms', desc:'Mention duration, affected appliances, and if neighbours are affected.' },
              { icon:'🕒', title:'Report immediately', desc:'Real-time reports are 10x more useful than delayed ones.' },
              { icon:'🔒', title:'Anonymous & private', desc:'Reports are submitted anonymously. No personal data stored.' },
            ].map(g => (
              <div key={g.title} style={{ display:'flex', gap:10, marginBottom:14 }}>
                <span style={{ fontSize:20, flexShrink:0 }}>{g.icon}</span>
                <div>
                  <div style={{ fontSize:13, fontWeight:600 }}>{g.title}</div>
                  <div style={{ fontSize:12, color:'var(--text-muted)', marginTop:2 }}>{g.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Feed tab */}
      {activeTab === 'feed' && (
        <div className="card">
          <div className="card-title" style={{ marginBottom:16 }}>📡 Live Report Feed</div>
          {reports.length === 0 ? (
            <div style={{ textAlign:'center', padding:'40px 0', color:'var(--text-muted)' }}>No reports yet. Be the first to report an issue.</div>
          ) : (
            <table className="data-table">
              <thead><tr><th>Time</th><th>Zone</th><th>Type</th><th>Severity</th><th>Description</th><th>Status</th></tr></thead>
              <tbody>
                {reports.map(r => (
                  <tr key={r.id}>
                    <td className="mono" style={{ fontSize:11 }}>{new Date(r.timestamp).toLocaleString('en-IN',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'})}</td>
                    <td><span className="zone-id">{r.zoneId}</span><div style={{ fontSize:11, color:'var(--text-muted)', marginTop:2 }}>{r.zoneName}</div></td>
                    <td style={{ fontSize:13 }}>{REPORT_TYPES.find(t=>t.id===r.type)?.label || r.type}</td>
                    <td><span style={{ fontFamily:'JetBrains Mono', fontWeight:700, fontSize:13 }}>{r.severity}/5</span></td>
                    <td style={{ color:'var(--text-secondary)', fontSize:12, maxWidth:200 }}>{r.description}</td>
                    <td><span className={`status-pill ${r.status==='resolved'?'normal':'low'}`}>{r.status||'pending'}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
