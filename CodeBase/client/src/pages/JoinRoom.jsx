import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import AmbientVideoBackground from '../components/AmbientVideoBackground';
import './shared.css';
import { getRoomById } from '../services/api';
import { motion } from 'framer-motion';

const staggerContainerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
    }
  }
};

const staggerItemVariants = {
  hidden: { opacity: 0 },
  show: { 
    opacity: 1, 
    transition: { 
      duration: 0.6, 
      ease: 'easeOut' 
    } 
  }
};

const RANDOM_ALIASES = ['Echo', 'Wave', 'Drift', 'Haze', 'Pulse', 'Nova', 'Storm', 'Blaze', 'Frost', 'Sonic'];

function JoinRoom() {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const [alias, setAlias] = useState('');
  const [room, setRoom] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isBubbling, setIsBubbling] = useState(false);
  const [activeRoomId, setActiveRoomId] = useState(null);

  useEffect(() => {
    getRoomById(roomId)
      .then(data => { setRoom(data); setLoading(false); })
      .catch(err => { setError(err.message); setLoading(false); });
  }, [roomId]);

  useEffect(() => {
    setActiveRoomId(localStorage.getItem('wavetone-active-room'));
    const handleStorage = () => {
      setActiveRoomId(localStorage.getItem('wavetone-active-room'));
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  useEffect(() => {
    document.title = room ? `Join ${room.topic} - WaveTone` : 'Join Room - WaveTone';
    document.body.setAttribute('data-route', 'join-room');
    return () => {
      document.body.removeAttribute('data-route');
    };
  }, [room]);

  const activeCount = room ? room.participants.filter(p => !p.leftAt).length : 0;
  const isFull = room && activeCount >= room.maxUsers;
  const hasActiveRoom = activeRoomId && activeRoomId !== roomId;

  const handleForceDisconnect = () => {
    if (activeRoomId) {
      localStorage.setItem('wavetone-leave-room-signal', activeRoomId);
      localStorage.removeItem('wavetone-active-room');
      setActiveRoomId(null);
    }
  };

  const handleJoin = () => {
    setIsBubbling(true);
    
    // Reset bubble animation after it completes
    setTimeout(() => setIsBubbling(false), 2400);
    
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
      <>
        <AmbientVideoBackground variant="subtle" />
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
      </>
    );
  }

  if (error || !room) {
    return (
      <>
        <AmbientVideoBackground variant="subtle" />
        <section className="page-section" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
          <div className="card" style={{ maxWidth: '420px', width: '100%', textAlign: 'center', padding: '2rem', display: 'flex', flexDirection: 'column', alignItems: 'center', border: '1.5px solid rgba(248,113,113,0.3)', background: 'rgba(248,113,113,0.02)' }}>
            <div style={{ background: 'rgba(248,113,113,0.1)', padding: '1rem', borderRadius: '50%', marginBottom: '1.2rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--warning)" strokeWidth="2.0" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                <line x1="12" y1="9" x2="12" y2="13"/>
                <line x1="12" y1="17" x2="12.01" y2="17"/>
              </svg>
            </div>
            <h3 style={{ margin: '0 0 0.5rem 0', color: 'var(--text-primary)', fontWeight: 800, fontSize: '1.25rem' }}>Room Unavailable</h3>
            <p style={{ margin: '0 0 1.5rem 0', color: 'var(--text-secondary)', fontSize: '0.85rem', lineHeight: 1.5 }}>
              The room you are trying to join does not exist, has already been closed, or the link has expired.
            </p>
            <button 
              onClick={() => navigate('/browse')} 
              className="home-btn home-btn-solid"
              style={{ width: '100%', justifyContent: 'center' }}
            >
              Browse Active Rooms
            </button>
          </div>
        </section>
      </>
    );
  }

  return (
    <>
      <AmbientVideoBackground variant="subtle" />
      <motion.section 
        className="page-section"
        variants={staggerContainerVariants}
        initial="hidden"
        animate="show"
      >
        <motion.div variants={staggerItemVariants}>
          <h2 className="page-title">Join Room</h2>
          <p className="page-subtitle">You're about to enter an anonymous voice session.</p>
        </motion.div>

      <motion.div className="card join-room-card participants-card-with-lamp" style={{ marginBottom: '1.2rem' }} variants={staggerItemVariants}>
        {/* Lamp visual effect wrapper */}
        <div className="voice-room-lamp-wrapper">
          <div className="voice-room-lamp-beam-left"></div>
          <div className="voice-room-lamp-beam-right"></div>
          <div className="voice-room-lamp-blur-mid"></div>
          <div className="voice-room-lamp-line"></div>
        </div>

        <div className="card-content-relative">
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
            <label htmlFor="join-alias" className="form-label">Your Alias (optional)</label>
            <input
              id="join-alias"
              name="alias"
              className="form-input"
              type="text"
              placeholder="Leave blank for random alias"
              value={alias}
              onChange={(e) => setAlias(e.target.value)}
              maxLength={20}
            />
          </div>
        </div>
      </motion.div>

      {hasActiveRoom && (
        <motion.div className="card active-room-warning-card" style={{ marginBottom: '1.2rem', border: '1.5px solid var(--warning)', background: 'rgba(248,113,113,0.05)' }} variants={staggerItemVariants}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.8rem' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--warning)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="warning-icon">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
              <line x1="12" y1="9" x2="12" y2="13"/>
              <line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
            <h4 style={{ margin: 0, color: 'var(--text-primary)', fontWeight: 700, fontSize: '0.95rem' }}>
              Already in a Voice Room
            </h4>
          </div>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '1rem', lineHeight: 1.4 }}>
            You are currently active in another voice room. You must leave that room before joining this one.
          </p>
          <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
            <button 
              type="button"
              className="home-btn home-btn-solid"
              style={{ flex: 1, minWidth: '140px', padding: '0.5rem 1rem', fontSize: '0.82rem', justifyContent: 'center' }}
              onClick={() => navigate(`/room/${activeRoomId}`)}
            >
              Return to Active Room
            </button>
            <button 
              type="button"
              className="home-btn"
              style={{ flex: 1, minWidth: '140px', padding: '0.5rem 1rem', fontSize: '0.82rem', justifyContent: 'center', background: 'rgba(248,113,113,0.15)', border: '1px solid rgba(248,113,113,0.3)', color: 'var(--warning)' }}
              onClick={handleForceDisconnect}
            >
              Disconnect & Join
            </button>
          </div>
        </motion.div>
      )}

      <motion.button
        variants={staggerItemVariants}
        className={`home-btn home-btn-solid join-room-submit-btn ${isBubbling ? 'rocket-thrust' : ''}`}
        style={{ width: '100%', justifyContent: 'center', opacity: (isFull || hasActiveRoom) ? 0.5 : 1 }}
        onClick={handleJoin}
        disabled={isFull || hasActiveRoom}
      >
        <div className="bubble-container" aria-hidden="true">
          {[...Array(isBubbling ? 16 : 6)].map((_, i) => (
            <div key={i} className="bubble" style={{ '--delay': `${i * 0.05}s` }}></div>
          ))}
        </div>
        <svg className="join-room-mic-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/></svg>
        {isFull ? 'Room is Full' : hasActiveRoom ? 'Already in a Room' : 'Join Voice Room'}
      </motion.button>
      </motion.section>
    </>
  );
}

export default JoinRoom;
