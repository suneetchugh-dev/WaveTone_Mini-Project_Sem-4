import React, { useEffect, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import AmbientVideoBackground from '../components/AmbientVideoBackground';
import './Home.css';

function Home() {
  const location = useLocation();
  const [toastMessage, setToastMessage] = useState(null);

  useEffect(() => {
    document.title = 'WaveTone - Home';
    document.body.setAttribute('data-route', 'home');
    return () => {
      document.body.removeAttribute('data-route');
    };
  }, []);

  useEffect(() => {
    if (location.state?.kickReason) {
      setToastMessage(location.state.kickReason);
      // Clean up router state so refreshing doesn't re-trigger the toast
      window.history.replaceState({}, document.title);
      const timer = setTimeout(() => setToastMessage(null), 6000);
      return () => clearTimeout(timer);
    }
  }, [location]);

  return (
    <div className="home-page">
      <AmbientVideoBackground variant="hero" showToggleButton={true} />

      <section className="home-hero">
        <div className="home-hero-content slide-up">
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
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.6rem',
              width: '100%',
              maxWidth: '600px',
              textAlign: 'left',
              animation: 'fadeIn 0.3s ease',
              boxSizing: 'border-box'
            }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                <circle cx="12" cy="12" r="10"/>
                <line x1="12" y1="8" x2="12" y2="12"/>
                <line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              <span>{toastMessage}</span>
            </div>
          )}
          <h1 className="home-title">Talk without turning every conversation into a profile.</h1>
          <p className="home-subtext">
            <span className="home-subtext-full">WaveTone lets people open temporary voice rooms, join with an alias, and keep sessions focused with live moderation.</span>
            <span className="home-subtext-short">Anonymous voice rooms. No sign-up, no recordings.</span>
          </p>
          <div className="home-actions">
            <NavLink to="/create" className="home-btn home-btn-solid">
              <div className="bubble-container" aria-hidden="true">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="bubble" style={{ '--delay': `${i * 0.05}s` }}></div>
                ))}
              </div>
              <svg className="home-action-icon home-action-icon-create" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle className="home-action-icon-ring" cx="12" cy="12" r="10"/>
                <path className="home-action-icon-plus" d="M12 8v8M8 12h8"/>
              </svg>
              Create Room
            </NavLink>
            <NavLink to="/browse" className="home-btn home-btn-outline">
              <div className="bubble-container" aria-hidden="true">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="bubble" style={{ '--delay': `${i * 0.05}s` }}></div>
                ))}
              </div>
              <svg className="home-action-icon home-action-icon-browse" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle className="home-action-icon-lens" cx="11" cy="11" r="8"/>
                <path className="home-action-icon-handle" d="M21 21l-4.35-4.35"/>
                <path className="home-action-icon-spark" d="M8.7 8.7h4.6"/>
              </svg>
              Browse Rooms
            </NavLink>
          </div>
        </div>
      </section>
    </div>
  );
}

export default Home;
