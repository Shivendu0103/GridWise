// src/components/NudgeCard.jsx
// AI-generated nudge card with accept/dismiss, reward display
import { useState } from 'react';
import { awardCoins } from '../lib/firebase';

const NUDGES = [
  {
    id: 'n1',
    icon: '❄️',
    message: 'Set your AC to 24°C instead of 20°C for the next 3 hours.',
    reward: 50,
    saving: '~0.8 kWh',
    zone: 'DL-01',
    peakHour: '18:00–21:00',
  },
  {
    id: 'n2',
    icon: '🌀',
    message: 'Shift your washing machine cycle to after 11 PM tonight.',
    reward: 30,
    saving: '~1.2 kWh',
    zone: 'MH-01',
    peakHour: '19:00–22:00',
  },
  {
    id: 'n3',
    icon: '💡',
    message: 'Switch off non-essential lights in rooms you\'re not using.',
    reward: 15,
    saving: '~0.3 kWh',
    zone: 'UP-01',
    peakHour: '20:00–22:30',
  },
  {
    id: 'n4',
    icon: '🔌',
    message: 'Unplug chargers and standby devices for the next 2 hours.',
    reward: 20,
    saving: '~0.4 kWh',
    zone: 'KA-01',
    peakHour: '18:30–20:30',
  },
];

export default function NudgeCard({ userId, onCoinsEarned }) {
  const [nudgeIndex, setNudgeIndex] = useState(0);
  const [accepted, setAccepted] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [animating, setAnimating] = useState(false);

  const nudge = NUDGES[nudgeIndex % NUDGES.length];

  const handleAccept = async () => {
    setAnimating(true);
    if (userId) {
      await awardCoins(userId, nudge.reward, `Accepted nudge: ${nudge.message.slice(0, 40)}`);
    }
    setAccepted(true);
    onCoinsEarned?.(nudge.reward);
    setTimeout(() => {
      setAccepted(false);
      setAnimating(false);
      setNudgeIndex((i) => i + 1);
    }, 2200);
  };

  const handleDismiss = () => {
    setDismissed(true);
    setTimeout(() => {
      setDismissed(false);
      setNudgeIndex((i) => i + 1);
    }, 400);
  };

  if (dismissed) {
    return <div style={{ height: 120, opacity: 0, transition: 'opacity 0.3s' }} />;
  }

  if (accepted) {
    return (
      <div className="nudge-card" style={{ textAlign: 'center', padding: 32 }}>
        <div style={{ fontSize: 48, marginBottom: 10 }}>🎉</div>
        <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--accent-demand)' }}>
          +{nudge.reward} Energy Coins Earned!
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 6 }}>
          Thanks for helping balance the grid. You saved {nudge.saving}.
        </div>
      </div>
    );
  }

  return (
    <div className="nudge-card" style={{ opacity: animating ? 0 : 1, transition: 'opacity 0.3s' }}>
      <div className="nudge-header">
        <span className="nudge-icon">{nudge.icon}</span>
        <div>
          <div className="nudge-label">⚡ AI Nudge · Zone {nudge.zone}</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            Peak hours: {nudge.peakHour}
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

      <div className="nudge-actions">
        <button
          className="btn btn-accept"
          onClick={handleAccept}
          id="nudge-accept-btn"
        >
          ✓ Accept
        </button>
        <button
          className="btn btn-secondary"
          onClick={handleDismiss}
          id="nudge-dismiss-btn"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}
