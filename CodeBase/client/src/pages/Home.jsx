import React, { useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import './Home.css';

const roomPreview = [
  { title: 'Exam prep check-in', category: 'Study', count: '4/8' },
  { title: 'Product feedback circle', category: 'Feedback', count: '2/6' },
  { title: 'Open debate table', category: 'Debate', count: '6/10' },
];

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

        <aside className="live-panel" aria-label="Live rooms preview">
          <div className="live-panel-header">
            <div>
              <span className="live-eyebrow">Live now</span>
              <h2>Moderated</h2>
            </div>
            <span className="live-indicator" aria-hidden="true" />
          </div>

          <div className="live-wave" aria-hidden="true">
            {[...Array(20)].map((_, index) => (
              <span key={index} className={`live-bar bar-${index % 10}`} />
            ))}
          </div>

          <div className="preview-list">
            {roomPreview.map((room) => (
              <div className="preview-room" key={room.title}>
                <div>
                  <strong>{room.title}</strong>
                  <span>{room.category}</span>
                </div>
                {room.count && <span className="room-count">{room.count}</span>}
              </div>
            ))}
          </div>
        </aside>
      </section>
    </div>
  );
}

export default Home;
