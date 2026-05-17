// src/App.jsx
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Component } from 'react';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import CitizenApp from './pages/CitizenApp';
import LoadShift from './pages/LoadShift';
import MicroGrid from './pages/MicroGrid';
import Landing from './pages/Landing';
import Auth from './pages/Auth';
import CitizenDashboard from './pages/CitizenDashboard';
import { ThemeProvider } from './components/ThemeContext';
import { useAuth } from './lib/AuthContext';

// ─────────────────────────────────────────────────────────
//  Error boundary
// ─────────────────────────────────────────────────────────
class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, info) {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          padding: 40, textAlign: 'center', color: 'var(--text-secondary)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16,
          minHeight: '100vh', justifyContent: 'center', background: '#0a0e1a',
        }}>
          <span style={{ fontSize: 48 }}>⚠️</span>
          <h2 style={{ color: 'var(--text-primary)', margin: 0 }}>Something went wrong</h2>
          <p style={{ maxWidth: 420, lineHeight: 1.6 }}>
            {this.state.error?.message || 'An unexpected error occurred.'}
          </p>
          <button
            onClick={() => { this.setState({ hasError: false, error: null }); }}
            style={{
              padding: '8px 20px', borderRadius: 8, border: '1px solid var(--border-subtle)',
              background: 'var(--bg-card)', color: 'var(--text-primary)', cursor: 'pointer', fontSize: 14
            }}
          >
            Try Again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// ─────────────────────────────────────────────────────────
//  Route Guards
// ─────────────────────────────────────────────────────────

/** While auth is still resolving, show a neutral loading state */
function AuthLoading() {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      minHeight: '100vh', background: '#0a0e1a', flexDirection: 'column', gap: 16,
    }}>
      <div style={{
        width: 44, height: 44, borderRadius: '50%',
        border: '3px solid rgba(0,229,255,0.2)',
        borderTopColor: '#00e5ff',
        animation: 'spin 0.8s linear infinite',
      }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <span style={{ color: '#475569', fontSize: 13 }}>Loading GridWise…</span>
    </div>
  );
}

/** Protected route — only accessible to operators */
function OperatorRoute({ children }) {
  const { user, userProfile, loading } = useAuth();
  if (loading) return <AuthLoading />;
  if (!user) return <Navigate to="/" replace />;
  // Anonymous users and citizens are not operators
  if (!userProfile || userProfile.role !== 'operator') return <Navigate to="/" replace />;
  return children;
}

/** Protected route — only accessible to citizens (including anonymous guests) */
function CitizenRoute({ children }) {
  const { user, userProfile, loading } = useAuth();
  if (loading) return <AuthLoading />;
  if (!user) return <Navigate to="/" replace />;
  if (!userProfile) return <Navigate to="/" replace />;
  if (userProfile.role !== 'citizen') return <Navigate to="/dashboard" replace />;
  return children;
}

// ─────────────────────────────────────────────────────────
//  Layout shells
// ─────────────────────────────────────────────────────────

/** Operator layout — with sidebar */
function OperatorLayout({ children }) {
  return (
    <div className="app-layout">
      <Sidebar />
      <div className="main-content">
        <ErrorBoundary>{children}</ErrorBoundary>
      </div>
    </div>
  );
}

/** Full-screen layout — no sidebar (landing, auth, citizen dashboard) */
function FullscreenLayout({ children }) {
  return (
    <div style={{ width: '100%', minHeight: '100vh' }}>
      <ErrorBoundary>{children}</ErrorBoundary>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
//  App Router
// ─────────────────────────────────────────────────────────
export default function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <Routes>
          {/* ── Public ── */}
          <Route
            path="/"
            element={
              <FullscreenLayout>
                <Landing />
              </FullscreenLayout>
            }
          />
          <Route
            path="/login"
            element={
              <FullscreenLayout>
                <Auth />
              </FullscreenLayout>
            }
          />

          {/* ── Citizen ── */}
          <Route
            path="/citizen-dashboard"
            element={
              <CitizenRoute>
                <FullscreenLayout>
                  <CitizenDashboard />
                </FullscreenLayout>
              </CitizenRoute>
            }
          />

          {/* ── Operator ── */}
          <Route
            path="/dashboard"
            element={
              <OperatorRoute>
                <OperatorLayout>
                  <Dashboard />
                </OperatorLayout>
              </OperatorRoute>
            }
          />
          <Route
            path="/citizen"
            element={
              <OperatorRoute>
                <OperatorLayout>
                  <CitizenApp />
                </OperatorLayout>
              </OperatorRoute>
            }
          />
          <Route
            path="/loadshift"
            element={
              <OperatorRoute>
                <OperatorLayout>
                  <LoadShift />
                </OperatorLayout>
              </OperatorRoute>
            }
          />
          <Route
            path="/microgrid"
            element={
              <OperatorRoute>
                <OperatorLayout>
                  <MicroGrid />
                </OperatorLayout>
              </OperatorRoute>
            }
          />

          {/* ── Fallback ── */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  );
}
