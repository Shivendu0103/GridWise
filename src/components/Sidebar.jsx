// src/components/Sidebar.jsx
import { NavLink, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { subscribeToAlerts } from '../lib/firebase';
import { useTheme } from './ThemeContext';
import { useAuth } from '../lib/AuthContext';
import { useNavigate } from 'react-router-dom';

const NAV_ITEMS = [
  {
    section: 'Supply Side',
    items: [
      { to: '/dashboard', icon: '⚡', label: 'Grid Dashboard',   chip: 'supply' },
      { to: '/loadshift', icon: '📅', label: 'Load Shifting',    chip: 'supply' },
    ]
  },
  {
    section: 'Data Collection',
    items: [
      { to: '/citizen',   icon: '📍', label: 'Citizen Reports', chip: 'data' },
      { to: '/microgrid', icon: '🔋', label: 'Micro-Grid',      chip: 'data' },
    ]
  },
];

export default function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const [alertCount, setAlertCount] = useState(0);
  const { theme, toggleTheme } = useTheme();
  const { userProfile, logout } = useAuth();

  useEffect(() => {
    const unsub = subscribeToAlerts((alerts) => setAlertCount(alerts.length));
    return unsub;
  }, []);

  const handleLogout = async () => {
    await logout();
    navigate('/', { replace: true });
  };

  return (
    <aside className="sidebar">
      {/* Logo */}
      <div className="sidebar-logo">
        <div className="logo-mark">
          <div className="logo-icon">⚡</div>
          <div>
            <div className="logo-text">GridWise</div>
          </div>
        </div>
        <div className="logo-tag">India Grid Intelligence · SDG 7</div>
      </div>

      {/* Operator badge */}
      {userProfile && (
        <div style={{
          padding: '12px 20px',
          borderBottom: '1px solid var(--border-subtle)',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}>
          <div style={{
            width: 32, height: 32, borderRadius: '50%',
            background: 'linear-gradient(135deg, rgba(0,229,255,0.2), rgba(99,102,241,0.15))',
            border: '1px solid rgba(0,229,255,0.3)',
            display: 'grid', placeItems: 'center', fontSize: 14, flexShrink: 0,
          }}>
            👤
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontSize: 13, fontWeight: 700,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              color: 'var(--text-primary)',
            }}>
              {userProfile.name || 'Operator'}
            </div>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              fontSize: 10, fontWeight: 700, color: '#00e5ff',
              background: 'rgba(0,229,255,0.1)', border: '1px solid rgba(0,229,255,0.2)',
              borderRadius: 999, padding: '1px 7px', marginTop: 2,
            }}>
              <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#10b981', display: 'inline-block' }} />
              Operator
            </div>
          </div>
        </div>
      )}

      {/* Nav */}
      <nav className="sidebar-nav">
        {NAV_ITEMS.map(({ section, items }) => (
          <div key={section}>
            <div className="sidebar-section-label">{section}</div>
            {items.map(({ to, icon, label, chip }) => {
              const isActive = location.pathname === to || location.pathname.startsWith(to + '/');
              const showBadge = to === '/dashboard' && alertCount > 0;

              return (
                <NavLink
                  key={to}
                  to={to}
                  className={`nav-item ${isActive ? 'active' : ''}`}
                >
                  <span className="nav-icon">{icon}</span>
                  <span>{label}</span>
                  <span className={`chip ${chip}`} style={{ marginLeft: 'auto', marginRight: showBadge ? 6 : 0 }}>
                    {chip}
                  </span>
                  {showBadge && (
                    <span className="nav-badge">{alertCount}</span>
                  )}
                </NavLink>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="sidebar-footer">
        <div className="live-indicator">
          <div className="live-dot" />
          <span>Live Feed Active</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
          <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
            v1.0.0
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              onClick={toggleTheme}
              className="btn btn-sm btn-secondary theme-toggle-btn"
              title="Toggle theme"
              style={{ borderRadius: '50%', padding: 6, width: 28, height: 28, display: 'grid', placeItems: 'center' }}
            >
              {theme === 'light' ? '🌙' : '☀️'}
            </button>
            <button
              onClick={handleLogout}
              className="btn btn-sm btn-secondary"
              title="Sign out"
              style={{ borderRadius: '50%', padding: 6, width: 28, height: 28, display: 'grid', placeItems: 'center' }}
              id="sidebar-logout-btn"
            >
              🚪
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}
