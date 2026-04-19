// src/pages/MicroGrid.jsx — Feature 3: Rural Micro-Grid Scenario Dashboard
import { useState } from 'react';

const SCENARIOS = [
  { id:'full',     label:'☀️ Full Solar',    solar:4.2, battery:82, desc:'Solar at peak output. All loads active.' },
  { id:'evening',  label:'🌅 Evening Dip',   solar:1.1, battery:61, desc:'Solar fading. Battery discharging for critical loads.' },
  { id:'night',    label:'🌙 Night Mode',    solar:0,   battery:38, desc:'No solar. Battery only. Deferrable loads shed.' },
  { id:'cloudy',   label:'🌧️ Cloudy Day',    solar:0.8, battery:52, desc:'Low solar. Battery conserved. Load prioritisation active.' },
  { id:'critical', label:'🔴 Battery Low',   solar:0.4, battery:9,  desc:'Critical battery. Only hospital and water loads active.' },
];

const LOAD_GROUPS = [
  {
    id:'critical',
    label:'Critical Loads',
    colorClass:'critical-load',
    color:'var(--status-critical)',
    items:[
      { name:'PHC (Health Centre)', kw:12, always:true },
      { name:'Water Pump Station',  kw:8,  always:true },
      { name:'Street Lighting',     kw:5,  always:true },
    ],
  },
  {
    id:'essential',
    label:'Essential Loads',
    colorClass:'essential-load',
    color:'var(--accent-demand)',
    items:[
      { name:'Residential Homes (50)',  kw:30 },
      { name:'School / Anganwadi',      kw:6  },
      { name:'Ration Shop & Cold Store',kw:9  },
    ],
  },
  {
    id:'deferrable',
    label:'Deferrable Loads',
    colorClass:'deferrable-load',
    color:'var(--status-surplus)',
    items:[
      { name:'Irrigation Pumps',       kw:24 },
      { name:'Grain Mill',             kw:15 },
      { name:'EV Charging Point',      kw:7  },
    ],
  },
];

function isActive(groupId, scenario) {
  if (groupId === 'critical') return true;
  if (groupId === 'essential') return scenario !== 'critical';
  if (groupId === 'deferrable') return scenario === 'full' || scenario === 'cloudy';
  return false;
}

function BatteryRing({ pct }) {
  const r = 50; const circ = 2 * Math.PI * r;
  const color = pct > 50 ? 'var(--status-normal)' : pct > 20 ? 'var(--accent-demand)' : 'var(--status-critical)';
  return (
    <div style={{ position:'relative', display:'inline-flex', alignItems:'center', justifyContent:'center', width:130, height:130 }}>
      <svg width="130" height="130" viewBox="0 0 130 130">
        <circle cx="65" cy="65" r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="12"/>
        <circle cx="65" cy="65" r={r} fill="none" stroke={color} strokeWidth="12"
          strokeDasharray={circ} strokeDashoffset={circ*(1-pct/100)}
          strokeLinecap="round" transform="rotate(-90 65 65)"
          style={{ transition:'stroke-dashoffset 0.8s ease, stroke 0.4s ease' }}
        />
      </svg>
      <div style={{ position:'absolute', textAlign:'center' }}>
        <div style={{ fontSize:26, fontWeight:900, fontFamily:'JetBrains Mono', color }}>{pct}%</div>
        <div style={{ fontSize:10, color:'var(--text-muted)' }}>Battery</div>
      </div>
    </div>
  );
}

