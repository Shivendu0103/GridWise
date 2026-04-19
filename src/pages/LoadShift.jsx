// src/pages/LoadShift.jsx — Feature 2: Load Shifting Scheduler
import { useEffect, useState } from 'react';
import { subscribeToZones } from '../lib/firebase';

const CONSUMER_TYPES = ['Hospital','Factory','Shopping Mall','Data Centre','University','Water Treatment Plant'];

const MOCK_HISTORY = [
  { id:'ls1', zone:'UP-01', consumer:'Lucknow Steel Mill',       shiftFrom:'18:00', shiftTo:'23:00', mw:42,  compliance:'92%', date:'2026-04-19', status:'completed' },
  { id:'ls2', zone:'MH-01', consumer:'Mumbai Port Trust',        shiftFrom:'19:00', shiftTo:'22:30', mw:65,  compliance:'88%', date:'2026-04-19', status:'completed' },
  { id:'ls3', zone:'DL-01', consumer:'IGI Airport Terminal 3',   shiftFrom:'20:00', shiftTo:'23:00', mw:38,  compliance:'—',   date:'2026-04-19', status:'active'    },
  { id:'ls4', zone:'KA-01', consumer:'Bangalore IT Park Cluster', shiftFrom:'19:30', shiftTo:'22:00', mw:27, compliance:'—',   date:'2026-04-19', status:'sent'      },
];

