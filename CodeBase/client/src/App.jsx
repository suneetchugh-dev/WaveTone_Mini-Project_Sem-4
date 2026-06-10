import React from 'react';

import { Routes, Route, NavLink, useLocation } from 'react-router-dom';
import Home from './pages/Home';
import BrowseRooms from './pages/BrowseRooms';
import CreateRoom from './pages/CreateRoom';
import JoinRoom from './pages/JoinRoom';
import VoiceRoom from './pages/VoiceRoom';
import PostRoomSummary from './pages/PostRoomSummary';
import About from './pages/About';
import NotFound from './pages/NotFound';
import ProfanityValidation from './pages/ProfanityValidation';
import './App.css';

import { useEffect, useState, useRef } from 'react';
import { darkTheme, lightTheme } from './theme';
import MainLogo from '../../../Assets/Main-Logo/SampleLogo3.png';
import { AudioProvider } from './context/AudioContext';


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
  const location = useLocation();
  const [isNavScrolled, setIsNavScrolled] = useState(false);
  const navScrollTimeoutRef = useRef(null);

  // Scroll to top on route change
  useEffect(() => {
    window.scrollTo(0, 0);
    setIsNavScrolled(false);
  }, [location.pathname]);

  // Handle navbar scroll state for About and Browse pages
  useEffect(() => {
    if (location.pathname !== '/about' && location.pathname !== '/browse') {
      setIsNavScrolled(false);
      return;
    }

    const handleScroll = () => {
      if (navScrollTimeoutRef.current) {
        clearTimeout(navScrollTimeoutRef.current);
      }

      const scrollY = window.scrollY;
      if (scrollY > 80) {
        setIsNavScrolled(true);
      } else {
        setIsNavScrolled(false);
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [location.pathname]);

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

  // Helper to detect mobile/tablet screens (max-width: 768px) — iPad Mini, Surface Duo, iPhone etc.
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  React.useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const resolvedTheme = theme === 'animating' ? themeBeforeAnimation.current : theme;
  const themeToggleLabel = resolvedTheme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode';

  return (
    <div className="app-bg">
      <nav className={`main-nav ${isNavScrolled && (location.pathname === '/about' || location.pathname === '/browse') ? 'nav-scrolled' : ''}`}>
        <div className="nav-logo-group">
          <NavLink to="/" className="nav-logo-link" data-tooltip={isNavScrolled ? "WaveTone Home" : undefined}>
            <img src={MainLogo} alt="WaveTone Logo" className="nav-logo-img" />
            {!isNavScrolled && <span className="nav-title">WaveTone</span>}
          </NavLink>
          {isMobile && (
            <div className="nav-actions nav-actions-mobile">
              <NavLink 
                to="/" 
                className="nav-link nav-home-link"
                data-tooltip="Go to Home"
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
                aria-label={themeToggleLabel}
                data-tooltip={themeToggleLabel}
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
          <NavLink to="/create" className={({ isActive }) => isActive ? 'nav-link nav-cta active' : 'nav-link nav-cta'} data-tooltip={isNavScrolled ? "Create Room" : undefined}>
            <span className="nav-icon" aria-label="Create Room">
              <svg className="nav-create-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle className="nav-create-icon-ring" cx="12" cy="12" r="10"/>
                <path className="nav-create-icon-plus" d="M12 8v8M8 12h8"/>
              </svg>
            </span>
            {!isNavScrolled && <span>Create Room</span>}
          </NavLink>
          <NavLink to="/browse" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'} data-tooltip={isNavScrolled ? "Browse Rooms" : undefined}>
            <span className="nav-icon" aria-label="Browse Rooms">
              <svg className="nav-browse-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle className="nav-browse-lens" cx="11" cy="11" r="8"/>
                <path className="nav-browse-handle" d="M21 21l-4.35-4.35"/>
                <path className="nav-browse-spark" d="M8.7 8.7h4.6"/>
              </svg>
            </span>
            {!isNavScrolled && <span>Browse Rooms</span>}
          </NavLink>
          <NavLink to="/about" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'} data-tooltip={isNavScrolled ? "About" : undefined}>
            <span className="nav-icon" aria-label="About">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>
            </span>
            {!isNavScrolled && <span>About</span>}
          </NavLink>
          <NavLink to="/moderation" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'} data-tooltip={isNavScrolled ? "Moderation" : undefined}>
            <span className="nav-icon" aria-label="Moderation">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
              </svg>
            </span>
            {!isNavScrolled && <span>Moderation</span>}
          </NavLink>
          {!isMobile && (
            <div className="nav-actions">
              <NavLink 
                to="/" 
                className="nav-link nav-home-link"
                data-tooltip="Go to Home"
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
                aria-label={themeToggleLabel}
                data-tooltip={themeToggleLabel}
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
            <Route path="/moderation" element={<ProfanityValidation />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </div>
      </main>
    </div>
  );
}

function AppWithAudio() {
  return (
    <AudioProvider>
      <App />
    </AudioProvider>
  );
}

export default AppWithAudio;
