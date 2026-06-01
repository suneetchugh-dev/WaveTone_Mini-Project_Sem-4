import React, { useEffect, useMemo, useRef, useState } from 'react';
import AmbientVideoBackground from '../components/AmbientVideoBackground';
import './shared.css';

function About() {
  useEffect(() => {
    document.title = 'About - WaveTone';
    document.body.setAttribute('data-route', 'about');
    return () => {
      document.body.removeAttribute('data-route');
    };
  }, []);

  const steps = useMemo(() => ([
    { step: '01', title: 'Create or Browse', desc: 'Pick a topic and open a room, or join one that matches your vibe.', icon: '🚪' },
    { step: '02', title: 'Choose an Alias', desc: 'Use a random name or set your own — still anonymous.', icon: '🎭' },
    { step: '03', title: 'Talk in Real-Time', desc: 'Low-latency WebRTC audio for clear, natural conversation.', icon: '🎤' },
    { step: '04', title: 'Leave Cleanly', desc: 'Sessions end with you — nothing stored, nothing tracked.', icon: '✨' },
  ]), []);

  const [startIndex, setStartIndex] = useState(0);
  const [isExiting, setIsExiting] = useState(false);
  const exitTimeoutRef = useRef(null);

  useEffect(() => {
    const intervalId = setInterval(() => {
      setIsExiting(true);
      exitTimeoutRef.current = setTimeout(() => {
        setStartIndex((prev) => (prev + 2) % steps.length);
        setIsExiting(false);
      }, 450);
    }, 4000);

    return () => {
      clearInterval(intervalId);
      if (exitTimeoutRef.current) {
        clearTimeout(exitTimeoutRef.current);
      }
    };
  }, [steps.length]);

  const visibleSteps = [
    steps[startIndex],
    steps[(startIndex + 1) % steps.length],
  ];

  return (
    <>
      <AmbientVideoBackground variant="subtle" />
      <section className="page-section">
      <h2 className="page-title">About WaveTone</h2>
      <p className="page-subtitle">Privacy-first, anonymous voice conversations.</p>

      <div className="card card--spaced about-hero-card">
        <div className="about-hero">
          <div className="about-hero-content">
            <h3 className="about-card-title">What is WaveTone?</h3>
            <p className="about-card-text">
              <span className="about-emphasis">Anonymous</span> real-time voice rooms for focused conversation.
              <span className="about-emphasis">No accounts</span>, <span className="about-emphasis">no recordings</span>, no tracking —
              clear voice with <span className="about-emphasis">AI moderation</span>.
            </p>
          </div>
          <ul className="about-highlights" aria-label="WaveTone highlights">
            <li>Anonymous by default</li>
            <li>AI-guided moderation</li>
            <li>No sign-up required</li>
            <li>Ephemeral sessions</li>
          </ul>
        </div>
      </div>

      <div className="card card--spaced">
        <h3 className="about-card-title about-card-title--with-icon">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="mediumaquamarine" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 1 1-6.219-8.56"/><path d="M22 4 12 14.01l-3-3"/></svg>
          Why WaveTone
        </h3>
        <div className="about-stats-grid">
          <div className="about-stat">
            <div className="about-stat-value">0</div>
            <div className="about-stat-label">Accounts required</div>
          </div>
          <div className="about-stat">
            <div className="about-stat-value">0</div>
            <div className="about-stat-label">Audio stored</div>
          </div>
          <div className="about-stat">
            <div className="about-stat-value">100%</div>
            <div className="about-stat-label">Session-based privacy</div>
          </div>
        </div>
        <div className="about-values">
          <span>Focused rooms, minimal noise</span>
          <span>Safety-first moderation</span>
          <span>Designed for short sessions</span>
        </div>
      </div>

      <div className="card card--spaced">
        <h3 className="about-card-title about-card-title--with-icon about-card-title--spaced">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="mediumaquamarine" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/></svg>
          How It Works
        </h3>
        <p className="about-steps-subtitle">
          Set up a room in seconds, talk with clarity, and leave without a trace.
        </p>
        <div className="about-steps-carousel" aria-label="How It Works carousel">
          <div className="about-steps-grid">
            {visibleSteps.map((item) => (
              <div
                key={`${item.step}-${startIndex}`}
                className={`about-step-item${isExiting ? ' about-step-item--exit' : ''}`}
              >
                <div className="about-step-icon">{item.icon}</div>
                <div className="about-step-number">{item.step}</div>
                <div className="about-step-title">{item.title}</div>
                <div className="about-step-desc">{item.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
      </section>
    </>
  );
}

export default About;
