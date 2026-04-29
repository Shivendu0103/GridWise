// src/components/NudgeCard.jsx
// AI nudge card — accept/dismiss with countdown timer, coin animation, swipe support
import { useState, useEffect, useRef } from 'react';
import { awardCoins } from '../lib/firebase';

const NUDGES = [
  {
    id: 'n1', icon: '❄️',
    appliance: 'Air Conditioner',
    message: 'Set your AC to 24°C instead of 20°C for the next 3 hours.',
    reward: 50, saving: '~0.8 kWh', zone: 'DL-01', peakHour: '18:00–21:00',
    validMinutes: 30,
  },
  {
    id: 'n2', icon: '🌀',
    appliance: 'Washing Machine',
    message: 'Shift your washing machine cycle to after 11 PM tonight.',
    reward: 30, saving: '~1.2 kWh', zone: 'MH-01', peakHour: '19:00–22:00',
    validMinutes: 45,
  },
  {
    id: 'n3', icon: '💡',
    appliance: 'Lighting',
    message: 'Switch off non-essential lights in rooms you\'re not using.',
    reward: 15, saving: '~0.3 kWh', zone: 'UP-01', peakHour: '20:00–22:30',
    validMinutes: 20,
  },
  {
    id: 'n4', icon: '🔌',
    appliance: 'Standby Devices',
    message: 'Unplug chargers and standby devices for the next 2 hours.',
    reward: 20, saving: '~0.4 kWh', zone: 'KA-01', peakHour: '18:30–20:30',
    validMinutes: 25,
  },
];

