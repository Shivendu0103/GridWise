// src/App.jsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Component } from 'react';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import CitizenApp from './pages/CitizenApp';
import CoinWallet from './pages/CoinWallet';
import LoadShift from './pages/LoadShift';
import MicroGrid from './pages/MicroGrid';

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
          padding: 40, textAlign: 'center', color: '#94a3b8',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16
        }}>
          <span style={{ fontSize: 48 }}>⚠️</span>
          <h2 style={{ color: '#e2e8f0', margin: 0 }}>Something went wrong</h2>
          <p style={{ maxWidth: 420, lineHeight: 1.6 }}>
            {this.state.error?.message || 'An unexpected error occurred.'}
          </p>
          <button
            onClick={() => { this.setState({ hasError: false, error: null }); }}
            style={{
              padding: '8px 20px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)',
              background: 'rgba(255,255,255,0.05)', color: '#e2e8f0', cursor: 'pointer', fontSize: 14
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
  );
}

