import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import './BrowseRooms.css';
import './shared.css';
import AmbientVideoBackground from '../components/AmbientVideoBackground';
import { getRooms } from '../services/api';
import { connectSocket } from '../services/socket';

const categories = ['All', 'General', 'Study', 'Debate', 'Feedback', 'Chill'];

function BrowseRooms() {
  const [activeCat, setActiveCat] = useState('All');
  const [search, setSearch] = useState('');
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [joinCode, setJoinCode] = useState('');
  const [joinError, setJoinError] = useState('');
  const navigate = useNavigate();
  const socket = connectSocket();

  const handleJoinByCode = (e) => {
    e.preventDefault();
    setJoinError('');
    const input = joinCode.trim();
    if (!input) return;
    // Support both full URLs and raw IDs
    const match = input.match(/\/join\/([a-f0-9]+)/i) || input.match(/\/room\/([a-f0-9]+)/i);
    const id = match ? match[1] : input;
    // Basic MongoDB ObjectId validation (24 hex chars)
    if (/^[a-f0-9]{24}$/i.test(id)) {
      navigate(`/join/${id}`);
    } else {
      setJoinError('Invalid room ID or link.');
    }
  };

  useEffect(() => {
    document.title = 'Browse Rooms - WaveTone';
    document.body.setAttribute('data-route', 'browse-rooms');
    return () => {
      document.body.removeAttribute('data-route');
    };
  }, []);

  const fetchRooms = () => {
    setLoading(prev => rooms.length === 0 ? true : prev); // only show skeleton on first load
    getRooms()
      .then(data => { setRooms(data); setLoading(false); })
      .catch(err => { setError(err.message); setLoading(false); });
  };

  useEffect(() => {
    fetchRooms();
    // Initial fetch + periodic refresh (reduced to 30s for less overhead)
    const interval = setInterval(fetchRooms, 30000);
    return () => clearInterval(interval);
  }, []);

  // Real-time participant count updates via Socket.io
  useEffect(() => {
    if (!socket) return;

    const handleUserJoined = ({ roomId, alias }) => {
      setRooms(prevRooms =>
        prevRooms.map(room =>
          room._id === roomId
            ? {
                ...room,
                participants: [
                  ...room.participants,
                  { alias, joinedAt: new Date(), leftAt: null }
                ]
              }
            : room
        )
      );
      console.log(`Real-time: ${alias} joined room ${roomId}`);
    };

    const handleUserLeft = ({ socketId, roomId }) => {
      setRooms(prevRooms =>
        prevRooms.map(room =>
          room._id === roomId
            ? {
                ...room,
                participants: room.participants.map(p =>
                  p.socketId === socketId ? { ...p, leftAt: new Date() } : p
                )
              }
            : room
        )
      );
      console.log(`Real-time: User left room ${roomId}`);
    };

    const handleRoomUsers = ({ roomId, participants }) => {
      setRooms(prevRooms =>
        prevRooms.map(room =>
          room._id === roomId
            ? { ...room, participants }
            : room
        )
      );
      console.log(`Real-time: Updated participant list for room ${roomId}`);
    };

    socket.on('user-joined', handleUserJoined);
    socket.on('user-left', handleUserLeft);
    socket.on('room-users', handleRoomUsers);

    return () => {
      socket.off('user-joined', handleUserJoined);
      socket.off('user-left', handleUserLeft);
      socket.off('room-users', handleRoomUsers);
    };
  }, [socket]);

  const filtered = rooms
    .filter(r => activeCat === 'All' || r.category === activeCat)
    .filter(r => r.topic.toLowerCase().includes(search.toLowerCase()));

  const activeCount = (room) => room.participants.filter(p => !p.leftAt).length;

  return (
    <section className="page-section-wide">
      <AmbientVideoBackground variant="audio-only" showToggleButton={false} />
        <h1 className="page-title">Browse Rooms</h1>
        <p className="page-subtitle">Find a conversation that interests you.</p>

      {/* Join by Code */}
      <form onSubmit={handleJoinByCode} className="card join-form" style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.8rem', flexWrap: 'nowrap' }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--speaking)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
          <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
          <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
        </svg>
        <label htmlFor="join-code" className="sr-only">Room link or ID</label>
        <input
          id="join-code"
          name="joinCode"
          className="form-input"
          type="text"
          placeholder="Paste a room link or ID..."
          value={joinCode}
          onChange={(e) => { setJoinCode(e.target.value); setJoinError(''); }}
          style={{ flex: 1, minWidth: '180px', marginBottom: 0 }}
        />
        <button type="submit" className="home-btn home-btn-solid" style={{ padding: '0.55rem 1.2rem', fontSize: '0.88rem' }}>
          Join
          <svg className="join-form-arrow" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M5 12h14M12 5l7 7-7 7"/>
          </svg>
        </button>
        {joinError && <span style={{ color: 'var(--warning)', fontSize: '0.8rem', width: '100%' }}>{joinError}</span>}
      </form>

      <div className="browse-search-row">
        <div className={`browse-search-box${search ? ' searching' : ''}`}>
          <label htmlFor="search-rooms" className="sr-only">Search rooms</label>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-tertiary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
          <input
            id="search-rooms"
            name="search"
            aria-label="Search rooms"
            className="browse-search-input"
            type="text"
            placeholder="Search rooms..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="browse-tabs">
        {categories.map(cat => (
          <button
            key={cat}
            className={`browse-tab${activeCat === cat ? ' active' : ''}`}
            onClick={() => setActiveCat(cat)}
          >
            {cat}
          </button>
        ))}
      </div>

      {loading && (
        <div className="room-grid">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div className="skeleton-card" key={i}>
              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
                <div className="skeleton skeleton-badge" />
                <div className="skeleton skeleton-badge" />
              </div>
              <div className="skeleton skeleton-title" />
              <div className="skeleton skeleton-text short" />
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1rem' }}>
                <div className="skeleton skeleton-text" style={{ width: '60px', marginBottom: 0 }} />
                <div className="skeleton skeleton-text" style={{ width: '40px', marginBottom: 0 }} />
              </div>
            </div>
          ))}
        </div>
      )}

      {error && (
        <div className="empty-state">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--warning)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>
          <p style={{ color: 'var(--warning)' }}>Could not load rooms: {error}</p>
        </div>
      )}

      {!loading && !error && filtered.length === 0 && (
        <div className="empty-state">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--text-tertiary)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
          <p>No rooms found. Try a different search or <Link to="/create" style={{ color: 'var(--speaking)' }}>create one</Link>.</p>
        </div>
      )}

      {!loading && !error && filtered.length > 0 && (
        <div className="room-grid">
          {filtered.map(room => {
            const count = activeCount(room);
            const isFull = count >= room.maxUsers;
            return (
              <div className={`room-card${search ? ' search-match' : ''}`} key={room._id}>
                <div className="room-card-header">
                  <span className="badge badge-live">
                    <span className="live-dot" />
                    Live
                  </span>
                  <span className="badge badge-count">{room.category}</span>
                </div>
                <h3 className="room-topic">{room.topic}</h3>
                <div className="room-card-footer">
                  <span className="room-users">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
                    {count}/{room.maxUsers}
                  </span>
                  {isFull ? (
                    <span style={{ fontSize: '0.8rem', color: 'var(--warning)', fontWeight: 600 }}>Full</span>
                  ) : (
                    <button
                      className="room-join-link"
                      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                      onClick={() => navigate(`/join/${room._id}`)}
                    >
                      Join
                      <svg className="room-join-arrow" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

export default BrowseRooms;
