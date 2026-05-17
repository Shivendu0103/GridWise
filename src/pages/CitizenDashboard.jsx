// src/pages/CitizenDashboard.jsx
// Consumer-facing citizen dashboard — coins, nudges, zone status, report form, activity, leaderboard
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';
import NudgeCard from '../components/NudgeCard';
import {
  subscribeToZoneLoad,
  subscribeToZoneLeaderboard,
  subscribeToNudgeHistory,
  subscribeToCitizenReports,
  submitCitizenReport,
  recordNudgeCompliance,
  updateUserProfile,
  subscribeToTransactions,
  verifyCitizenReport,
} from '../lib/firebase';
import zonesData from '../../data/zones.json';

const ZONES = zonesData.zones;

const ISSUE_TYPES = [
  { id: 'outage',      label: 'Power Cut',           icon: '🔌' },
  { id: 'voltage',     label: 'Voltage Fluctuation', icon: '💡' },
  { id: 'transformer', label: 'Transformer Fault',   icon: '⚡' },
  { id: 'lowvoltage',  label: 'Low Voltage',         icon: '📉' },
  { id: 'other',       label: 'Other',               icon: '📝' },
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

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  if (h < 20) return 'Good evening';
  return 'Good night';
}

function statusColor(status) {
  const m = { normal: '#10b981', low: '#3b82f6', surplus: '#6366f1', overload: '#f59e0b', critical: '#ef4444' };
  return m[status] || '#10b981';
}

