// src/pages/CoinWallet.jsx
// Feature 5 — Energy Coins wallet, ledger, leaderboard, nudges
import { useEffect, useState, useRef } from 'react';
import { subscribeToWallet, signInAnon, onAuth } from '../lib/firebase';
import NudgeCard from '../components/NudgeCard';

const MOCK_LEADERBOARD = [
  { uid: 'u1', name: 'Priya S.',      zone: 'DL-01', coins: 4820, streak: 12, trend: 'up' },
  { uid: 'u2', name: 'Arjun M.',      zone: 'MH-01', coins: 4205, streak: 8,  trend: 'up' },
  { uid: 'u3', name: 'Kavya R.',      zone: 'KA-01', coins: 3891, streak: 15, trend: 'up' },
  { uid: 'u4', name: 'Rohit K.',      zone: 'UP-01', coins: 3410, streak: 5,  trend: 'down' },
  { uid: 'u5', name: 'Sneha T.',      zone: 'TN-01', coins: 3102, streak: 9,  trend: 'up' },
  { uid: 'u6', name: 'Vikram P.',     zone: 'GJ-01', coins: 2889, streak: 3,  trend: 'down' },
  { uid: 'u7', name: 'Aarti N.',      zone: 'WB-01', coins: 2574, streak: 7,  trend: 'up' },
  { uid: 'u8', name: 'Deepak L.',     zone: 'HR-01', coins: 2210, streak: 2,  trend: 'down' },
];

const BADGES = [
  { id: 'starter', icon: '🌱', threshold: 50,   desc: 'First Steps — Earn 50 coins',      label: 'First Steps' },
  { id: 'saver',   icon: '💡', threshold: 200,  desc: 'Power Saver — Earn 200 coins',    label: 'Power Saver' },
  { id: 'hero',    icon: '⚡', threshold: 500,  desc: 'Grid Hero — Earn 500 coins',      label: 'Grid Hero' },
  { id: 'champ',   icon: '🏆', threshold: 1000, desc: 'Champion — Earn 1,000 coins',     label: 'Champion' },
  { id: 'legend',  icon: '🌟', threshold: 5000, desc: 'Legend — Earn 5,000 coins',       label: 'Legend' },
];

const HOW_ITEMS = [
  { step: 1, icon: '📩', title: 'Receive AI Nudge',  desc: 'GridWise detects peak hours and sends a personalised energy-saving suggestion to your zone.' },
  { step: 2, icon: '✅', title: 'Accept & Act',       desc: 'Tap Accept to confirm you\'ll follow the nudge. The AI trusts you!' },
  { step: 3, icon: '🪙', title: 'Earn Energy Coins', desc: 'Coins are instantly credited. Each coin represents ~10 Wh of grid stress you prevented.' },
  { step: 4, icon: '🏆', title: 'Climb the Board',   desc: 'Top earners per zone get featured and win monthly cashback rewards on electricity bills.' },
];