export default function LoadShift() {
  const [zones, setZones]   = useState({});
  const [form, setForm]     = useState({ zoneId:'', consumerType:'Factory', windowStart:'18:00', windowEnd:'22:00', message:'' });
  const [sending, setSending] = useState(false);
  const [sent, setSent]     = useState(false);
  const [history, setHistory] = useState(MOCK_HISTORY);

  useEffect(() => {
    const unsub = subscribeToZones(setZones);
    return unsub;
  }, []);

  const overloadedZones = Object.values(zones).filter(z => z.status === 'overload' || z.status === 'critical');

  const handleSend = async (e) => {
    e.preventDefault();
    setSending(true);
    await new Promise(r => setTimeout(r, 1200)); // simulate FCM push
    const zone = zones[form.zoneId];
    setHistory(h => [{
      id: `ls${Date.now()}`,
      zone: form.zoneId,
      consumer: `${form.consumerType} (${zone?.name || form.zoneId})`,
      shiftFrom: form.windowStart,
      shiftTo: form.windowEnd,
      mw: Math.round((zone?.activeMW || 100) * 0.05),
      compliance: '—',
      date: new Date().toISOString().slice(0,10),
      status: 'sent',
    }, ...h]);
    setSent(true);
    setTimeout(() => { setSent(false); setForm(f => ({ ...f, zoneId:'', message:'' })); }, 2500);
    setSending(false);
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Load Shifting</h1>
          <p className="page-subtitle">Schedule demand-reduction requests to large grid consumers</p>
        </div>
        <span className="chip supply">Supply-side</span>
      </div>

      {/* Overload alerts */}
      {overloadedZones.length > 0 && (
        <div className="card mb-6" style={{ background:'rgba(239,68,68,0.05)', borderColor:'rgba(239,68,68,0.2)' }}>
          <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:12 }}>
            <span style={{ fontSize:20 }}>⚠️</span>
            <span style={{ fontWeight:700, color:'var(--status-critical)' }}>{overloadedZones.length} zone{overloadedZones.length>1?'s':''} currently overloaded</span>
          </div>
          <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
            {overloadedZones.map(z => (
              <button key={z.zoneId} className="btn btn-danger btn-sm" onClick={() => setForm(f => ({ ...f, zoneId: z.zoneId }))}>
                {z.zoneId} {z.currentLoad?.toFixed(0)}% →
              </button>
            ))}
          </div>
        </div>
      )}

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:20 }}>
        {/* Scheduler form */}
        <div className="card">
          {sent ? (
            <div style={{ textAlign:'center', padding:'40px 20px' }}>
              <div style={{ fontSize:52 }}>📤</div>
              <div style={{ fontSize:18, fontWeight:800, color:'var(--accent-supply)', marginTop:12 }}>FCM Push Sent!</div>
              <div style={{ fontSize:13, color:'var(--text-muted)', marginTop:8 }}>Load-shift notification delivered to {form.consumerType} accounts in the selected zone.</div>
            </div>
          ) : (
            <form onSubmit={handleSend} id="loadshift-form">
              <div className="card-title" style={{ marginBottom:20 }}>Schedule Load Shift</div>

              <div className="form-group">
                <label className="form-label">Target Zone *</label>
                <select className="form-control" value={form.zoneId} onChange={e=>setForm({...form,zoneId:e.target.value})} required id="loadshift-zone">
                  <option value="">Select zone…</option>
                  {Object.values(zones).sort((a,b)=>(b.currentLoad||0)-(a.currentLoad||0)).map(z => (
                    <option key={z.zoneId} value={z.zoneId}>{z.zoneId} — {z.name} ({z.currentLoad?.toFixed(0)}%)</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Consumer Type</label>
                <select className="form-control" value={form.consumerType} onChange={e=>setForm({...form,consumerType:e.target.value})} id="loadshift-consumer">
                  {CONSUMER_TYPES.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Shift Window</label>
                <div style={{ display:'flex', gap:10, alignItems:'center' }}>
                  <input type="time" className="form-control" value={form.windowStart} onChange={e=>setForm({...form,windowStart:e.target.value})} style={{ flex:1 }} id="shift-start" />
                  <span style={{ color:'var(--text-muted)', flexShrink:0 }}>→</span>
                  <input type="time" className="form-control" value={form.windowEnd} onChange={e=>setForm({...form,windowEnd:e.target.value})} style={{ flex:1 }} id="shift-end" />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Custom Message (optional)</label>
                <textarea className="form-control" placeholder="Additional context for the consumer…" value={form.message} onChange={e=>setForm({...form,message:e.target.value})} style={{ minHeight:70 }} id="shift-message" />
              </div>

              <button type="submit" className="btn btn-primary" disabled={sending||!form.zoneId} id="loadshift-send-btn" style={{ width:'100%', justifyContent:'center', padding:'12px 0' }}>
                {sending ? '⏳ Sending FCM…' : '📤 Send Load-Shift Request'}
              </button>
            </form>
          )}
        </div>

        {/* How it works */}
        <div className="card">
          <div className="card-title" style={{ marginBottom:14 }}>How Load Shifting Works</div>
          {[
            { icon:'📊', title:'Peak Detected', desc:'GridWise detects that a zone will exceed 85% capacity within the next hour using the rule-based predictor.' },
            { icon:'📤', title:'FCM Push to Consumers', desc:'Registered large consumers (factories, malls, data centres) receive a push notification to shift non-critical loads to off-peak hours.' },
            { icon:'✅', title:'Consumer Compliance', desc:'Consumers acknowledge the shift request in their dashboard. Compliance is tracked automatically.' },
            { icon:'📉', title:'Load Reduction', desc:'Typical shift request reduces zone load by 5–8%, preventing blackouts without new infrastructure.' },
          ].map(item => (
            <div key={item.title} style={{ display:'flex', gap:12, marginBottom:16 }}>
              <div style={{ width:36, height:36, borderRadius:8, background:'rgba(0,229,255,0.08)', border:'1px solid rgba(0,229,255,0.2)', display:'grid', placeItems:'center', fontSize:18, flexShrink:0 }}>{item.icon}</div>
              <div>
                <div style={{ fontSize:13, fontWeight:700 }}>{item.title}</div>
                <div style={{ fontSize:12, color:'var(--text-muted)', marginTop:3 }}>{item.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* History */}
      <div className="card" style={{ marginTop:20 }}>
        <div className="card-title" style={{ marginBottom:16 }}>Shift History</div>
        <table className="data-table">
          <thead><tr><th>Date</th><th>Zone</th><th>Consumer</th><th>Window</th><th>Est. MW Saved</th><th>Compliance</th><th>Status</th></tr></thead>
          <tbody>
            {history.map(h => (
              <tr key={h.id}>
                <td className="mono" style={{ fontSize:12 }}>{h.date}</td>
                <td><span className="zone-id">{h.zone}</span></td>
                <td style={{ fontSize:13 }}>{h.consumer}</td>
                <td className="mono" style={{ fontSize:12 }}>{h.shiftFrom} → {h.shiftTo}</td>
                <td style={{ fontFamily:'JetBrains Mono', fontWeight:700 }}>{h.mw} MW</td>
                <td style={{ fontFamily:'JetBrains Mono', color:'var(--status-normal)' }}>{h.compliance}</td>
                <td><span className={`status-pill ${h.status==='completed'?'normal':h.status==='active'?'overload':'low'}`}>{h.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
