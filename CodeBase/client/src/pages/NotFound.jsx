import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import './shared.css';
import AmbientVideoBackground from '../components/AmbientVideoBackground';

function NotFound() {
  useEffect(() => { document.title = '404 - WaveTone'; }, []);

  return (
    <section className="page-section" style={{ textAlign: 'center', paddingTop: '4rem', position: 'relative', zIndex: 1 }}>
      <AmbientVideoBackground variant="subtle" showToggleButton={false} />
      <div style={{ fontSize: '4rem', fontWeight: 800, color: 'var(--speaking)', opacity: 0.3, marginBottom: '0.5rem' }}>404</div>
      <h2 className="page-title" style={{ marginBottom: '0.6rem' }}>Page Not Found</h2>
      <p className="page-subtitle" style={{ marginBottom: '2rem' }}>The page you're looking for doesn't exist or has been moved.</p>
      <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
        <Link to="/" className="home-btn home-btn-solid">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
          Back to Home
        </Link>
        <Link to="/browse" className="home-btn home-btn-outline">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '0.5rem' }} aria-hidden="true">
            <rect x="3" y="3" width="7" height="7" />
            <rect x="14" y="3" width="7" height="7" />
            <rect x="3" y="14" width="7" height="7" />
            <rect x="14" y="14" width="7" height="7" />
          </svg>
          Browse Rooms
        </Link>
      </div>
    </section>
  );
}

export default NotFound;
