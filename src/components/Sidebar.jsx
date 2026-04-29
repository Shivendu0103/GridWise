import { NavLink, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { subscribeToAlerts } from '../lib/firebase';

const NAV_ITEMS = [
  {
    section: 'Supply Side',
    items: [
      { to: '/',          icon: '⚡', label: 'Grid Dashboard',   chip: 'supply' },
      { to: '/loadshift', icon: '📅', label: 'Load Shifting',    chip: 'supply' },
    ]
  },
  {
    section: 'Demand Side',
    items: [
      { to: '/wallet',  icon: '🪙', label: 'Energy Coins',    chip: 'demand' },
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
  const [alertCount, setAlertCount] = useState(0);

  useEffect(() => {
    const unsub = subscribeToAlerts((alerts) => setAlertCount(alerts.length));
    return unsub;
  }, []);

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

      {/* Nav */}
      <nav className="sidebar-nav">
        {NAV_ITEMS.map(({ section, items }) => (
          <div key={section}>
            <div className="sidebar-section-label">{section}</div>
            {items.map(({ to, icon, label, chip }) => {
              const isActive = to === '/'
                ? location.pathname === '/'
                : location.pathname.startsWith(to);
              const showBadge = to === '/' && alertCount > 0;

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
        <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 6 }}>
          v1.0.0
        </div>
      </div>
    </aside>
  );
}
