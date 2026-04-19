// src/App.jsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import CitizenApp from './pages/CitizenApp';
import CoinWallet from './pages/CoinWallet';
import LoadShift from './pages/LoadShift';
import MicroGrid from './pages/MicroGrid';

export default function App() {
  return (
    <BrowserRouter>
      <div className="app-layout">
        <Sidebar />
        <div className="main-content">
          <Routes>
            <Route path="/"          element={<Dashboard />} />
            <Route path="/citizen"   element={<CitizenApp />} />
            <Route path="/wallet"    element={<CoinWallet />} />
            <Route path="/loadshift" element={<LoadShift />} />
            <Route path="/microgrid" element={<MicroGrid />} />
            <Route path="*"          element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </div>
    </BrowserRouter>
  );
}
