import React, { useState, useEffect, useRef } from 'react';
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

  const [showCategoryMenu, setShowCategoryMenu] = useState(false);
  const [showLanguageMenu, setShowLanguageMenu] = useState(false);
  const [showMaxUsersMenu, setShowMaxUsersMenu] = useState(false);

  const categoryGroupRef = useRef(null);
  const languageGroupRef = useRef(null);
  const maxUsersGroupRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (categoryGroupRef.current && !categoryGroupRef.current.contains(event.target)) {
        setShowCategoryMenu(false);
      }
      if (languageGroupRef.current && !languageGroupRef.current.contains(event.target)) {
        setShowLanguageMenu(false);
      }
      if (maxUsersGroupRef.current && !maxUsersGroupRef.current.contains(event.target)) {
        setShowMaxUsersMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

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
        <div className="card create-room-card participants-card-with-lamp">
          {/* Lamp visual effect wrapper */}
          <div className="voice-room-lamp-wrapper">
            <div className="voice-room-lamp-beam-left"></div>
            <div className="voice-room-lamp-beam-right"></div>
            <div className="voice-room-lamp-blur-mid"></div>
            <div className="voice-room-lamp-line"></div>
          </div>

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

          <div className="form-group" ref={categoryGroupRef} style={{ position: 'relative' }}>
            <label htmlFor="room-category" className="form-label">Category</label>
            <button
              id="room-category"
              type="button"
              className={`form-select${errorField === 'category' ? ' input-error' : ''}${showCategoryMenu ? ' menu-open' : ''}`}
              onClick={() => setShowCategoryMenu(prev => !prev)}
              aria-haspopup="listbox"
              aria-expanded={showCategoryMenu}
            >
              <span>{category}</span>
              <svg 
                className="form-select-caret" 
                width="12" 
                height="12" 
                viewBox="0 0 24 24" 
                fill="none" 
                stroke="currentColor" 
                strokeWidth="2.5" 
                strokeLinecap="round" 
                strokeLinejoin="round"
              >
                <polyline points="6 9 12 15 18 9"/>
              </svg>
            </button>

            {showCategoryMenu && (
              <div className="mic-submenu form-submenu no-scroll">
                <div className="mic-submenu-header">
                  Category
                </div>
                <div className="mic-submenu-list">
                  {categories.map(cat => {
                    const isSelected = category === cat;
                    return (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => {
                          setCategory(cat);
                          setShowCategoryMenu(false);
                          setError(null);
                          setErrorField(null);
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
                        <span className="mic-submenu-label">{cat}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
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

          <div className="form-group" ref={languageGroupRef} style={{ position: 'relative' }}>
            <label htmlFor="room-language" className="form-label">Speech Language / Accent</label>
            <button
              id="room-language"
              type="button"
              className={`form-select${showLanguageMenu ? ' menu-open' : ''}`}
              onClick={() => setShowLanguageMenu(prev => !prev)}
              aria-haspopup="listbox"
              aria-expanded={showLanguageMenu}
            >
              <span>
                {language === 'en' ? 'English (Standard)' :
                 language === 'auto' ? 'Multilingual Auto' :
                 language === 'es' ? 'Spanish (Español)' :
                 language === 'fr' ? 'French (Français)' :
                 language === 'de' ? 'German (Deutsch)' :
                 language === 'hi' ? 'Hindi (हिंदी)' :
                 language === 'pt' ? 'Portuguese (Português)' : language}
              </span>
              <svg 
                className="form-select-caret" 
                width="12" 
                height="12" 
                viewBox="0 0 24 24" 
                fill="none" 
                stroke="currentColor" 
                strokeWidth="2.5" 
                strokeLinecap="round" 
                strokeLinejoin="round"
              >
                <polyline points="6 9 12 15 18 9"/>
              </svg>
            </button>

            {showLanguageMenu && (
              <div className="mic-submenu form-submenu no-scroll">
                <div className="mic-submenu-header">
                  Language / Accent
                </div>
                <div className="mic-submenu-list">
                  {[
                    { value: 'en', label: 'English (Standard)' },
                    { value: 'auto', label: 'Multilingual Auto' },
                    { value: 'es', label: 'Spanish (Español)' },
                    { value: 'fr', label: 'French (Français)' },
                    { value: 'de', label: 'German (Deutsch)' },
                    { value: 'hi', label: 'Hindi (हिंदी)' },
                    { value: 'pt', label: 'Portuguese (Português)' }
                  ].map(lang => {
                    const isSelected = language === lang.value;
                    return (
                      <button
                        key={lang.value}
                        type="button"
                        onClick={() => {
                          setLanguage(lang.value);
                          setShowLanguageMenu(false);
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
                        <span className="mic-submenu-label">{lang.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <div className="form-group" ref={maxUsersGroupRef} style={{ position: 'relative' }}>
            <label htmlFor="max-users" className="form-label">Max Participants</label>
            <button
              id="max-users"
              type="button"
              className={`form-select${showMaxUsersMenu ? ' menu-open' : ''}`}
              onClick={() => setShowMaxUsersMenu(prev => !prev)}
              aria-haspopup="listbox"
              aria-expanded={showMaxUsersMenu}
            >
              <span>{maxUsers} Participants</span>
              <svg 
                className="form-select-caret" 
                width="12" 
                height="12" 
                viewBox="0 0 24 24" 
                fill="none" 
                stroke="currentColor" 
                strokeWidth="2.5" 
                strokeLinecap="round" 
                strokeLinejoin="round"
              >
                <polyline points="6 9 12 15 18 9"/>
              </svg>
            </button>

            {showMaxUsersMenu && (
              <div className="mic-submenu form-submenu">
                <div className="mic-submenu-header">
                  Max Participants
                </div>
                <div className="mic-submenu-list">
                  {[2, 3, 4, 5, 6, 7, 8, 9, 10].map(num => {
                    const isSelected = maxUsers === num;
                    return (
                      <button
                        key={num}
                        type="button"
                        onClick={() => {
                          setMaxUsers(num);
                          setShowMaxUsersMenu(false);
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
                        <span className="mic-submenu-label">{num} Participants</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
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
