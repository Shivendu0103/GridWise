// src/pages/Auth.jsx
// Unified Sign-in / Sign-up page — role-aware (citizen | operator)
import { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import {
  signInWithEmail, signUpWithEmail, signInAnon,
  writeUserProfile,
} from '../lib/firebase';
import { useAuth } from '../lib/AuthContext';
import zonesData from '../../data/zones.json';

const ZONES = zonesData.zones;

function getHour() {
  const h = new Date().getHours();
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  if (h < 20) return 'evening';
  return 'night';
}

export default function Auth() {
  const navigate = useNavigate();
  const location = useLocation();
  const { userProfile, loading, refreshProfile } = useAuth();

  // role comes from navigation state OR ?role= query param
  const params = new URLSearchParams(location.search);
  const role = location.state?.role || params.get('role') || 'citizen';
  const isCitizen = role === 'citizen';

  const accent = isCitizen ? '#fbbf24' : '#00e5ff';
  const accentRgb = isCitizen ? '251,191,36' : '0,229,255';
  const roleIcon = isCitizen ? '🏠' : '🛰️';
  const roleLabel = isCitizen ? 'Citizen' : 'Grid Operator';

  const [mode, setMode] = useState('signin'); // 'signin' | 'signup'
  const [form, setForm] = useState({ name: '', email: '', password: '', zone_id: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  // Redirect if already logged in
  useEffect(() => {
    if (!loading && userProfile) {
      if (userProfile.role === 'operator') navigate('/dashboard', { replace: true });
      else if (userProfile.role === 'citizen') navigate('/citizen-dashboard', { replace: true });
    }
  }, [userProfile, loading, navigate]);

  const setField = (key, val) => setForm((f) => ({ ...f, [key]: val }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);

    try {
      if (mode === 'signup') {
        if (!form.name.trim()) throw new Error('Name is required.');
        if (isCitizen && !form.zone_id) throw new Error('Please select your zone.');
        if (form.password.length < 6) throw new Error('Password must be at least 6 characters.');

        const { user } = await signUpWithEmail(form.email, form.password);
        await writeUserProfile(user.uid, {
          name: form.name.trim(),
          email: form.email,
          role,
          ...(isCitizen ? { zone_id: form.zone_id, energy_coins: 0 } : {}),
        });
        await refreshProfile();
      } else {
        await signInWithEmail(form.email, form.password);
        await refreshProfile();
      }
      // Redirect handled by useEffect watching userProfile
    } catch (err) {
      const msg = friendlyError(err.code || err.message);
      setError(msg);
    } finally {
      setBusy(false);
    }
  };

  const handleGuestLogin = async () => {
    setBusy(true);
    setError('');
    try {
      await signInAnon();
      navigate('/citizen-dashboard', { replace: true });
    } catch (err) {
      setError('Guest login failed. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-page">
      {/* Background glow matching role accent */}
      <div
        className="auth-bg-glow"
        style={{
          background: accent,
          top: '-200px', left: '50%', transform: 'translateX(-50%)',
        }}
      />

      <div className="auth-card">
        {/* Logo */}
        <div className="auth-logo">
          <div
            className="auth-logo-icon"
            style={{ background: `linear-gradient(135deg, rgba(${accentRgb},0.3), rgba(${accentRgb},0.1))` }}
          >
            ⚡
          </div>
          <span className="auth-logo-text">GridWise</span>
        </div>

        {/* Title */}
        <div
          style={{ fontSize: 36, marginBottom: 4 }}
          role="img"
          aria-label={roleLabel}
        >
          {roleIcon}
        </div>
        <h1 className="auth-title">
          {mode === 'signin' ? 'Welcome back' : `Join as ${roleLabel}`}
        </h1>
        <p className="auth-subtitle">
          {isCitizen
            ? 'Track your energy, earn coins, help balance the grid'
            : 'Monitor, predict and manage India\'s power grid'}
        </p>

        {/* Sign-in / Sign-up toggle */}
        <div className="auth-toggle">
          {[
            { id: 'signin', label: 'Sign In' },
            { id: 'signup', label: 'Create Account' },
          ].map(({ id, label }) => (
            <button
              key={id}
              className={`auth-toggle-btn ${mode === id ? 'active' : ''}`}
              onClick={() => { setMode(id); setError(''); }}
              id={`auth-toggle-${id}`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Error */}
        {error && <div className="auth-error">⚠️ {error}</div>}

        <form onSubmit={handleSubmit} id="auth-form">
          {/* Name — sign-up only */}
          {mode === 'signup' && (
            <div className="form-group">
              <label className="form-label">Full Name</label>
              <input
                className="form-control"
                type="text"
                placeholder="Rahul Sharma"
                value={form.name}
                onChange={(e) => setField('name', e.target.value)}
                required
                id="auth-name"
                autoComplete="name"
              />
            </div>
          )}

          {/* Email */}
          <div className="form-group">
            <label className="form-label">Email</label>
            <input
              className="form-control"
              type="email"
              placeholder="you@example.com"
              value={form.email}
              onChange={(e) => setField('email', e.target.value)}
              required
              id="auth-email"
              autoComplete="email"
            />
          </div>

          {/* Password */}
          <div className="form-group">
            <label className="form-label">Password</label>
            <input
              className="form-control"
              type="password"
              placeholder="••••••••"
              value={form.password}
              onChange={(e) => setField('password', e.target.value)}
              required
              id="auth-password"
              autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
            />
          </div>

          {/* Zone — citizen sign-up only */}
          {mode === 'signup' && isCitizen && (
            <div className="form-group">
              <label className="form-label">Your Grid Zone</label>
              <select
                className="form-control"
                value={form.zone_id}
                onChange={(e) => setField('zone_id', e.target.value)}
                required
                id="auth-zone"
              >
                <option value="">Select your zone…</option>
                {ZONES.map((z) => (
                  <option key={z.zoneId} value={z.zoneId}>
                    {z.zoneId} — {z.name}, {z.state}
                  </option>
                ))}
              </select>
            </div>
          )}

          <button
            className="auth-submit-btn"
            type="submit"
            disabled={busy}
            id="auth-submit"
            style={{
              background: `linear-gradient(135deg, rgba(${accentRgb},0.9), rgba(${accentRgb},0.6))`,
              color: '#0a0e1a',
            }}
          >
            {busy
              ? '⏳ Please wait…'
              : mode === 'signin'
              ? `Sign In as ${roleLabel}`
              : `Create ${roleLabel} Account`}
          </button>
        </form>

        {/* Guest access — citizens only */}
        {isCitizen && (
          <>
            <div className="auth-divider">or</div>
            <button
              className="auth-guest-btn"
              onClick={handleGuestLogin}
              disabled={busy}
              id="auth-guest-btn"
            >
              👤 Try as Guest — no account needed
            </button>
          </>
        )}

        {/* Back to landing */}
        <Link to="/" className="auth-back-link" id="auth-back-link">
          ← Back to home
        </Link>
      </div>
    </div>
  );
}

function friendlyError(code) {
  const map = {
    'auth/user-not-found': 'No account found with that email.',
    'auth/wrong-password': 'Incorrect password.',
    'auth/invalid-credential': 'Invalid email or password.',
    'auth/email-already-in-use': 'An account with this email already exists.',
    'auth/weak-password': 'Password must be at least 6 characters.',
    'auth/invalid-email': 'Please enter a valid email address.',
    'auth/too-many-requests': 'Too many attempts. Please wait a moment.',
    'auth/network-request-failed': 'Network error. Check your connection.',
  };
  return map[code] || code || 'Something went wrong. Please try again.';
}
