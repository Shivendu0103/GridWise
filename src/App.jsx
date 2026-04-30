// src/App.jsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Component } from 'react';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import CitizenApp from './pages/CitizenApp';
import CoinWallet from './pages/CoinWallet';
import LoadShift from './pages/LoadShift';
import MicroGrid from './pages/MicroGrid';
import { ThemeProvider } from './components/ThemeContext';

// Error boundary so one broken component doesn't kill the whole app
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
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16
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

export default function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <div className="app-layout">
          <Sidebar />
          <div className="main-content">
            <ErrorBoundary>
              <Routes>
                <Route path="/"          element={<Dashboard />} />
                <Route path="/citizen"   element={<CitizenApp />} />
                <Route path="/wallet"    element={<CoinWallet />} />
                <Route path="/loadshift" element={<LoadShift />} />
                <Route path="/microgrid" element={<MicroGrid />} />
                <Route path="*"          element={<Navigate to="/" replace />} />
              </Routes>
            </ErrorBoundary>
          </div>
        </div>
      </BrowserRouter>
    </ThemeProvider>
  );
}

