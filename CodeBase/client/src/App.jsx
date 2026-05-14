import React from 'react';

import { Routes, Route, NavLink } from 'react-router-dom';
import Home from './pages/Home';
import BrowseRooms from './pages/BrowseRooms';
import CreateRoom from './pages/CreateRoom';
import JoinRoom from './pages/JoinRoom';
import VoiceRoom from './pages/VoiceRoom';
import PostRoomSummary from './pages/PostRoomSummary';
import About from './pages/About';
import NotFound from './pages/NotFound';
import './App.css';
import { useEffect, useState, useRef } from 'react';
import { darkTheme, lightTheme } from './theme';
import MainLogo from './assets/main-logo.png';


function App() {
  // Initialize theme immediately with localStorage value
  const initializeTheme = () => {
    const savedTheme = localStorage.getItem('wavetone-theme') || 'dark';
    // Only apply theme if not already set
    if (document.documentElement.getAttribute('data-theme') !== savedTheme) {
      document.documentElement.setAttribute('data-theme', savedTheme);
      const themeVars = savedTheme === 'dark' ? darkTheme : lightTheme;
      for (const key in themeVars) {
        document.documentElement.style.setProperty(key, themeVars[key]);
      }
    }
    return savedTheme;
  };

  const [theme, setTheme] = useState(initializeTheme);
  const themeBeforeAnimation = useRef(theme);

  useEffect(() => {
    if (theme === 'animating') return;
    themeBeforeAnimation.current = theme;
    const currentTheme = document.documentElement.getAttribute('data-theme');
    if (theme !== currentTheme) {
      const themeVars = theme === 'dark' ? darkTheme : lightTheme;
      document.documentElement.setAttribute('data-theme', theme);
      localStorage.setItem('wavetone-theme', theme);
      for (const key in themeVars) {
        document.documentElement.style.setProperty(key, themeVars[key]);
      }
    }
  }, [theme]);

  // Helper to detect small screens (max-width: 500px)
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 500);
  React.useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 500);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div className="app-bg">
      <nav className="main-nav">
        <div className="nav-logo-group">
          <NavLink to="/" className="nav-logo-link">
            <img src={MainLogo} alt="WaveTone Logo" className="nav-logo-img" />
            <span className="nav-title">WaveTone</span>
          </NavLink>
          {isMobile && (
            <div className="nav-actions nav-actions-mobile">
              <NavLink 
                to="/" 
                className="nav-link nav-home-link"
                title="Go to Home"
                aria-label="Home"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
              </NavLink>
              <button
                className={`theme-toggle${theme === 'animating' ? ' rotating' : ''}`}
                onClick={() => {
                  if (theme !== 'animating') {
                    setTheme('animating');
                    setTimeout(() => setTheme(theme === 'dark' ? 'light' : 'dark'), 400);
                  }
                }}
                title="Toggle light/dark mode"
                aria-label="Toggle theme"
              >
                {(theme === 'animating' ? themeBeforeAnimation.current === 'dark' : theme === 'dark') ? (
                  <svg className="theme-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="5" />
                    <g>
                      <line x1="12" y1="1" x2="12" y2="3" />
                      <line x1="12" y1="21" x2="12" y2="23" />
                      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                      <line x1="1" y1="12" x2="3" y2="12" />
                      <line x1="21" y1="12" x2="23" y2="12" />
                      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
                    </g>
                  </svg>
                ) : (
                  <svg className="theme-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 12.79A9 9 0 1 1 11.21 3a7 7 0 0 0 9.79 9.79z" />
                  </svg>
                )}
              </button>
            </div>
          )}
        </div>
        <div className="nav-links">
          <NavLink to="/create" className={({ isActive }) => isActive ? 'nav-link nav-cta active' : 'nav-link nav-cta'}>
            <span className="nav-icon" aria-label="Create Room">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v8M8 12h8"/></svg>
            </span>
            Create Room
          </NavLink>
          <NavLink to="/browse" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
            <span className="nav-icon" aria-label="Browse Rooms">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="7" width="18" height="13" rx="2"/><path d="M16 3v4M8 3v4"/></svg>
            </span>
            Browse Rooms
          </NavLink>
          <NavLink to="/about" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
            <span className="nav-icon" aria-label="About">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>
            </span>
            About
          </NavLink>
          {!isMobile && (
            <div className="nav-actions">
              <NavLink 
                to="/" 
                className="nav-link nav-home-link"
                title="Go to Home"
                aria-label="Home"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
              </NavLink>
              <button
                className={`theme-toggle${theme === 'animating' ? ' rotating' : ''}`}
                onClick={() => {
                  if (theme !== 'animating') {
                    setTheme('animating');
                    setTimeout(() => setTheme(theme === 'dark' ? 'light' : 'dark'), 400);
                  }
                }}
                title="Toggle light/dark mode"
                aria-label="Toggle theme"
              >
                {(theme === 'animating' ? themeBeforeAnimation.current === 'dark' : theme === 'dark') ? (
                  <svg className="theme-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="5" />
                    <g>
                      <line x1="12" y1="1" x2="12" y2="3" />
                      <line x1="12" y1="21" x2="12" y2="23" />
                      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                      <line x1="1" y1="12" x2="3" y2="12" />
                      <line x1="21" y1="12" x2="23" y2="12" />
                      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
                    </g>
                  </svg>
                ) : (
                  <svg className="theme-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 12.79A9 9 0 1 1 11.21 3a7 7 0 0 0 9.79 9.79z" />
                  </svg>
                )}
              </button>
            </div>
          )}
        </div>
      </nav>
      <main className="page-container">
        <div className="page-box">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/home" element={<Home />} />
            <Route path="/browse" element={<BrowseRooms />} />
            <Route path="/create" element={<CreateRoom />} />
            <Route path="/join/:roomId" element={<JoinRoom />} />
            <Route path="/room/:roomId" element={<VoiceRoom />} />
            <Route path="/summary/:roomId" element={<PostRoomSummary />} />
            <Route path="/about" element={<About />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </div>
      </main>
    </div>
  );
}

export default App;