export default function MicroGrid() {
  const [selectedScenario, setSelectedScenario] = useState('full');
  const scenario = SCENARIOS.find(s => s.id === selectedScenario);

  const totalActivekW = LOAD_GROUPS.reduce((sum, g) => {
    if (!isActive(g.id, selectedScenario)) return sum;
    return sum + g.items.reduce((s,i)=>s+i.kw,0);
  }, 0);

  const activePct = Math.min(100, Math.round((totalActivekW / 116) * 100));

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Micro-Grid Console</h1>
          <p className="page-subtitle">Rural solar+battery priority load-switching simulator</p>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <span className="chip data">Data collection</span>
          <span className="chip" style={{ color:'var(--accent-supply)', background:'rgba(0,229,255,0.08)', borderColor:'rgba(0,229,255,0.2)' }}>Simulation Mode</span>
        </div>
      </div>

      {/* Scenario picker */}
      <div className="card mb-6">
        <div className="card-title" style={{ marginBottom:14 }}>Select Scenario</div>
        <div style={{ display:'flex', flexWrap:'wrap', gap:10 }}>
          {SCENARIOS.map(s => (
            <button key={s.id} onClick={() => setSelectedScenario(s.id)}
              className={`btn ${selectedScenario===s.id ? 'btn-primary' : 'btn-secondary'}`}
              id={`scenario-${s.id}`}
            >
              {s.label}
            </button>
          ))}
        </div>
        <div style={{ marginTop:14, fontSize:13, color:'var(--text-secondary)' }}>
          <strong style={{ color:'var(--text-primary)' }}>{scenario?.label}:</strong> {scenario?.desc}
        </div>
      </div>

      {/* System overview */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:16, marginBottom:20 }}>
        {/* Battery */}
        <div className="card" style={{ textAlign:'center', padding:24 }}>
          <div style={{ fontSize:12, color:'var(--text-muted)', fontWeight:600, textTransform:'uppercase', letterSpacing:0.5, marginBottom:14 }}>Battery State</div>
          <BatteryRing pct={scenario?.battery || 0} />
          <div style={{ fontSize:12, color:'var(--text-muted)', marginTop:10 }}>
            {scenario?.battery > 50 ? 'Charging / Stable' : scenario?.battery > 20 ? 'Discharging' : '⚠️ Low — Load Shedding Active'}
          </div>
        </div>

        {/* Solar */}
        <div className="card" style={{ textAlign:'center', padding:24 }}>
          <div style={{ fontSize:12, color:'var(--text-muted)', fontWeight:600, textTransform:'uppercase', letterSpacing:0.5, marginBottom:8 }}>Solar Input</div>
          <div style={{ fontSize:52, margin:'12px 0' }}>☀️</div>
          <div style={{ fontSize:32, fontWeight:900, fontFamily:'JetBrains Mono', color:'var(--accent-demand)' }}>{scenario?.solar} kW</div>
          <div style={{ fontSize:12, color:'var(--text-muted)', marginTop:6 }}>of 5 kW peak capacity</div>
          <div className="load-bar-track" style={{ marginTop:12 }}>
            <div className="load-bar-fill normal" style={{ width:`${((scenario?.solar||0)/5)*100}%` }} />
          </div>
        </div>

        {/* Active load */}
        <div className="card" style={{ textAlign:'center', padding:24 }}>
          <div style={{ fontSize:12, color:'var(--text-muted)', fontWeight:600, textTransform:'uppercase', letterSpacing:0.5, marginBottom:8 }}>Active Load</div>
          <div style={{ fontSize:52, margin:'12px 0' }}>⚡</div>
          <div style={{ fontSize:32, fontWeight:900, fontFamily:'JetBrains Mono', color:'var(--accent-supply)' }}>{totalActivekW} kW</div>
          <div style={{ fontSize:12, color:'var(--text-muted)', marginTop:6 }}>of 116 kW total demand ({activePct}%)</div>
          <div className="load-bar-track" style={{ marginTop:12 }}>
            <div className={`load-bar-fill ${activePct>80?'critical':activePct>60?'overload':'normal'}`} style={{ width:`${activePct}%` }} />
          </div>
        </div>
      </div>

      {/* Priority groups */}
      <div className="card mb-6">
        <div className="card-title" style={{ marginBottom:16 }}>Priority Load Switching</div>
        <div className="priority-grid">
          {LOAD_GROUPS.map(group => {
            const active = isActive(group.id, selectedScenario);
            return (
              <div key={group.id} className={`priority-card ${group.colorClass}`} style={{ opacity: active ? 1 : 0.45, transition:'opacity 0.4s' }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
                  <div style={{ fontSize:13, fontWeight:700, color:group.color }}>{group.label}</div>
                  <span className={`status-pill ${active ? (group.id==='critical'?'critical':group.id==='essential'?'overload':'surplus') : 'low'}`}>
                    {active ? 'ON' : 'SHED'}
                  </span>
                </div>
                {group.items.map(item => (
                  <div key={item.name} style={{ display:'flex', justifyContent:'space-between', padding:'7px 0', borderBottom:'1px solid rgba(255,255,255,0.05)', fontSize:13 }}>
                    <span style={{ color:'var(--text-secondary)' }}>{item.name}</span>
                    <span style={{ fontFamily:'JetBrains Mono', fontWeight:600 }}>{item.kw} kW</span>
                  </div>
                ))}
                <div style={{ marginTop:10, fontSize:12, color:group.color, fontWeight:700 }}>
                  Total: {group.items.reduce((s,i)=>s+i.kw,0)} kW
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* SDG context */}
      <div className="card" style={{ background:'linear-gradient(135deg,rgba(16,185,129,0.06),rgba(5,150,105,0.03))', borderColor:'rgba(16,185,129,0.15)' }}>
        <div style={{ display:'flex', gap:16, alignItems:'flex-start' }}>
          <div style={{ fontSize:32, flexShrink:0 }}>🌍</div>
          <div>
            <div style={{ fontWeight:700, fontSize:15, color:'var(--accent-data)', marginBottom:6 }}>UN SDG 7 Impact — Rural Electrification</div>
            <div style={{ fontSize:13, color:'var(--text-secondary)', lineHeight:1.7 }}>
              India has ~67,000 villages where grid connectivity is unstable or absent. GridWise's micro-grid module
              enables <strong style={{ color:'var(--text-primary)' }}>priority-based load management</strong> so that
              hospitals, schools, and water pumps always have power — even when solar is low and battery is limited.
              This module provides a digital twin that operators can use to simulate and plan load-shedding decisions
              before they make them in real infrastructure.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
