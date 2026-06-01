import React, { useState, useEffect } from 'react';
import { useParams, useLocation, Link } from 'react-router-dom';
import './shared.css';
import { getSessionSummary, getAISummary } from '../services/api';

function PostRoomSummary() {
  const { roomId } = useParams();
  const location = useLocation();

  const stateData = location.state || {};
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(!stateData.room);
  const [aiSummary, setAiSummary] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiMeta, setAiMeta] = useState({ provider: null, reason: null });

  useEffect(() => {
    document.title = 'Session Summary - WaveTone';
    document.body.setAttribute('data-route', 'post-room-summary');
    return () => {
      document.body.removeAttribute('data-route');
    };
  }, []);

  useEffect(() => {
    if (stateData.room) {
      // Fetch full session data from API to get all participants from DB
      getSessionSummary(roomId)
        .then(data => {
          setSummary({
            topic: data.topic || stateData.room.topic,
            category: data.category || stateData.room.category,
            duration: stateData.duration || data.duration || 1,
            participantCount: data.participantCount || stateData.participantCount || 1,
            participants: data.participants || [],
          });
          setLoading(false);
        })
        .catch(() => {
          // Fallback to state data if API fails
          setSummary({
            topic: stateData.room.topic,
            category: stateData.room.category,
            duration: stateData.duration || 1,
            participantCount: stateData.participantCount || 1,
          });
          setLoading(false);
        });

      // Request AI summary if transcripts are available
      const transcripts = stateData.transcripts || [];
      if (transcripts.length > 0) {
        setAiLoading(true);
        getAISummary(roomId, {
          transcripts,
          topic: stateData.room.topic,
          category: stateData.room.category,
          duration: stateData.duration,
          participantCount: stateData.participantCount,
        })
          .then(data => {
            console.log('AI Summary Response:', { summary: data.summary?.substring(0, 50) + '...', provider: data.provider, model: data.model, reason: data.reason });
            setAiSummary(data.summary || data.reason || null);
            setAiMeta({ provider: data.provider || null, reason: data.reason || null, model: data.model || null });
            setAiLoading(false);
          })
          .catch((err) => {
            console.error('AI Summary Error:', err);
            setAiSummary('AI summary is temporarily unavailable.');
            setAiMeta({ provider: null, reason: 'The summary service could not be reached.', model: null });
            setAiLoading(false);
          });
      }
      return;
    }

    getSessionSummary(roomId)
      .then(data => {
        setSummary({
          topic: data.topic,
          category: data.category,
          duration: data.duration,
          participantCount: data.participantCount,
          participants: data.participants || [],
        });
        setLoading(false);
      })
      .catch(() => {
        setSummary({ topic: 'Unknown', category: '-', duration: '-', participantCount: '-' });
        setLoading(false);
      });
  }, [roomId]);

  return (
    <section className="page-section">
      <h2 className="page-title">Session Summary</h2>
      <p className="page-subtitle">Here's a recap of your voice session.</p>

      {loading ? (
        <p style={{ color: 'var(--text-secondary)', textAlign: 'center' }}>Loading summary...</p>
      ) : (
        <>
          {/* Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
            <div className="card stat-card">
              <div className="stat-value">{summary?.duration ?? '-'}</div>
              <div className="stat-label">Minutes</div>
            </div>
            <div className="card stat-card">
              <div className="stat-value">{summary?.participantCount ?? '-'}</div>
              <div className="stat-label">Participants</div>
            </div>
            <div className="card stat-card">
              <div className="stat-value">0</div>
              <div className="stat-label">Warnings</div>
            </div>
          </div>

          {/* AI Summary */}
          {(aiLoading || aiSummary) && (
            <div className="card" style={{ marginBottom: '1.2rem', border: '1.5px solid var(--speaking)', background: 'rgba(56,189,248,0.03)' }}>
              <h3 style={{ color: 'var(--text-primary)', fontWeight: 700, marginBottom: '0.8rem', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--speaking)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a4 4 0 0 0-4 4v6a4 4 0 0 0 8 0V6a4 4 0 0 0-4-4z"/><path d="M18 10v2a6 6 0 0 1-12 0v-2"/><path d="M6 20h12"/><path d="M12 16v4"/></svg>
                AI Conversation Summary
              </h3>
              {aiLoading ? (
                <div>
                  <div className="skeleton skeleton-text wide" />
                  <div className="skeleton skeleton-text" />
                  <div className="skeleton skeleton-text short" />
                </div>
              ) : (
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.7 }}>
                  {aiSummary}
                </p>
              )}
              <p style={{ color: 'var(--text-tertiary)', fontSize: '0.72rem', marginTop: '0.6rem', fontStyle: 'italic' }}>
                {aiMeta.provider === 'groq'
                    ? `Powered by Groq (${aiMeta.model || 'llama-3.3-70b-versatile'}). Based on speech-to-text transcripts — no audio stored.`
                    : aiMeta.provider === 'local-fallback'
                      ? 'Generated from speech-to-text transcripts using the built-in fallback summary. No audio stored.'
                      : 'Based on speech-to-text transcripts — no audio stored.'}
              </p>
              {aiMeta.reason && (
                <p style={{ color: 'var(--text-tertiary)', fontSize: '0.72rem', marginTop: '0.35rem' }}>
                  {aiMeta.reason}
                </p>
              )}
            </div>
          )}

          {/* Speaker Balance */}
          {stateData.speakingTimes && Object.keys(stateData.speakingTimes).length > 0 && (() => {
            const times = stateData.speakingTimes;
            const maxTime = Math.max(...Object.values(times), 1);
            const totalTime = Object.values(times).reduce((a, b) => a + b, 0) || 1;
            const formatTime = (s) => s >= 60 ? `${Math.floor(s / 60)}m ${s % 60}s` : `${s}s`;
            return (
              <div className="card" style={{ marginBottom: '1.2rem' }}>
                <h3 style={{ color: 'var(--text-primary)', fontWeight: 700, marginBottom: '1rem', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--speaking)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
                  Speaker Balance
                </h3>
                {Object.entries(times)
                  .sort(([, a], [, b]) => b - a)
                  .map(([name, seconds]) => (
                    <div key={name} style={{ marginBottom: '0.7rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.3rem' }}>
                        <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>{name}</span>
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>
                          {formatTime(seconds)} ({Math.round((seconds / totalTime) * 100)}%)
                        </span>
                      </div>
                      <div style={{ background: 'var(--card-border)', borderRadius: '4px', height: '8px', overflow: 'hidden' }}>
                        <div style={{
                          width: `${(seconds / maxTime) * 100}%`,
                          background: 'var(--speaking)',
                          height: '100%',
                          borderRadius: '4px',
                          transition: 'width 0.5s ease',
                        }} />
                      </div>
                    </div>
                  ))
                }
              </div>
            );
          })()}

          {/* Details */}
          <div className="card" style={{ marginBottom: '1.2rem' }}>
            <h3 style={{ color: 'var(--text-primary)', fontWeight: 700, marginBottom: '0.8rem', fontSize: '1rem' }}>Session Details</h3>
            {summary?.topic && (
              <div className="info-row">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--speaking)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="7" width="18" height="13" rx="2"/><path d="M16 3v4M8 3v4"/></svg>
                <span>Topic: <strong style={{ color: 'var(--text-primary)' }}>{summary.topic}</strong></span>
              </div>
            )}
            {summary?.category && (
              <div className="info-row">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--speaking)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a10 10 0 0 1 0 20"/><path d="M2 12h20"/></svg>
                <span>Category: <strong style={{ color: 'var(--text-primary)' }}>{summary.category}</strong></span>
              </div>
            )}
            <div className="info-row">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--speaking)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              <span>Duration: {summary?.duration ?? '-'} {summary?.duration !== '-' ? 'minute(s)' : ''}</span>
            </div>
            <div className="info-row">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--speaking)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
              <span>Moderation: Active throughout session</span>
            </div>
            <div className="info-row">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-tertiary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/></svg>
              <span style={{ color: 'var(--text-tertiary)', fontStyle: 'italic' }}>No audio was recorded or stored.</span>
            </div>
          </div>

          {/* Participants List */}
          {summary?.participants && summary.participants.length > 0 && (
            <div className="card" style={{ marginBottom: '1.2rem' }}>
              <h3 style={{ color: 'var(--text-primary)', fontWeight: 700, marginBottom: '0.8rem', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--speaking)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                Session Participants ({summary.participants.length})
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {summary.participants.map((participant, index) => (
                  <div key={participant.userId || index} style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    padding: '0.6rem 0.8rem',
                    background: 'var(--card-bg)',
                    borderRadius: '8px',
                    border: '1px solid var(--card-border)',
                  }}>
                    <div style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '50%',
                      background: 'var(--speaking)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'white',
                      fontWeight: 600,
                      fontSize: '0.85rem',
                    }}>
                      {participant.alias?.charAt(0).toUpperCase() || '?'}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                        {participant.alias || 'Unknown'}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
                        {participant.isActive ? (
                          <span style={{ color: '#4ade80' }}>● Active</span>
                        ) : (
                          <span>Left {participant.leftAt ? new Date(participant.leftAt).toLocaleTimeString() : 'Unknown time'}</span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Actions */}
      <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', justifyContent: 'center' }}>
        <Link to="/browse" className="home-btn home-btn-solid">
          <div className="bubble-container" aria-hidden="true">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="bubble" style={{ '--delay': `${i * 0.05}s` }}></div>
            ))}
          </div>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
          Browse Rooms
        </Link>
        <Link to="/" className="home-btn home-btn-outline">
          <div className="bubble-container" aria-hidden="true">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="bubble" style={{ '--delay': `${i * 0.05}s` }}></div>
            ))}
          </div>
          Back to Home
        </Link>
      </div>
    </section>
  );
}

export default PostRoomSummary;
