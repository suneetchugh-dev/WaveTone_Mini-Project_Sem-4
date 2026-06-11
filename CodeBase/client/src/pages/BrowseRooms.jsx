import React, { useState, useEffect } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import './BrowseRooms.css';
import './shared.css';
import AmbientVideoBackground from '../components/AmbientVideoBackground';
import { getRooms } from '../services/api';
import { connectSocket } from '../services/socket';

const standardCategories = ['General', 'Study', 'Debate', 'Feedback', 'Chill'];
const categories = ['All', 'General', 'Study', 'Debate', 'Feedback', 'Chill', 'Other'];
const sortLabels = {
  default: 'Default Sort',
  'low-to-high': 'Participants: Low to High',
  'high-to-low': 'Participants: High to Low'
};

function BrowseRooms() {
  const [activeCat, setActiveCat] = useState('All');
  const [search, setSearch] = useState('');
  const [sortOrder, setSortOrder] = useState('default');
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [rooms, setRooms] = useState([]);
  const sortGroupRef = React.useRef(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [joinCode, setJoinCode] = useState('');
  const [joinError, setJoinError] = useState('');
  const [toastMessage, setToastMessage] = useState(null);
  const navigate = useNavigate();
  const location = useLocation();
  const socket = connectSocket();

  useEffect(() => {
    if (location.state?.error) {
      setToastMessage(location.state.error);
      window.history.replaceState({}, document.title);
      const timer = setTimeout(() => setToastMessage(null), 6000);
      return () => clearTimeout(timer);
    }
  }, [location]);

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

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (sortGroupRef.current && !sortGroupRef.current.contains(event.target)) {
        setShowSortMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
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

  const activeCount = (room) => room.participants.filter(p => !p.leftAt).length;

  let filtered = rooms
    .filter(r => {
      if (activeCat === 'All') return true;
      if (activeCat === 'Other') {
        return !standardCategories.includes(r.category);
      }
      return r.category === activeCat;
    })
    .filter(r => r.topic.toLowerCase().includes(search.toLowerCase()));

  if (sortOrder === 'low-to-high') {
    filtered = [...filtered].sort((a, b) => activeCount(a) - activeCount(b));
  } else if (sortOrder === 'high-to-low') {
    filtered = [...filtered].sort((a, b) => activeCount(b) - activeCount(a));
  }

  return (
    <section className="page-section-wide">
      <AmbientVideoBackground variant="audio-only" showToggleButton={false} />
      <h1 className="page-title">Browse Rooms</h1>
      <p className="page-subtitle">Find a conversation that interests you.</p>

      {toastMessage && (
        <div style={{
          background: 'rgba(239, 68, 68, 0.1)',
          border: '1.5px solid #ef4444',
          borderRadius: '12px',
          padding: '0.8rem 1.2rem',
          marginBottom: '1.5rem',
          color: '#ef4444',
          fontSize: '0.88rem',
          fontWeight: 600,
          display: 'flex',
          alignItems: 'center',
          gap: '0.6rem',
          animation: 'fadeIn 0.3s ease'
        }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="8" x2="12" y2="12"/>
            <line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Join by Code */}
      <div style={{ marginBottom: '1.5rem' }}>
        <form onSubmit={handleJoinByCode} className="card join-form" style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', flexWrap: 'nowrap', marginBottom: 0 }}>
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
          <button type="submit" className="home-btn home-btn-solid" style={{ padding: '0.55rem 1.2rem', fontSize: '0.88rem', flexShrink: 0 }}>
            Join
            <svg className="join-form-arrow" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M5 12h14M12 5l7 7-7 7"/>
            </svg>
          </button>
        </form>
        {joinError && (
          <div style={{ color: 'var(--warning)', fontSize: '0.82rem', marginTop: '0.5rem', paddingLeft: '1.8rem', fontWeight: 600, animation: 'fadeIn 0.2s ease' }}>
            {joinError}
          </div>
        )}
      </div>

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

        <div className={`browse-sort-box${showSortMenu ? ' menu-open' : ''}`} ref={sortGroupRef}>
          <button
            type="button"
            className="browse-sort-trigger-btn"
            onClick={() => setShowSortMenu(prev => !prev)}
            aria-haspopup="listbox"
            aria-expanded={showSortMenu}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
              <path d="M11 5h10M11 9h7M11 13h4M3 17l3 3 3-3M6 18V4"/>
            </svg>
            <span className="browse-sort-trigger-label">{sortLabels[sortOrder]}</span>
          </button>

          {showSortMenu && (
            <div className="mic-submenu sort-submenu">
              <div className="mic-submenu-header">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                  <path d="M11 5h10M11 9h7M11 13h4M3 17l3 3 3-3M6 18V4"/>
                </svg>
                Sort Rooms
              </div>
              <div className="mic-submenu-list">
                {Object.keys(sortLabels).map((key) => {
                  const isSelected = sortOrder === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => {
                        setSortOrder(key);
                        setShowSortMenu(false);
                      }}
                      className={`mic-submenu-item${isSelected ? ' selected' : ''}`}
                    >
                      <span className="mic-submenu-checkmark">
                        {isSelected && (
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="var(--speaking)" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12"/>
                          </svg>
                        )}
                      </span>
                      <span className="mic-submenu-label">{sortLabels[key]}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
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

      <div style={{ position: 'relative', marginTop: '4.5rem' }}>
        {/* Lamp visual effect wrapper */}
        <div className="voice-room-lamp-wrapper" style={{ height: '220px', top: '0px' }}>
          <div className="voice-room-lamp-beam-left"></div>
          <div className="voice-room-lamp-beam-right"></div>
          <div className="voice-room-lamp-blur-mid" style={{ width: '180px', height: '60px' }}></div>
          <div className="voice-room-lamp-line"></div>
        </div>

        <div className="card-content-relative">
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
        </div>
      </div>
    </section>
  );
}

export default BrowseRooms;