export default function NudgeCard({ userId, onCoinsEarned }) {
  const [nudgeIndex, setNudgeIndex] = useState(0);
  const [accepted, setAccepted] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [timeLeft, setTimeLeft] = useState(null);
  const [dragX, setDragX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [coins, setCoins] = useState([]);
  const startX = useRef(null);
  const cardRef = useRef(null);

  const nudge = NUDGES[nudgeIndex % NUDGES.length];

  // Countdown timer
  useEffect(() => {
    setTimeLeft(nudge.validMinutes * 60);
    const iv = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) { clearInterval(iv); return 0; }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(iv);
  }, [nudgeIndex, nudge.validMinutes]);

  const formatTime = (secs) => {
    if (secs === null) return '--:--';
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const spawnCoins = (amount) => {
    const newCoins = Array.from({ length: Math.min(amount, 8) }, (_, i) => ({
      id: Date.now() + i,
      x: Math.random() * 200 - 100,
      y: -(60 + Math.random() * 80),
      rotate: Math.random() * 360,
    }));
    setCoins(newCoins);
    setTimeout(() => setCoins([]), 1500);
  };

  const handleAccept = async () => {
    spawnCoins(nudge.reward);
    if (userId) {
      await awardCoins(userId, nudge.reward, `Accepted nudge: ${nudge.message.slice(0, 40)}`);
    }
    setAccepted(true);
    onCoinsEarned?.(nudge.reward);
    setTimeout(() => {
      setAccepted(false);
      setDragX(0);
      setNudgeIndex((i) => i + 1);
    }, 2400);
  };

  const handleDismiss = () => {
    setDismissed(true);
    setTimeout(() => {
      setDismissed(false);
      setDragX(0);
      setNudgeIndex((i) => i + 1);
    }, 350);
  };

  // Touch/drag swipe
  const onPointerDown = (e) => {
    startX.current = e.clientX;
    setIsDragging(true);
  };
  const onPointerMove = (e) => {
    if (!isDragging || startX.current === null) return;
    setDragX(e.clientX - startX.current);
  };
  const onPointerUp = () => {
    setIsDragging(false);
    if (dragX > 80) { handleAccept(); }
    else if (dragX < -80) { handleDismiss(); }
    else { setDragX(0); }
    startX.current = null;
  };

  if (dismissed) {
    return <div style={{ height: 120, opacity: 0, transition: 'opacity 0.3s' }} />;
  }

  if (accepted) {
    return (
      <div className="nudge-card" style={{ textAlign: 'center', padding: 32, position: 'relative', overflow: 'hidden' }}>
        {/* Coin burst */}
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {coins.map((c) => (
            <div
              key={c.id}
              style={{
                position: 'absolute',
                width: 18, height: 18,
                background: 'radial-gradient(circle, #fcd34d, #f59e0b)',
                borderRadius: '50%',
                animation: `coinBurst 1.2s ease forwards`,
                transform: `translate(${c.x}px, ${c.y}px) rotate(${c.rotate}deg)`,
                boxShadow: '0 0 6px rgba(245,158,11,0.6)',
              }}
            />
          ))}
        </div>
        <style>{`
          @keyframes coinBurst {
            0%   { opacity:1; transform: translate(0,0) scale(0.5); }
            60%  { opacity:1; }
            100% { opacity:0; transform: translate(var(--tx,40px),var(--ty,-60px)) scale(1.2); }
          }
        `}</style>
        <div style={{ fontSize: 56, marginBottom: 10 }}>🎉</div>
        <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--accent-demand)', fontFamily: 'JetBrains Mono' }}>
          +{nudge.reward} 🪙
        </div>
        <div style={{ fontSize: 14, color: 'var(--text-secondary)', marginTop: 8 }}>
          Energy Coins earned! You saved {nudge.saving}.
        </div>
      </div>
    );
  }

  const swipeOpacity = 1 - Math.abs(dragX) / 200;
  const swipeHint = dragX > 30 ? '✓ Accept' : dragX < -30 ? '✕ Dismiss' : null;

  return (
    <div
      ref={cardRef}
      className="nudge-card"
      style={{
        opacity: swipeOpacity,
        transform: `translateX(${dragX}px) rotate(${dragX * 0.03}deg)`,
        transition: isDragging ? 'none' : 'transform 0.3s ease, opacity 0.3s ease',
        cursor: isDragging ? 'grabbing' : 'grab',
        userSelect: 'none',
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerLeave={onPointerUp}
    >
      {/* Swipe hint overlay */}
      {swipeHint && (
        <div style={{
          position: 'absolute', inset: 0, borderRadius: 'inherit',
          background: dragX > 30 ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 22, fontWeight: 800,
          color: dragX > 30 ? 'var(--status-normal)' : 'var(--status-critical)',
          pointerEvents: 'none',
          zIndex: 2,
        }}>
          {swipeHint}
        </div>
      )}

      <div className="nudge-header">
        <span className="nudge-icon">{nudge.icon}</span>
        <div style={{ flex: 1 }}>
          <div className="nudge-label">⚡ AI Nudge · Zone {nudge.zone}</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            {nudge.appliance} · Peak hours: {nudge.peakHour}
          </div>
        </div>
        {/* Countdown */}
        <div style={{
          textAlign: 'right', flexShrink: 0,
          background: timeLeft !== null && timeLeft < 300 ? 'rgba(239,68,68,0.1)' : 'rgba(255,255,255,0.04)',
          border: `1px solid ${timeLeft !== null && timeLeft < 300 ? 'rgba(239,68,68,0.3)' : 'var(--border-subtle)'}`,
          borderRadius: 6, padding: '4px 8px',
        }}>
          <div style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Expires in</div>
          <div style={{
            fontFamily: 'JetBrains Mono', fontWeight: 700, fontSize: 15,
            color: timeLeft !== null && timeLeft < 300 ? 'var(--status-critical)' : 'var(--accent-demand)',
          }}>
            {formatTime(timeLeft)}
          </div>
        </div>
      </div>

      <p className="nudge-message">{nudge.message}</p>

      <div className="nudge-reward">
        🪙 Earn {nudge.reward} Energy Coins
        <span style={{ marginLeft: 8, fontSize: 11, color: 'var(--text-muted)', fontWeight: 400 }}>
          · saves {nudge.saving}
        </span>
      </div>

      {/* Swipe hint text */}
      <div style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center', marginBottom: 12 }}>
        ← Swipe to dismiss &nbsp;&nbsp; Swipe to accept →
      </div>

      <div className="nudge-actions">
        <button className="btn btn-accept" onClick={handleAccept} id="nudge-accept-btn">
          ✓ Accept
        </button>
        <button className="btn btn-secondary" onClick={handleDismiss} id="nudge-dismiss-btn">
          Dismiss
        </button>
      </div>
    </div>
  );
}