function timeAgo(ts) {
  const diff = Date.now() - new Date(ts).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'Just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function CitizenDashboard() {
  const navigate = useNavigate();
  const { user, userProfile, logout } = useAuth();

  const [zoneData, setZoneData] = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);
  const [nudgeHistory, setNudgeHistory] = useState([]);
  const [myReports, setMyReports] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [coins, setCoins] = useState(userProfile?.energy_coins || 0);

  // Report form state
  const [reportForm, setReportForm] = useState({
    type: 'outage', description: '', severity: '3', lat: null, lng: null,
  });
  const [locating, setLocating] = useState(false);
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [reportSuccess, setReportSuccess] = useState(false);

  const zoneId = userProfile?.zone_id;
  const zoneName = ZONES.find((z) => z.zoneId === zoneId)?.name || zoneId || 'Unknown Zone';
  const isGuest = userProfile?.isGuest;

  // Sync coins from userProfile
  useEffect(() => {
    if (userProfile?.energy_coins !== undefined) setCoins(userProfile.energy_coins);
  }, [userProfile?.energy_coins]);

  // Zone load subscription
  useEffect(() => {
    if (!zoneId) return;
    return subscribeToZoneLoad(zoneId, setZoneData);
  }, [zoneId]);

  // Leaderboard
  useEffect(() => {
    if (!zoneId) return;
    return subscribeToZoneLeaderboard(zoneId, setLeaderboard);
  }, [zoneId]);

  // Nudge history
  useEffect(() => {
    if (!user?.uid || isGuest) return;
    return subscribeToNudgeHistory(user.uid, setNudgeHistory);
  }, [user?.uid, isGuest]);

  // My reports
  useEffect(() => {
    if (!user?.uid || isGuest) return;
    return subscribeToCitizenReports(user.uid, setMyReports);
  }, [user?.uid, isGuest]);

  // Ledger
  useEffect(() => {
    if (!user?.uid || isGuest) return;
    return subscribeToTransactions(user.uid, setTransactions);
  }, [user?.uid, isGuest]);

  // Geolocation
  const detectLocation = () => {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setReportForm((f) => ({ ...f, lat: coords.latitude, lng: coords.longitude }));
        setLocating(false);
      },
      () => setLocating(false),
      { timeout: 8000 }
    );
  };

  // Handle nudge accept/dismiss
  const handleNudgeAction = async (nudge, accepted) => {
    if (!user?.uid || isGuest) return;
    await recordNudgeCompliance(user.uid, nudge, accepted);
    if (accepted && nudge.reward) {
      setCoins((c) => c + nudge.reward); // optimistic update
    }
  };

  const handleVerifyFix = async (reportId) => {
    if (!user?.uid) return;
    try {
      await verifyCitizenReport(reportId, user.uid, 5);
      setCoins(c => c + 5);
    } catch (err) {
      console.error('Verification failed:', err);
    }
  };

  // Submit report
  const handleReportSubmit = async (e) => {
    e.preventDefault();
    if (!reportForm.description.trim()) return;
    setReportSubmitting(true);
    try {
      await submitCitizenReport({
        ...reportForm,
        severity: parseInt(reportForm.severity),
        userId: user?.uid || 'anon',
        zoneId: zoneId || '',
        zoneName,
      });
      setReportSuccess(true);
      setReportForm({ type: 'outage', description: '', severity: '3', lat: null, lng: null });
      setTimeout(() => setReportSuccess(false), 5000);
    } catch (err) {
      console.error('[CitizenDashboard] Report error:', err);
    } finally {
      setReportSubmitting(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/', { replace: true });
  };

  const loadPct = zoneData?.currentLoad ? Math.round(zoneData.currentLoad) : null;
  const zoneStatus = zoneData?.status || 'normal';

  const dailyGoal   = 200;
  const dailyEarned = Math.min(coins % 200, 200);
  const goalPct     = Math.round((dailyEarned / dailyGoal) * 100);

  return (
    <div className="citizen-page">
      {/* Top Navbar */}
      <nav className="citizen-navbar">
        <div className="citizen-nav-logo">
          <span>⚡</span>
          GridWise
        </div>
        <div className="citizen-nav-actions">
          {isGuest && (
            <button
              className="btn btn-sm"
              onClick={() => navigate('/login', { state: { role: 'citizen' } })}
              style={{ background: 'rgba(251,191,36,0.15)', color: '#fbbf24', border: '1px solid rgba(251,191,36,0.3)', borderRadius: 999 }}
            >
              Create Account
            </button>
          )}
          <button
            className="btn btn-sm btn-secondary"
            onClick={handleLogout}
            style={{ borderRadius: 999 }}
            id="citizen-logout-btn"
          >
            Sign Out
          </button>
        </div>
      </nav>

      <div className="citizen-content">
        {/* ── Greeting ── */}
        <div className="citizen-greeting">
          <div className="citizen-greeting-name">
            {getGreeting()}{userProfile?.name && !isGuest ? `, ${userProfile.name.split(' ')[0]}` : ''}! 👋
          </div>
          <div className="citizen-greeting-sub">
            <span>{zoneName}</span>
            {zoneData && (
              <span
                className={`status-pill ${zoneStatus}`}
                style={{ fontSize: 11 }}
              >
                {zoneStatus}
              </span>
            )}
          </div>
        </div>

        {/* ── Energy Coins ── */}
        <div className="citizen-coins-card" style={{ position: 'relative' }}>
          <div className="citizen-coins-icon">🪙</div>
          <div className="citizen-coins-amount">{coins.toLocaleString()}</div>
          <div className="citizen-coins-label">Energy Coins</div>
          {isGuest && (
            <div style={{ fontSize: 12, color: 'rgba(251,191,36,0.5)', marginTop: 8 }}>
              Create an account to save your coins
            </div>
          )}
        </div>

        {/* ── Daily Goal & Badges (Citizen Ext) ── */}
        {!isGuest && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 16, marginBottom: 24 }}>
            <div className="citizen-section" style={{ marginBottom: 0, textAlign: 'center' }}>
              <div className="citizen-section-title" style={{ fontSize: 13, marginBottom: 12 }}>Daily Goal</div>
              <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="80" height="80" viewBox="0 0 120 120">
                  <circle cx="60" cy="60" r="50" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="10" />
                  <circle
                    cx="60" cy="60" r="50"
                    fill="none"
                    stroke="#fbbf24"
                    strokeWidth="10"
                    strokeDasharray={`${2 * Math.PI * 50}`}
                    strokeDashoffset={`${2 * Math.PI * 50 * (1 - goalPct / 100)}`}
                    strokeLinecap="round"
                    transform="rotate(-90 60 60)"
                    style={{ transition: 'stroke-dashoffset 0.8s ease' }}
                  />
                </svg>
                <div style={{ position: 'absolute', textAlign: 'center' }}>
                  <div style={{ fontSize: 16, fontWeight: 800, fontFamily: 'JetBrains Mono', color: '#fbbf24' }}>
                    {goalPct}%
                  </div>
                </div>
              </div>
              <div style={{ fontSize: 10, color: '#64748b', marginTop: 8 }}>
                {dailyEarned} / {dailyGoal} coins
              </div>
            </div>

            <div className="citizen-section" style={{ marginBottom: 0 }}>
              <div className="citizen-section-title" style={{ fontSize: 13, marginBottom: 12 }}>Achievements</div>
              <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
                {BADGES.map((b) => {
                  const earned = coins >= b.threshold;
                  return (
                    <div
                      key={b.id}
                      title={b.desc}
                      style={{
                        padding: '8px', borderRadius: 8, textAlign: 'center', flexShrink: 0, minWidth: 65,
                        background: earned ? 'rgba(251,191,36,0.1)' : 'rgba(255,255,255,0.02)',
                        border: `1px solid ${earned ? 'rgba(251,191,36,0.3)' : 'rgba(255,255,255,0.05)'}`,
                        filter: earned ? 'none' : 'grayscale(1) opacity(0.3)',
                      }}
                    >
                      <div style={{ fontSize: 20 }}>{b.icon}</div>
                      <div style={{ fontSize: 9, color: earned ? '#fbbf24' : '#64748b', marginTop: 4, fontWeight: 600 }}>
                        {b.label}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ── Active Nudge ── */}
        <div className="citizen-section">
          <div className="citizen-section-title">⚡ Active Grid Nudge</div>
          <NudgeCard
            userId={isGuest ? null : user?.uid}
            onCoinsEarned={(amt, nudge) => {
              handleNudgeAction(nudge, true);
            }}
          />
        </div>

        {/* ── Zone Status ── */}
        {zoneData && (
          <div className="citizen-section">
            <div className="citizen-section-title">🗺️ My Zone Status</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 13, color: '#94a3b8' }}>{zoneName}</div>
                <div style={{ fontFamily: 'JetBrains Mono', fontWeight: 800, fontSize: 28, color: statusColor(zoneStatus) }}>
                  {loadPct}%
                </div>
              </div>
              <span className={`status-pill ${zoneStatus}`}>{zoneStatus}</span>
            </div>
            <div className="zone-load-bar">
              <div
                className="zone-load-fill"
                style={{
                  width: `${loadPct || 0}%`,
                  background: loadPct > 85
                    ? 'linear-gradient(90deg, #dc2626, #ef4444)'
                    : loadPct > 70
                    ? 'linear-gradient(90deg, #d97706, #f59e0b)'
                    : 'linear-gradient(90deg, #059669, #10b981)',
                }}
              />
            </div>
            <div className="ai-prediction-tag">
              🤖 AI predicts peak load at 8:00 PM tonight — consider shifting heavy usage to after 10 PM.
            </div>
          </div>
        )}

        {/* ── Report an Issue ── */}
        <div className="citizen-section">
          <div className="citizen-section-title">📍 Report an Issue</div>

          {reportSuccess ? (
            <div style={{ textAlign: 'center', padding: '24px 0' }}>
              <div style={{ fontSize: 48, marginBottom: 10 }}>✅</div>
              <div style={{ fontWeight: 700, color: '#10b981', fontSize: 16 }}>Report Submitted!</div>
              <div style={{ fontSize: 13, color: '#64748b', marginTop: 6 }}>
                You may earn <strong style={{ color: '#fbbf24' }}>5 Energy Coins</strong> if your report is verified.
              </div>
            </div>
          ) : (
            <form onSubmit={handleReportSubmit} id="citizen-issue-form">
              {/* Issue type selector */}
              <div className="form-group">
                <label className="form-label">Issue Type</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                  {ISSUE_TYPES.map((t) => (
                    <label
                      key={t.id}
                      style={{
                        padding: '10px 8px',
                        borderRadius: 10,
                        border: `1px solid ${reportForm.type === t.id ? 'rgba(251,191,36,0.5)' : 'rgba(255,255,255,0.07)'}`,
                        background: reportForm.type === t.id ? 'rgba(251,191,36,0.08)' : 'rgba(255,255,255,0.02)',
                        cursor: 'pointer',
                        textAlign: 'center',
                        fontSize: 12,
                        color: reportForm.type === t.id ? '#fbbf24' : '#64748b',
                        transition: 'all 0.15s',
                      }}
                    >
                      <input
                        type="radio"
                        name="issue-type"
                        value={t.id}
                        checked={reportForm.type === t.id}
                        onChange={() => setReportForm((f) => ({ ...f, type: t.id }))}
                        style={{ display: 'none' }}
                      />
                      <div style={{ fontSize: 18, marginBottom: 4 }}>{t.icon}</div>
                      {t.label}
                    </label>
                  ))}
                </div>
              </div>

              {/* Description */}
              <div className="form-group">
                <label className="form-label">Description</label>
                <textarea
                  className="form-control"
                  placeholder="Describe the issue — duration, affected area, visible signs…"
                  value={reportForm.description}
                  onChange={(e) => setReportForm((f) => ({ ...f, description: e.target.value }))}
                  required
                  id="citizen-issue-desc"
                  style={{ minHeight: 80 }}
                />
              </div>

              {/* Severity */}
              <div className="form-group">
                <label className="form-label">Severity</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  {[1, 2, 3, 4, 5].map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setReportForm((f) => ({ ...f, severity: String(s) }))}
                      style={{
                        flex: 1, height: 36, borderRadius: 8, border: 'none', cursor: 'pointer',
                        background: reportForm.severity === String(s)
                          ? s <= 2 ? 'rgba(59,130,246,0.25)' : s === 3 ? 'rgba(245,158,11,0.2)' : 'rgba(239,68,68,0.25)'
                          : 'rgba(255,255,255,0.04)',
                        color: reportForm.severity === String(s)
                          ? s <= 2 ? '#3b82f6' : s === 3 ? '#f59e0b' : '#ef4444'
                          : '#475569',
                        fontWeight: 700, fontSize: 15, transition: 'all 0.15s',
                      }}
                    >
                      {s}
                    </button>
                  ))}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#475569', marginTop: 4 }}>
                  <span>Minor</span><span>Critical</span>
                </div>
              </div>

              {/* Geolocation */}
              <div style={{ marginBottom: 16 }}>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={detectLocation}
                  disabled={locating}
                  style={{ borderRadius: 999 }}
                >
                  {locating ? '⏳ Locating…' : '📍 Auto-detect location'}
                </button>
                {reportForm.lat && (
                  <span style={{ fontSize: 11, color: '#10b981', marginLeft: 10 }}>
                    ✓ Location captured
                  </span>
                )}
              </div>

              <button
                type="submit"
                className="auth-submit-btn"
                disabled={reportSubmitting || !reportForm.description.trim()}
                id="citizen-report-submit"
                style={{
                  background: 'linear-gradient(135deg, rgba(251,191,36,0.9), rgba(249,115,22,0.8))',
                  color: '#0a0e1a',
                }}
              >
                {reportSubmitting ? '⏳ Submitting…' : '📍 Submit Report'}
              </button>
            </form>
          )}
        </div>

        {/* ── My Activity ── */}
        {!isGuest && (nudgeHistory.length > 0 || myReports.length > 0) && (
          <div className="citizen-section">
            <div className="citizen-section-title">📋 My Activity</div>

            {nudgeHistory.length > 0 && (
              <>
                <div style={{ fontSize: 11, color: '#475569', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
                  Recent Nudges
                </div>
                {nudgeHistory.map((n) => (
                  <div className="activity-item" key={n.id}>
                    <div
                      className="activity-dot"
                      style={{ background: n.accepted ? '#10b981' : '#ef4444' }}
                    />
                    <div className="activity-text">
                      {n.accepted ? `✓ Accepted: ${n.message}` : `✕ Dismissed: ${n.message}`}
                      {n.accepted && n.reward > 0 && (
                        <span style={{ color: '#fbbf24', marginLeft: 6 }}>+{n.reward} 🪙</span>
                      )}
                    </div>
                    <div className="activity-time">{timeAgo(n.timestamp)}</div>
                  </div>
                ))}
              </>
            )}

            {myReports.length > 0 && (
              <>
                <div style={{ fontSize: 11, color: '#475569', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, margin: '12px 0 8px' }}>
                  My Reports
                </div>
                {myReports.slice(0, 3).map((r) => (
                  <div className="activity-item" key={r.id}>
                    <div className="activity-dot" style={{ background: '#3b82f6' }} />
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div className="activity-text" style={{ flex: 1, paddingRight: 8 }}>
                        {ISSUE_TYPES.find((t) => t.id === r.type)?.icon} {r.type} — {r.description?.slice(0, 60)}
                      </div>
                      {r.status === 'operator_resolved' && (
                        <button 
                          className="btn btn-sm" 
                          onClick={() => handleVerifyFix(r.id)}
                          style={{ padding: '2px 6px', fontSize: 10, background: 'rgba(16,185,129,0.2)', color: '#10b981', border: '1px solid rgba(16,185,129,0.3)', whiteSpace: 'nowrap' }}
                        >
                          Verify Fix
                        </button>
                      )}
                      {r.status === 'verified_resolved' && (
                        <div style={{ fontSize: 10, color: '#10b981', fontWeight: 600 }}>+5 🪙</div>
                      )}
                    </div>
                    <div className="activity-time">
                      {timeAgo(r.timestamp)}
                      {r.status === 'in_progress' && <span style={{ color: '#3b82f6', marginLeft: 8 }}>• In Progress</span>}
                    </div>
                  </div>
                ))}
              </>
            )}

            {transactions.length > 0 && (
              <>
                <div style={{ fontSize: 11, color: '#475569', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, margin: '12px 0 8px' }}>
                  Coin Ledger
                </div>
                {transactions.slice(0, 3).map((tx) => (
                  <div className="activity-item" key={tx.id}>
                    <div className="activity-dot" style={{ background: '#fbbf24' }} />
                    <div className="activity-text">
                      {tx.reason} <span style={{ color: '#fbbf24', marginLeft: 6, fontWeight: 700 }}>+{tx.amount} 🪙</span>
                    </div>
                    <div className="activity-time">{timeAgo(tx.timestamp)}</div>
                  </div>
                ))}
              </>
            )}
          </div>
        )}

        {/* ── Leaderboard ── */}
        {leaderboard.length > 0 && (
          <div className="citizen-section">
            <div className="citizen-section-title">🏆 Zone Leaderboard</div>
            <div style={{ fontSize: 12, color: '#475569', marginBottom: 12 }}>
              Top Energy Coin earners in {zoneName}
            </div>
            {leaderboard.map((u, i) => (
              <div
                className="leaderboard-item"
                key={u.uid}
                style={
                  u.uid === user?.uid
                    ? { background: 'rgba(251,191,36,0.06)', borderRadius: 8, padding: '10px 8px', margin: '0 -8px' }
                    : {}
                }
              >
                <div className={`leaderboard-num ${i < 3 ? 'top3' : ''}`}>
                  {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`}
                </div>
                <div className="leaderboard-user">
                  {u.name || 'Anonymous'}
                  {u.uid === user?.uid && (
                    <span style={{ fontSize: 10, color: '#fbbf24', marginLeft: 8 }}>You</span>
                  )}
                </div>
                <div className="leaderboard-coins-val">{(u.energy_coins || 0).toLocaleString()} 🪙</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
