// src/pages/Landing.jsx
// Hero landing page for GridWise — dark-themed with animated background
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';

const FEATURES = [
  {
    icon: '🗺️',
    label: 'Live Intelligence',
    title: 'Real-Time Heatmap Dashboard',
    desc: 'Colour-coded zone heatmap across 20 Indian grid regions. Operators see overloads the instant sensors detect them — no delays, no blind spots.',
  },
  {
    icon: '🪙',
    label: 'Gamification',
    title: 'Energy Coins & Nudges',
    desc: 'Citizens receive AI-generated nudges to shift load during peak hours. Accept a nudge, earn Energy Coins. Appear on your zone leaderboard.',
  },
  {
    icon: '🔋',
    label: 'Optimisation',
    title: 'Microgrid Optimizer',
    desc: 'Intelligent dispatch of solar + battery storage across microgrids. The system autonomously balances deferrable vs critical loads in real time.',
  },
];

export default function Landing() {
  const navigate = useNavigate();
  const { userProfile, loading } = useAuth();

  // Auto-redirect logged-in users
  useEffect(() => {
    if (!loading && userProfile) {
      if (userProfile.role === 'operator') navigate('/dashboard', { replace: true });
      else if (userProfile.role === 'citizen') navigate('/citizen-dashboard', { replace: true });
    }
  }, [userProfile, loading, navigate]);

  const goLogin = (role) => navigate('/login', { state: { role } });

  return (
    <div className="landing-page">
      {/* Animated background */}
      <div className="landing-particles">
        <div className="lp-blob" />
        <div className="lp-blob" />
        <div className="lp-blob" />
        <div className="lp-blob" />
      </div>
      <div className="landing-grid-overlay" />

      {/* Fixed Navbar */}
      <nav className="landing-navbar">
        <div className="landing-logo">
          <div className="landing-logo-icon">⚡</div>
          <span className="landing-logo-text">GridWise</span>
        </div>
        <div className="landing-nav-btns">
          <button className="btn-citizen" onClick={() => goLogin('citizen')} id="navbar-citizen-login">
            🏠 Citizen Login
          </button>
          <button className="btn-operator" onClick={() => goLogin('operator')} id="navbar-operator-login">
            ⚡ Operator Login
          </button>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="landing-hero">
        <div className="landing-badge">
          ⚡ SDG 7 — Affordable &amp; Clean Energy · India Grid Intelligence
        </div>
        <h1 className="landing-headline">
          India's <span className="hl-cyan">Intelligent</span><br />
          Grid Management<br />
          <span className="hl-amber">Platform</span>
        </h1>
        <p className="landing-subline">
          Real-time load monitoring, AI-powered demand nudges, and citizen crowdsourcing —
          all working together to keep India's power grid stable and sustainable.
        </p>
      </section>

      {/* CTA Cards */}
      <div className="landing-cta-grid">
        {/* Citizen Card */}
        <div
          className="cta-card cta-card-citizen"
          onClick={() => goLogin('citizen')}
          id="cta-citizen-card"
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && goLogin('citizen')}
        >
          <span className="cta-card-icon">🏠</span>
          <div className="cta-card-role">For Citizens</div>
          <div className="cta-card-title">Be Part of the Solution</div>
          <p className="cta-card-desc">
            Report outages, earn Energy Coins, help balance your grid.
            Accept AI nudges to shift load during peak hours and climb your zone leaderboard.
          </p>
          <span className="cta-card-action">Get Started →</span>
        </div>

        {/* Operator Card */}
        <div
          className="cta-card cta-card-operator"
          onClick={() => goLogin('operator')}
          id="cta-operator-card"
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && goLogin('operator')}
        >
          <span className="cta-card-icon">🛰️</span>
          <div className="cta-card-role">For Grid Operators</div>
          <div className="cta-card-title">Command & Control</div>
          <p className="cta-card-desc">
            Monitor live grid load across all 20 zones, manage overload alerts,
            and shift demand intelligently using ML predictions with RMSE 5.44%.
          </p>
          <span className="cta-card-action">Operator Console →</span>
        </div>
      </div>

      {/* Feature Highlights */}
      <section className="landing-features">
        <h2 className="landing-features-title">Everything your grid needs</h2>
        <div className="feature-grid">
          {FEATURES.map((f) => (
            <div className="feature-card" key={f.title}>
              <div className="feature-icon">{f.icon}</div>
              <div className="feature-label">{f.label}</div>
              <div className="feature-title">{f.title}</div>
              <p className="feature-desc">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
