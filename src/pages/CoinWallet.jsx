// src/pages/CoinWallet.jsx
// Feature 5 — Energy Coins wallet, ledger, leaderboard
import { useEffect, useState } from 'react';
import { subscribeToWallet, signInAnon, onAuth } from '../lib/firebase';
import NudgeCard from '../components/NudgeCard';

const MOCK_LEADERBOARD = [
  { uid: 'u1', name: 'Priya S.',       zone: 'DL-01', coins: 4820 },
  { uid: 'u2', name: 'Arjun M.',       zone: 'MH-01', coins: 4205 },
  { uid: 'u3', name: 'Kavya R.',       zone: 'KA-01', coins: 3891 },
  { uid: 'u4', name: 'Rohit K.',       zone: 'UP-01', coins: 3410 },
  { uid: 'u5', name: 'Sneha T.',       zone: 'TN-01', coins: 3102 },
  { uid: 'u6', name: 'Vikram P.',      zone: 'GJ-01', coins: 2889 },
  { uid: 'u7', name: 'Aarti N.',       zone: 'WB-01', coins: 2574 },
  { uid: 'u8', name: 'Deepak L.',      zone: 'HR-01', coins: 2210 },
];

export default function CoinWallet() {
  const [user, setUser]         = useState(null);
  const [wallet, setWallet]     = useState({ coins: 0, transactions: {} });
  const [activeTab, setActiveTab] = useState('nudge'); // 'nudge' | 'ledger' | 'leaderboard'
  const [flash, setFlash]       = useState(null);

  useEffect(() => {
    const unsub = onAuth(async (u) => {
      if (u) {
        setUser(u);
        const unsubWallet = subscribeToWallet(u.uid, setWallet);
        return unsubWallet;
      } else {
        // Auto sign in anon for citizen users
        await signInAnon();
      }
    });
    return unsub;
  }, []);

  const transactions = Object.entries(wallet.transactions || {})
    .map(([id, tx]) => ({ id, ...tx }))
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  const handleCoinsEarned = (amount) => {
    setFlash(amount);
    setTimeout(() => setFlash(null), 2500);
  };

  // Daily saving goal (mock)
  const dailyGoal   = 200;
  const dailyEarned = Math.min(wallet.coins % 200, 200); // demo: progress within 200
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
          <p className="page-subtitle">Earn coins by reducing peak-hour consumption</p>
        </div>
        <span className="chip demand">Demand-side</span>
      </div>

      {/* Coin flash */}
      {flash && (
        <div style={{
          position: 'fixed', top: 24, right: 24, zIndex: 1000,
          background: 'linear-gradient(135deg,#f59e0b,#fcd34d)',
          color: '#000', fontWeight: 800, fontSize: 18,
          padding: '12px 24px', borderRadius: 12,
          animation: 'slideDown 0.3s ease',
          boxShadow: '0 8px 32px rgba(245,158,11,0.4)'
        }}>
          +{flash} 🪙 coins earned!
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: 20 }}>
        {/* Left: Balance */}
        <div>
          <div className="coin-balance-card mb-4">
            <div className="coin-symbol">🪙</div>
            <div className="coin-amount">{(wallet.coins || 0).toLocaleString()}</div>
            <div className="coin-label">Energy Coins</div>
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
                  style={{ transition: 'stroke-dashoffset 0.6s ease' }}
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
            <div className="card-title" style={{ marginBottom: 12 }}>Badges</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {BADGES.map((b) => (
                <div
                  key={b.id}
                  title={b.desc}
                  style={{
                    padding: '6px 10px', borderRadius: 8, fontSize: 20,
                    background: wallet.coins >= b.threshold
                      ? 'rgba(245,158,11,0.12)'
                      : 'rgba(255,255,255,0.03)',
                    border: `1px solid ${wallet.coins >= b.threshold ? 'rgba(245,158,11,0.3)' : 'var(--border-subtle)'}`,
                    filter: wallet.coins >= b.threshold ? 'none' : 'grayscale(1) opacity(0.3)',
                    cursor: 'help',
                    transition: 'all 0.2s',
                  }}
                >
                  {b.icon}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right: Tabs */}
        <div>
          {/* Tabs */}
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
                <div className="card-title" style={{ marginBottom: 12 }}>How It Works</div>
                {HOW_ITEMS.map((item) => (
                  <div key={item.step} style={{ display: 'flex', gap: 14, marginBottom: 14 }}>
                    <div style={{
                      width: 32, height: 32, borderRadius: '50%',
                      background: 'rgba(245,158,11,0.12)',
                      border: '1px solid rgba(245,158,11,0.3)',
                      display: 'grid', placeItems: 'center', fontSize: 16,
                      flexShrink: 0
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
                <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-muted)' }}>
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
                            day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
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
              <div className="card-title" style={{ marginBottom: 16 }}>Zone Leaderboard</div>
              {MOCK_LEADERBOARD.map((entry, i) => (
                <div key={entry.uid} className="leaderboard-row">
                  <div className={`leaderboard-rank ${i < 3 ? 'top' : ''}`}>
                    {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div className="leaderboard-name">{entry.name}</div>
                    <div className="leaderboard-zone">{entry.zone}</div>
                  </div>
                  <div className="leaderboard-coins">{entry.coins.toLocaleString()} 🪙</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const BADGES = [
  { id: 'starter', icon: '🌱', threshold: 50,   desc: 'First Steps — Earn 50 coins' },
  { id: 'saver',   icon: '💡', threshold: 200,  desc: 'Power Saver — Earn 200 coins' },
  { id: 'hero',    icon: '⚡', threshold: 500,  desc: 'Grid Hero — Earn 500 coins' },
  { id: 'champ',   icon: '🏆', threshold: 1000, desc: 'Champion — Earn 1,000 coins' },
  { id: 'legend',  icon: '🌟', threshold: 5000, desc: 'Legend — Earn 5,000 coins' },
];

const HOW_ITEMS = [
  { step: 1, icon: '📩', title: 'Receive AI Nudge',   desc: 'GridWise detects peak hours in your zone and sends a personalised energy-saving suggestion.' },
  { step: 2, icon: '✅', title: 'Accept & Act',        desc: 'Tap Accept to confirm you\'ll follow the nudge. The AI trusts you!' },
  { step: 3, icon: '🪙', title: 'Earn Energy Coins',  desc: 'Coins are instantly credited to your wallet.' },
  { step: 4, icon: '🏆', title: 'Climb the Board',    desc: 'Top earners in each zone get featured on the leaderboard and win monthly rewards.' },
];
