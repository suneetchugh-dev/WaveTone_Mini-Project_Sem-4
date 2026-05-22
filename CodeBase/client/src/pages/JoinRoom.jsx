import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import './shared.css';
import { getRoomById } from '../services/api';

const RANDOM_ALIASES = ['Echo', 'Wave', 'Drift', 'Haze', 'Pulse', 'Nova', 'Storm', 'Blaze', 'Frost', 'Sonic'];

function JoinRoom() {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const [alias, setAlias] = useState('');
  const [room, setRoom] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    getRoomById(roomId)
      .then(data => { setRoom(data); setLoading(false); })
      .catch(err => { setError(err.message); setLoading(false); });
  }, [roomId]);

    useEffect(() => {
      document.title = room ? `Join ${room.topic} - WaveTone` : 'Join Room - WaveTone';
      document.body.setAttribute('data-route', 'join-room');
      return () => {
        document.body.removeAttribute('data-route');
      };
    }, [room]);

  const activeCount = room ? room.participants.filter(p => !p.leftAt).length : 0;
  const isFull = room && activeCount >= room.maxUsers;

  const handleJoin = () => {
    const trimmedAlias = alias.trim();
    const resolvedAlias = trimmedAlias || RANDOM_ALIASES[Math.floor(Math.random() * RANDOM_ALIASES.length)];
    
    // Prevent users from trying to claim Host status (server will override anyway, but let's validate client-side)
    if (trimmedAlias.toLowerCase() === 'host') {
      // Silently convert to random alias instead of showing error
      const randomAlias = RANDOM_ALIASES[Math.floor(Math.random() * RANDOM_ALIASES.length)];
      navigate(`/room/${roomId}`, { state: { alias: randomAlias, room } });
      return;
    }
    
    navigate(`/room/${roomId}`, { state: { alias: resolvedAlias, room } });
  };

  if (loading) {
    return (
      <section className="page-section">
        <h2 className="page-title">Join Room</h2>
        <p className="page-subtitle">Loading room info...</p>
        <div className="skeleton-card" style={{ marginBottom: '1.2rem' }}>
          <div className="skeleton skeleton-text wide" />
          <div className="skeleton skeleton-text" />
          <div className="skeleton skeleton-text short" />
          <div className="skeleton skeleton-text" style={{ marginTop: '1.5rem' }} />
          <div className="skeleton skeleton-title" style={{ marginTop: '1rem' }} />
        </div>
        <div className="skeleton" style={{ height: '48px', borderRadius: '10px', width: '100%' }} />
      </section>
    );
  }

  if (error || !room) {
    return (
      <section className="page-section">
        <h2 className="page-title">Join Room</h2>
        <div className="card">
          <p style={{ color: 'var(--warning)' }}>Room not found or unavailable.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="page-section">
      <h2 className="page-title">Join Room</h2>
      <p className="page-subtitle">You're about to enter an anonymous voice session.</p>

      <div className="card" style={{ marginBottom: '1.2rem' }}>
        <div className="info-row">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--speaking)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="7" width="18" height="13" rx="2"/><path d="M16 3v4M8 3v4"/></svg>
          <span>Topic: <strong style={{ color: 'var(--text-primary)' }}>{room.topic}</strong></span>
        </div>
        <div className="info-row">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--speaking)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a10 10 0 0 1 0 20"/><path d="M2 12h20"/><path d="M12 2a14.5 14.5 0 0 0 0 20"/></svg>
          <span>Category: <strong style={{ color: 'var(--text-primary)' }}>{room.category}</strong></span>
        </div>
        <div className="info-row">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--speaking)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
          <span>
            {activeCount}/{room.maxUsers} participants
            {isFull && <span style={{ color: 'var(--warning)', marginLeft: '0.4rem' }}>(Full)</span>}
          </span>
        </div>
        <div className="info-row">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--speaking)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
          <span>Moderation is active</span>
        </div>
        <hr className="divider" />
        <div className="form-group">
          <label className="form-label">Your Alias (optional)</label>
          <input
            className="form-input"
            type="text"
            placeholder="Leave blank for random alias"
            value={alias}
            onChange={(e) => setAlias(e.target.value)}
            maxLength={20}
          />
        </div>
      </div>

      <button
        className="home-btn home-btn-solid"
        style={{ width: '100%', justifyContent: 'center', opacity: isFull ? 0.5 : 1 }}
        onClick={handleJoin}
        disabled={isFull}
      >
        <svg className="join-room-mic-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/></svg>
        {isFull ? 'Room is Full' : 'Join Voice Room'}
      </button>
    </section>
  );
}

export default JoinRoom;
