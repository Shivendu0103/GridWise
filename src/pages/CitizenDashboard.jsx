// src/pages/CitizenDashboard.jsx
// Consumer-facing citizen dashboard — rewritten to match Operator Dashboard layout
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

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  if (h < 20) return 'Good evening';
  return 'Good night';
}

function statusColor(status) {
  const m = { normal: 'var(--status-normal)', low: 'var(--status-low)', surplus: 'var(--status-surplus)', overload: 'var(--status-overload)', critical: 'var(--status-critical)' };
  return m[status] || 'var(--status-normal)';
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

  const [localZoneId, setLocalZoneId] = useState(userProfile?.zone_id || 'DL-01');
  const [isChangingZone, setIsChangingZone] = useState(false);

  const isGuest = userProfile?.isGuest;
  const zoneId = isGuest ? localZoneId : (userProfile?.zone_id || 'DL-01');
  const zoneName = ZONES.find((z) => z.zoneId === zoneId)?.name || zoneId || 'Unknown Zone';

  const handleZoneChange = async (e) => {
    const newZoneId = e.target.value;
    if (isGuest) {
      setLocalZoneId(newZoneId);
    } else {
      setIsChangingZone(true);
      try {
        await updateUserProfile(user.uid, { zone_id: newZoneId });
      } catch (err) {
        console.error('Failed to change zone:', err);
      } finally {
        setIsChangingZone(false);
      }
    }
  };

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
    <div>
      {/* ── Top Navbar (Professional Operator Style) ── */}
      <div className="operator-topbar">
        <div className="operator-topbar-left">
          <div className="operator-mode-badge" style={{ background: 'rgba(251,191,36,0.1)', color: '#fbbf24', border: '1px solid rgba(251,191,36,0.2)' }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#fbbf24', display: 'inline-block', animation: 'pulse 2s infinite' }} />
            Citizen Portal
          </div>
          {isGuest && (
            <button
              className="btn btn-sm"
              onClick={() => navigate('/login', { state: { role: 'citizen' } })}
              style={{ background: 'rgba(251,191,36,0.15)', color: '#fbbf24', border: '1px solid rgba(251,191,36,0.3)', borderRadius: 999 }}
            >
              Create Account
            </button>
          )}
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            className="btn btn-sm btn-secondary"
            onClick={handleLogout}
            style={{ borderRadius: 999 }}
          >
            Sign Out
          </button>
        </div>
      </div>

      <div className="page-container">
        {/* ── Header ── */}
        <div className="page-header" style={{ alignItems: 'center' }}>
          <div>
            <h1 className="page-title">
              {getGreeting()}{userProfile?.name && !isGuest ? `, ${userProfile.name.split(' ')[0]}` : ''}! 👋
            </h1>
            <p className="page-subtitle">Manage your energy usage and report issues to help balance the grid.</p>
          </div>
          <div className="header-actions">
            <select
              value={zoneId}
              onChange={handleZoneChange}
              disabled={isChangingZone}
              className="form-control"
              style={{
                background: 'var(--bg-card)',
                color: 'var(--text-primary)',
                borderColor: 'var(--border-subtle)',
                width: 'auto',
                minWidth: '200px',
                fontWeight: '600'
              }}
            >
              {ZONES.map(z => (
                <option key={z.zoneId} value={z.zoneId} style={{ background: 'var(--bg-card)' }}>
                  {z.name}
                </option>
              ))}
            </select>
            {zoneData && (
              <span className={`status-pill ${zoneStatus}`}>
                {zoneStatus}
              </span>
            )}
          </div>
        </div>

        {/* ── Stats Grid (Top-line Metrics) ── */}
        <div className="stats-grid">
          {/* Energy Coins Card */}
          <div className="stat-card" style={{ '--accent-color': '#fbbf24' }}>
            <div className="stat-icon">🪙</div>
            <div className="stat-value" style={{ color: '#fbbf24' }}>{coins.toLocaleString()}</div>
            <div className="stat-label">Energy Coins Balance</div>
            {isGuest && <div className="stat-delta" style={{ color: 'var(--text-muted)' }}>Create account to save</div>}
          </div>

          {/* Daily Goal Card */}
          <div className="stat-card" style={{ '--accent-color': '#10b981', display: 'flex', gap: 16, alignItems: 'center' }}>
            <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="60" height="60" viewBox="0 0 120 120">
                <circle cx="60" cy="60" r="50" fill="none" stroke="var(--border-subtle)" strokeWidth="10" />
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
                <div style={{ fontSize: 14, fontWeight: 800, fontFamily: 'JetBrains Mono', color: '#fbbf24' }}>
                  {goalPct}%
                </div>
              </div>
            </div>
            <div>
              <div className="stat-value" style={{ fontSize: 20 }}>Daily Goal</div>
              <div className="stat-label">{dailyEarned} / {dailyGoal} coins</div>
            </div>
          </div>

          {/* Badges / Achievements */}
          {!isGuest && (
            <div className="stat-card" style={{ '--accent-color': '#6366f1', gridColumn: 'span 2' }}>
              <div className="stat-label" style={{ marginBottom: 8, fontSize: 13, fontWeight: 600 }}>Achievements</div>
              <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 4 }}>
                {BADGES.map((b) => {
                  const earned = coins >= b.threshold;
                  return (
                    <div
                      key={b.id}
                      title={b.desc}
                      style={{
                        padding: '8px 12px', borderRadius: 'var(--radius-sm)', textAlign: 'center', flexShrink: 0,
                        background: earned ? 'var(--bg-glass)' : 'var(--bg-base)',
                        border: `1px solid ${earned ? 'var(--accent-demand)' : 'var(--border-subtle)'}`,
                        filter: earned ? 'none' : 'grayscale(1) opacity(0.5)',
                      }}
                    >
                      <div style={{ fontSize: 20 }}>{b.icon}</div>
                      <div style={{ fontSize: 10, color: earned ? '#fbbf24' : 'var(--text-muted)', marginTop: 4, fontWeight: 600 }}>
                        {b.label}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* ── Main Content Area ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 340px', gap: 24, marginBottom: 20 }}>
          
          {/* Left Column (Zone Status, Nudges, Form) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            {/* Active Nudge */}
            <div className="card">
              <div className="card-header">
                <span className="card-title">⚡ Active Grid Nudge</span>
              </div>
              <NudgeCard
                userId={isGuest ? null : user?.uid}
                onCoinsEarned={(amt, nudge) => {
                  handleNudgeAction(nudge, true);
                }}
              />
            </div>

            {/* Zone Status */}
            {zoneData && (
              <div className="card">
                <div className="card-header">
                  <span className="card-title">🗺️ My Zone Status</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <div>
                    <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{zoneName} Load Level</div>
                    <div style={{ fontFamily: 'JetBrains Mono', fontWeight: 800, fontSize: 32, color: statusColor(zoneStatus) }}>
                      {loadPct}%
                    </div>
                  </div>
                  <span className={`status-pill ${zoneStatus}`} style={{ fontSize: 14 }}>{zoneStatus}</span>
                </div>
                <div className="load-bar-container" style={{ marginBottom: 16 }}>
                  <div className="load-bar-track">
                    <div
                      className={`load-bar-fill ${zoneStatus}`}
                      style={{ width: `${loadPct || 0}%` }}
                    />
                  </div>
                </div>
                <div className="alert-banner" style={{ margin: 0, padding: 12, background: 'rgba(59,130,246,0.1)', borderColor: 'rgba(59,130,246,0.2)' }}>
                  <span className="alert-banner-icon">🤖</span>
                  <div className="alert-banner-content">
                    <div className="alert-banner-title" style={{ color: 'var(--text-primary)' }}>AI Prediction</div>
                    <div className="alert-banner-desc" style={{ color: 'var(--text-secondary)' }}>Peak load expected at 8:00 PM tonight. Consider shifting heavy appliance usage to off-peak hours (after 10 PM) to earn extra coins.</div>
                  </div>
                </div>
              </div>
            )}

            {/* Report Form */}
            <div className="card">
              <div className="card-header">
                <span className="card-title">📍 Report a Grid Issue</span>
              </div>
              {reportSuccess ? (
                <div style={{ textAlign: 'center', padding: '32px 0' }}>
                  <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
                  <div style={{ fontWeight: 700, color: 'var(--status-normal)', fontSize: 18 }}>Report Successfully Submitted!</div>
                  <div style={{ fontSize: 14, color: 'var(--text-secondary)', marginTop: 8 }}>
                    Thank you! You will earn <strong style={{ color: '#fbbf24' }}>5 Energy Coins</strong> once operators verify your report.
                  </div>
                </div>
              ) : (
                <form onSubmit={handleReportSubmit}>
                  <div className="form-group">
                    <label className="form-label">Issue Type</label>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 10 }}>
                      {ISSUE_TYPES.map((t) => (
                        <label
                          key={t.id}
                          style={{
                            padding: '12px 8px',
                            borderRadius: 'var(--radius-sm)',
                            border: `1px solid ${reportForm.type === t.id ? 'var(--accent-demand)' : 'var(--border-subtle)'}`,
                            background: reportForm.type === t.id ? 'rgba(245,158,11,0.08)' : 'var(--bg-base)',
                            cursor: 'pointer',
                            textAlign: 'center',
                            fontSize: 12,
                            color: reportForm.type === t.id ? 'var(--accent-demand)' : 'var(--text-secondary)',
                            fontWeight: reportForm.type === t.id ? 600 : 400,
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
                          <div style={{ fontSize: 24, marginBottom: 6 }}>{t.icon}</div>
                          {t.label}
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Description & Observations</label>
                    <textarea
                      className="form-control"
                      placeholder="E.g. The power just went out in the entire block. I heard a loud pop near the transformer."
                      value={reportForm.description}
                      onChange={(e) => setReportForm((f) => ({ ...f, description: e.target.value }))}
                      required
                      style={{ minHeight: 100, resize: 'vertical' }}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Severity Level</label>
                    <div style={{ display: 'flex', gap: 8 }}>
                      {[1, 2, 3, 4, 5].map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => setReportForm((f) => ({ ...f, severity: String(s) }))}
                          style={{
                            flex: 1, height: 40, borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)', cursor: 'pointer',
                            background: reportForm.severity === String(s)
                              ? s <= 2 ? 'rgba(59,130,246,0.1)' : s === 3 ? 'rgba(245,158,11,0.1)' : 'rgba(239,68,68,0.1)'
                              : 'var(--bg-base)',
                            color: reportForm.severity === String(s)
                              ? s <= 2 ? 'var(--status-low)' : s === 3 ? 'var(--status-overload)' : 'var(--status-critical)'
                              : 'var(--text-secondary)',
                            fontWeight: 700, fontSize: 16, transition: 'all 0.15s',
                          }}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>
                      <span>Minor / Annoyance</span><span>Critical / Total Outage</span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 24 }}>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={detectLocation}
                      disabled={locating}
                    >
                      {locating ? '⏳ Locating…' : '📍 Auto-detect location'}
                    </button>
                    {reportForm.lat && (
                      <span style={{ fontSize: 12, color: 'var(--status-normal)', fontWeight: 600 }}>
                        ✓ Location captured
                      </span>
                    )}
                    <button
                      type="submit"
                      className="btn btn-primary"
                      disabled={reportSubmitting || !reportForm.description.trim()}
                      style={{ marginLeft: 'auto' }}
                    >
                      {reportSubmitting ? '⏳ Submitting…' : 'Submit Report →'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>

          {/* Right Column (Activity, Leaderboard) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            {/* Leaderboard */}
            {leaderboard.length > 0 && (
              <div className="card">
                <div className="card-header" style={{ marginBottom: 8 }}>
                  <span className="card-title">🏆 Top Earners in {zoneName}</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  {leaderboard.map((u, i) => (
                    <div
                      key={u.uid}
                      style={{
                        display: 'flex', alignItems: 'center', padding: '12px 0',
                        borderBottom: i !== leaderboard.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                        background: u.uid === user?.uid ? 'rgba(251,191,36,0.05)' : 'transparent',
                        borderRadius: u.uid === user?.uid ? 'var(--radius-sm)' : '0'
                      }}
                    >
                      <div style={{ width: 32, fontSize: 16, textAlign: 'center' }}>
                        {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : <span style={{ color: 'var(--text-muted)', fontSize: 12, fontWeight: 700 }}>#{i + 1}</span>}
                      </div>
                      <div style={{ flex: 1, fontWeight: u.uid === user?.uid ? 700 : 500, fontSize: 14, color: 'var(--text-primary)' }}>
                        {u.name || 'Anonymous'}
                        {u.uid === user?.uid && <span style={{ fontSize: 10, color: '#fbbf24', marginLeft: 8, background: 'rgba(251,191,36,0.1)', padding: '2px 6px', borderRadius: 4 }}>You</span>}
                      </div>
                      <div style={{ fontFamily: 'JetBrains Mono', fontWeight: 700, color: 'var(--accent-demand)', fontSize: 13 }}>
                        {(u.energy_coins || 0).toLocaleString()} 🪙
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* My Activity */}
            {!isGuest && (nudgeHistory.length > 0 || myReports.length > 0 || transactions.length > 0) && (
              <div className="card">
                <div className="card-header">
                  <span className="card-title">📋 My Activity History</span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                  {/* Ledger Section */}
                  {transactions.length > 0 && (
                    <div>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', marginBottom: 12, letterSpacing: '0.5px' }}>Coin Ledger</div>
                      {transactions.slice(0, 3).map((tx) => (
                        <div key={tx.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 12 }}>
                          <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#fbbf24', marginTop: 6 }} />
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 13, color: 'var(--text-primary)' }}>{tx.reason} <span style={{ color: '#fbbf24', fontWeight: 700 }}>+{tx.amount}</span></div>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{timeAgo(tx.timestamp)}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Reports Section */}
                  {myReports.length > 0 && (
                    <div>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', marginBottom: 12, letterSpacing: '0.5px' }}>My Reports</div>
                      {myReports.slice(0, 3).map((r) => (
                        <div key={r.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 12 }}>
                          <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--status-low)', marginTop: 6 }} />
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 13, display: 'flex', justifyContent: 'space-between', color: 'var(--text-primary)' }}>
                              <span>{ISSUE_TYPES.find((t) => t.id === r.type)?.icon} {r.type}</span>
                              {r.status === 'operator_resolved' && (
                                <button className="btn btn-sm btn-primary" onClick={() => handleVerifyFix(r.id)} style={{ padding: '2px 8px', fontSize: 10 }}>Verify Fix (+5 🪙)</button>
                              )}
                              {r.status === 'verified_resolved' && <span style={{ color: 'var(--status-normal)', fontSize: 11, fontWeight: 700 }}>Verified</span>}
                            </div>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{timeAgo(r.timestamp)}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
