import React, { useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import './Home.css';

function Home() {
  useEffect(() => {
    document.title = 'WaveTone - Home';
    document.body.setAttribute('data-route', 'home');
    return () => {
      document.body.removeAttribute('data-route');
    };
  }, []);

  return (
    <div className="home-page">
      <div className="home-video-backdrop" aria-hidden="true">
        <video
          className="home-bg-video"
          autoPlay
          loop
          muted
          playsInline
          preload="metadata"
          poster="/videos/wavetone-bg-poster.jpg"
        >
          <source src="/videos/wavetone-bg.mp4" type="video/mp4" />
        </video>
        <div className="home-video-shade" />
      </div>

      <section className="home-hero">
        <div className="home-hero-content slide-up">
          <h1 className="home-title">Talk without turning every conversation into a profile.</h1>
          <p className="home-subtext">
            WaveTone lets people open temporary voice rooms, join with an alias, and keep sessions focused with live moderation.
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