export default function CoinWallet() {
  const [user, setUser]           = useState(null);
  const [wallet, setWallet]       = useState({ coins: 0, transactions: {} });
  const [activeTab, setActiveTab] = useState('nudge');
  const [flash, setFlash]         = useState(null);
  const [coinBurst, setCoinBurst] = useState([]);
  const flashTimeout = useRef(null);

  useEffect(() => {
    const unsub = onAuth(async (u) => {
      if (u) {
        setUser(u);
        const unsubWallet = subscribeToWallet(u.uid, setWallet);
        return unsubWallet;
      } else {
        await signInAnon();
      }
    });
    return unsub;
  }, []);

  const transactions = Object.entries(wallet.transactions || {})
    .map(([id, tx]) => ({ id, ...tx }))
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  const handleCoinsEarned = (amount) => {
    clearTimeout(flashTimeout.current);
    setFlash(amount);
    // Burst animation
    const burst = Array.from({ length: 12 }, (_, i) => ({
      id: Date.now() + i,
      angle: (i / 12) * 360,
      dist: 60 + Math.random() * 50,
    }));
    setCoinBurst(burst);
    flashTimeout.current = setTimeout(() => {
      setFlash(null);
      setCoinBurst([]);
    }, 2500);
  };

  const dailyGoal   = 200;
  const dailyEarned = Math.min(wallet.coins % 200, 200);
  const goalPct     = Math.round((dailyEarned / dailyGoal) * 100);

  const TABS = [
    { id: 'nudge',       label: '⚡ Today\'s Nudge' },
    { id: 'ledger',      label: '📋 History' },
    { id: 'leaderboard', label: '🏆 Leaderboard' },
  ];

  return (
    <div className="page-container">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Energy Coins</h1>
          <p className="page-subtitle">Earn coins by reducing peak-hour consumption. Help balance the grid.</p>
        </div>
        <span className="chip demand">Demand-side</span>
      </div>

      {/* Coin flash notification */}
      {flash && (
        <div style={{
          position: 'fixed', top: 24, right: 24, zIndex: 1000,
          background: 'linear-gradient(135deg,#f59e0b,#fcd34d)',
          color: '#000', fontWeight: 800, fontSize: 20,
          padding: '14px 28px', borderRadius: 16,
          animation: 'coinFlash 0.4s cubic-bezier(0.34,1.56,0.64,1)',
          boxShadow: '0 8px 40px rgba(245,158,11,0.5)',
        }}>
          <style>{`@keyframes coinFlash { from{opacity:0;transform:scale(0.7) translateY(-10px)} to{opacity:1;transform:scale(1) translateY(0)} }`}</style>
          +{flash} 🪙 earned!
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: 20 }}>
        {/* Left: Balance */}
        <div>
          {/* Coin balance card with burst */}
          <div className="coin-balance-card mb-4" style={{ marginBottom: 16, position: 'relative', overflow: 'visible' }}>
            {/* Coin burst particles */}
            {coinBurst.map((c) => {
              const rad = (c.angle * Math.PI) / 180;
              const tx = Math.cos(rad) * c.dist;
              const ty = Math.sin(rad) * c.dist;
              return (
                <div
                  key={c.id}
                  style={{
                    position: 'absolute',
                    left: '50%', top: '50%',
                    width: 12, height: 12,
                    background: 'radial-gradient(#fcd34d, #f59e0b)',
                    borderRadius: '50%',
                    animation: `burst 1.2s ease forwards`,
                    zIndex: 10,
                    '--tx': `${tx}px`, '--ty': `${ty}px`,
                  }}
                />
              );
            })}
            <style>{`
              @keyframes burst {
                0%   { opacity:1; transform:translate(-50%,-50%) scale(0.3); }
                50%  { opacity:1; transform:translate(calc(-50% + var(--tx)), calc(-50% + var(--ty))) scale(1); }
                100% { opacity:0; transform:translate(calc(-50% + var(--tx)), calc(-50% + var(--ty))) scale(0.5); }
              }
            `}</style>
            <div className="coin-symbol">🪙</div>
            <div className="coin-amount">{(wallet.coins || 0).toLocaleString()}</div>
            <div className="coin-label">Energy Coins</div>
            {user && (
              <div style={{ fontSize: 11, color: 'rgba(245,158,11,0.5)', marginTop: 6, fontFamily: 'JetBrains Mono' }}>
                ID: {user.uid.slice(0, 8)}…
              </div>
            )}
          </div>

          {/* Daily goal ring */}
          <div className="card" style={{ textAlign: 'center' }}>
            <div className="card-title" style={{ marginBottom: 16 }}>Daily Goal</div>
            <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="120" height="120" viewBox="0 0 120 120">
                <circle cx="60" cy="60" r="50" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="10" />
                <circle
                  cx="60" cy="60" r="50"
                  fill="none"
                  stroke="var(--accent-demand)"
                  strokeWidth="10"
                  strokeDasharray={`${2 * Math.PI * 50}`}
                  strokeDashoffset={`${2 * Math.PI * 50 * (1 - goalPct / 100)}`}
                  strokeLinecap="round"
                  transform="rotate(-90 60 60)"
                  style={{ transition: 'stroke-dashoffset 0.8s ease' }}
                />
              </svg>
              <div style={{ position: 'absolute', textAlign: 'center' }}>
                <div style={{ fontSize: 22, fontWeight: 800, fontFamily: 'JetBrains Mono', color: 'var(--accent-demand)' }}>
                  {goalPct}%
                </div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>of 200 coins</div>
              </div>
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 10 }}>
              {dailyEarned} / {dailyGoal} coins today
            </div>
          </div>

          {/* Badges */}
          <div className="card" style={{ marginTop: 16 }}>
            <div className="card-title" style={{ marginBottom: 14 }}>Achievement Badges</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {BADGES.map((b) => {
                const earned = wallet.coins >= b.threshold;
                return (
                  <div
                    key={b.id}
                    title={b.desc}
                    style={{
                      padding: '10px 12px', borderRadius: 8, textAlign: 'center',
                      background: earned ? 'rgba(245,158,11,0.1)' : 'rgba(255,255,255,0.02)',
                      border: `1px solid ${earned ? 'rgba(245,158,11,0.3)' : 'var(--border-subtle)'}`,
                      filter: earned ? 'none' : 'grayscale(1) opacity(0.3)',
                      transition: 'all 0.3s',
                    }}
                  >
                    <div style={{ fontSize: 24 }}>{b.icon}</div>
                    <div style={{ fontSize: 10, color: earned ? 'var(--accent-demand)' : 'var(--text-muted)', marginTop: 4, fontWeight: 600 }}>
                      {b.label}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right: Tabs */}
        <div>
          <div style={{ display: 'flex', gap: 4, marginBottom: 16 }}>
            {TABS.map((t) => (
              <button
                key={t.id}
                className={`btn ${activeTab === t.id ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setActiveTab(t.id)}
                id={`tab-${t.id}`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Tab: Nudge */}
          {activeTab === 'nudge' && (
            <div>
              <NudgeCard userId={user?.uid} onCoinsEarned={handleCoinsEarned} />
              <div className="card" style={{ marginTop: 16 }}>
                <div className="card-title" style={{ marginBottom: 14 }}>How It Works</div>
                {HOW_ITEMS.map((item) => (
                  <div key={item.step} style={{ display: 'flex', gap: 14, marginBottom: 16 }}>
                    <div style={{
                      width: 36, height: 36, borderRadius: '50%',
                      background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)',
                      display: 'grid', placeItems: 'center', fontSize: 18, flexShrink: 0,
                    }}>
                      {item.icon}
                    </div>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 600 }}>{item.title}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{item.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tab: Ledger */}
          {activeTab === 'ledger' && (
            <div className="card">
              <div className="card-title" style={{ marginBottom: 16 }}>Transaction History</div>
              {transactions.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>
                  <div style={{ fontSize: 40, marginBottom: 10 }}>🪙</div>
                  No transactions yet. Accept a nudge to earn your first coins!
                </div>
              ) : (
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Date/Time</th>
                      <th>Reason</th>
                      <th>Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transactions.map((tx) => (
                      <tr key={tx.id}>
                        <td className="mono" style={{ fontSize: 12 }}>
                          {new Date(tx.timestamp).toLocaleString('en-IN', {
                            day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
                          })}
                        </td>
                        <td style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{tx.reason}</td>
                        <td>
                          <span style={{ color: 'var(--accent-demand)', fontWeight: 700, fontFamily: 'JetBrains Mono' }}>
                            +{tx.amount} 🪙
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* Tab: Leaderboard */}
          {activeTab === 'leaderboard' && (
            <div className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <div className="card-title">Zone Leaderboard</div>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>All India · This month</span>
              </div>
              {MOCK_LEADERBOARD.map((entry, i) => (
                <div key={entry.uid} className="leaderboard-row">
                  <div className={`leaderboard-rank ${i < 3 ? 'top' : ''}`}>
                    {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div className="leaderboard-name">{entry.name}</div>
                    <div className="leaderboard-zone">
                      {entry.zone} · 🔥 {entry.streak}-day streak
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 12, color: entry.trend === 'up' ? 'var(--status-normal)' : 'var(--status-critical)' }}>
                      {entry.trend === 'up' ? '↑' : '↓'}
                    </span>
                    <div className="leaderboard-coins">{entry.coins.toLocaleString()} 🪙</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
