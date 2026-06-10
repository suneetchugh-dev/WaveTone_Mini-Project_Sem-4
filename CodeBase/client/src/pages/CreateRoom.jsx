import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import AmbientVideoBackground from '../components/AmbientVideoBackground';
import './shared.css';
import { createRoom } from '../services/api';

const categories = ['General', 'Study', 'Debate', 'Feedback', 'Chill', 'Custom'];
const RANDOM_ALIASES = ['Echo', 'Wave', 'Drift', 'Haze', 'Pulse', 'Nova', 'Storm', 'Blaze', 'Frost', 'Sonic'];

function CreateRoom() {
  const [topic, setTopic] = useState('');
  const [category, setCategory] = useState('General');
  const [customCategory, setCustomCategory] = useState('');
  const [maxUsers, setMaxUsers] = useState(10);
  const [isPrivate, setIsPrivate] = useState(false);
  const [profanityFilter, setProfanityFilter] = useState(false);
  const [language, setLanguage] = useState('en');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [errorField, setErrorField] = useState(null); // 'topic' or 'category'
  const [customAlias, setCustomAlias] = useState('');
  const [isBubbling, setIsBubbling] = useState(false);
  const [activeRoomId, setActiveRoomId] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    document.title = 'Create Room - WaveTone';
    document.body.setAttribute('data-route', 'create-room');
    return () => {
      document.body.removeAttribute('data-route');
    };
  }, []);

  useEffect(() => {
    setActiveRoomId(localStorage.getItem('wavetone-active-room'));
    const handleStorage = () => {
      setActiveRoomId(localStorage.getItem('wavetone-active-room'));
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  const hasActiveRoom = !!activeRoomId;

  const handleForceDisconnect = () => {
    if (activeRoomId) {
      localStorage.setItem('wavetone-leave-room-signal', activeRoomId);
      localStorage.removeItem('wavetone-active-room');
      setActiveRoomId(null);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (hasActiveRoom) return;
    setLoading(true);
    setError(null);
    setErrorField(null);
    setIsBubbling(true);
    
    // Reset bubble animation after it completes
    setTimeout(() => setIsBubbling(false), 2400);
    
    // Validate topic
    const trimmedTopic = topic.trim();
    if (!trimmedTopic) {
      setError('Please enter a room topic.');
      setErrorField('topic');
      setLoading(false);
      document.getElementById('room-topic')?.focus();
      return;
    }
    
    const finalCategory = category === 'Custom' ? customCategory.trim() : category;
    if (!finalCategory) { 
      setError('Please enter a custom category.'); 
      setErrorField('category'); 
      setLoading(false); 
      document.getElementById('custom-category')?.focus();
      return; 
    }

    try {
      const room = await createRoom({ topic: trimmedTopic, category: finalCategory, maxUsers, isPrivate, profanityFilter, language });
      // Use custom alias if provided, else random
      let alias = customAlias.trim();
      if (!alias) {
        alias = RANDOM_ALIASES[Math.floor(Math.random() * RANDOM_ALIASES.length)];
      }
      navigate(`/room/${room._id}`, { state: { alias, room } });
    } catch (err) {
      setError(err.message);
      setErrorField(err.field);
      setLoading(false);
      
      // Auto-focus field that failed
      if (err.field === 'topic') {
        document.getElementById('room-topic')?.focus();
      } else if (err.field === 'category') {
        if (category === 'Custom') {
          document.getElementById('custom-category')?.focus();
        } else {
          document.getElementById('room-category')?.focus();
        }
      }
    }
  };

  return (
    <>
      <AmbientVideoBackground variant="subtle create" />
      <section className="page-section">
      <h2 className="page-title">Create a Room</h2>
      <p className="page-subtitle">Set up your anonymous voice room in seconds.</p>

      <form onSubmit={handleCreate} className="create-room-form">
        <div className="card create-room-card">
          <div className="form-group full-width-mobile">
            <label htmlFor="room-topic" className="form-label">Room Topic</label>
            <input
              id="room-topic"
              name="topic"
              className={`form-input${errorField === 'topic' ? ' input-error' : ''}`}
              type="text"
              placeholder="e.g. Math Exam Prep, Chill Vibes..."
              value={topic}
              onChange={(e) => { setTopic(e.target.value); setError(null); setErrorField(null); }}
              required
            />
          </div>

          <div className="form-group full-width-mobile">
            <label htmlFor="room-alias" className="form-label">Your Alias (optional)</label>
            <input
              id="room-alias"
              name="alias"
              className="form-input"
              type="text"
              placeholder="e.g. DJNova, Host123, ..."
              value={customAlias}
              onChange={e => setCustomAlias(e.target.value.slice(0, 16))}
              maxLength={16}
            />
            <span className="field-hint">
              {customAlias.length}/16 characters
            </span>
          </div>

          <div className="form-group">
            <label htmlFor="room-category" className="form-label">Category</label>
            <select id="room-category" name="category" className={`form-select${errorField === 'category' ? ' input-error' : ''}`} aria-label="Category" value={category} onChange={(e) => { setCategory(e.target.value); setError(null); setErrorField(null); }}>
              {categories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          {category === 'Custom' && (
            <div className="form-group full-width-mobile">
              <label htmlFor="custom-category" className="form-label">Custom Category</label>
              <input
                id="custom-category"
                name="customCategory"
                className={`form-input${errorField === 'category' ? ' input-error' : ''}`}
                type="text"
                placeholder="e.g. Music, Tech, Philosophy..."
                value={customCategory}
                onChange={(e) => { setCustomCategory(e.target.value.slice(0, 20)); setError(null); setErrorField(null); }}
                maxLength={20}
                required
              />
              <span className="field-hint">
                {customCategory.length}/20 characters
              </span>
            </div>
          )}

          <div className="form-group">
            <label htmlFor="room-language" className="form-label">Speech Language / Accent</label>
            <select
              id="room-language"
              name="language"
              className="form-select"
              aria-label="Language / Accent"
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
            >
              <option value="en">English (Standard)</option>
              <option value="auto">English (Accented / Multilingual Auto)</option>
              <option value="es">Spanish (Español)</option>
              <option value="fr">French (Français)</option>
              <option value="de">German (Deutsch)</option>
              <option value="hi">Hindi (हिंदी)</option>
              <option value="pt">Portuguese (Português)</option>
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="max-users" className="form-label">Max Participants</label>
            <select
              id="max-users"
              name="maxUsers"
              className="form-select"
              aria-label="Max Participants"
              value={maxUsers}
              onChange={(e) => setMaxUsers(Number(e.target.value))}
            >
              {[2, 3, 4, 5, 6, 7, 8, 9, 10].map(num => (
                <option key={num} value={num}>{num} Participants</option>
              ))}
            </select>
          </div>

          <div className="toggle-row create-room-toggle">
            <div>
              <span style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: '0.92rem' }}>Private Room</span>
              <p style={{ color: 'var(--text-tertiary)', fontSize: '0.8rem', margin: 0 }}>Only people with the link can join</p>
            </div>
            <button
              type="button"
              className={`toggle-switch${isPrivate ? ' active' : ''}`}
              aria-label={isPrivate ? 'Set room to public' : 'Set room to private'}
              onClick={() => setIsPrivate(!isPrivate)}
            />
          </div>

          <div className="toggle-row create-room-toggle" style={{ marginTop: '1rem' }}>
            <div>
              <span style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: '0.92rem' }}>Profanity Filter</span>
              <p style={{ color: 'var(--text-tertiary)', fontSize: '0.8rem', margin: 0 }}>Automatically mute offensive language</p>
            </div>
            <button
              type="button"
              className={`toggle-switch${profanityFilter ? ' active' : ''}`}
              aria-label={profanityFilter ? 'Disable profanity filter' : 'Enable profanity filter'}
              onClick={() => setProfanityFilter(!profanityFilter)}
            />
          </div>

          {error && (
            <p className="form-error">
              {error}
            </p>
          )}
        </div>

      {hasActiveRoom && (
        <div className="card active-room-warning-card" style={{ marginBottom: '1.2rem', border: '1.5px solid var(--warning)', background: 'rgba(248,113,113,0.05)', padding: '1.2rem' }}>
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
            You are currently active in another voice room. You must leave that room before creating a new one.
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
              Disconnect & Create
            </button>
          </div>
        </div>
      )}

      <button
        type="submit"
        className={`home-btn home-btn-solid create-room-submit-btn ${isBubbling ? 'rocket-thrust' : ''}`}
        style={{ width: '100%', justifyContent: 'center', opacity: (loading || hasActiveRoom) ? 0.5 : 1 }}
        disabled={loading || hasActiveRoom}
      >
        <div className="bubble-container" aria-hidden="true">
          {[...Array(isBubbling ? 16 : 6)].map((_, i) => (
            <div key={i} className="bubble" style={{ '--delay': `${i * 0.05}s` }}></div>
          ))}
        </div>
        <svg className="create-room-submit-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle className="create-room-submit-icon-ring" cx="12" cy="12" r="10"/>
          <path className="create-room-submit-icon-plus" d="M12 8v8M8 12h8"/>
        </svg>
        {loading ? 'Creating...' : hasActiveRoom ? 'Already in a Room' : 'Create Room'}
      </button>
      </form>
      </section>
    </>
  );
}

export default CreateRoom;
