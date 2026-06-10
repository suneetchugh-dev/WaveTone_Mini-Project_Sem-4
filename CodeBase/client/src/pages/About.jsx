import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import AmbientVideoBackground from '../components/AmbientVideoBackground';
import { getModerationMetrics, getFlaggedLogs, testTextModeration, submitModerationFeedback } from '../services/api';
import './shared.css';

const BENCHMARK_SUITE = [
  // Clean Cases
  { text: "Hello, how are you today?", expected: "clean", lang: "en", type: "Clean" },
  { text: "Let's study for the mathematics exam this evening.", expected: "clean", lang: "en", type: "Clean" },
  { text: "The weather is really nice, want to go for a walk?", expected: "clean", lang: "en", type: "Clean" },
  { text: "Bonjour, comment ça va hoy?", expected: "clean", lang: "fr", type: "Clean (French)" },
  { text: "Hola, me gustaría reservar una mesa.", expected: "clean", lang: "es", type: "Clean (Spanish)" },
  { text: "Kya hum kal mil sakte hain padhai ke liye?", expected: "clean", lang: "hi", type: "Clean (Hindi)" },
  
  // Standard English Profanity
  { text: "this is total shit", expected: "profane", lang: "en", type: "Direct Swear" },
  { text: "shut up you asshole", expected: "profane", lang: "en", type: "Direct Swear" },
  { text: "he is a bastard", expected: "profane", lang: "en", type: "Direct Swear" },

  // Leet-speak (English)
  { text: "f*ck this system", expected: "profane", lang: "en", type: "Leet-speak" },
  { text: "what a sh1t show", expected: "profane", lang: "en", type: "Leet-speak" },
  
  // Spaced (English)
  { text: "f u c k this", expected: "profane", lang: "en", type: "Spaced Swear" },
  { text: "s h i t happens", expected: "profane", lang: "en", type: "Spaced Swear" },

  // Non-English Profanity
  { text: "esta es una puta mierda", expected: "profane", lang: "es", type: "Spanish Swear" },
  { text: "c'est de la merde", expected: "profane", lang: "fr", type: "French Swear" },
  { text: "du bist ein arschloch", expected: "profane", lang: "de", type: "German Swear" },
  { text: "tu bahut bada chutiya hai", expected: "profane", lang: "hi", type: "Hindi Swear" }
];

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

  // Moderation Engine State
  const [sandboxText, setSandboxText] = useState('');
  const [sandboxLang, setSandboxLang] = useState('en');
  const [sandboxResult, setSandboxResult] = useState(null);
  const [sandboxLoading, setSandboxLoading] = useState(false);

  const [metrics, setMetrics] = useState({
    totalFlagged: 0,
    verifiedCorrect: 0,
    verifiedFalsePositive: 0,
    pendingVerification: 0,
    totalVerified: 0,
    falsePositiveRate: 0,
    accuracyRate: 100
  });

  const [flaggedLogs, setFlaggedLogs] = useState([]);
  const [logsLoading, setLogsLoading] = useState(true);

  const [benchmarkResults, setBenchmarkResults] = useState([]);
  const [benchmarkMetrics, setBenchmarkMetrics] = useState(null);
  const [benchmarkRunning, setBenchmarkRunning] = useState(false);

  const fetchMetrics = useCallback(async () => {
    try {
      const data = await getModerationMetrics();
      setMetrics(data);
    } catch (err) {
      console.error('Failed to fetch metrics:', err);
    }
  }, []);

  const fetchLogs = useCallback(async () => {
    setLogsLoading(true);
    try {
      const data = await getFlaggedLogs();
      setFlaggedLogs(data);
    } catch (err) {
      console.error('Failed to fetch flagged logs:', err);
    } finally {
      setLogsLoading(false);
    }
  }, []);

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

  useEffect(() => {
    fetchMetrics();
    fetchLogs();
  }, [fetchMetrics, fetchLogs]);

  const visibleSteps = [
    steps[startIndex],
    steps[(startIndex + 1) % steps.length],
  ];

  const handleSandboxSubmit = async (e) => {
    e.preventDefault();
    if (!sandboxText.trim()) return;
    setSandboxLoading(true);
    setSandboxResult(null);
    try {
      const data = await testTextModeration({ text: sandboxText, language: sandboxLang });
      setSandboxResult(data);
    } catch (err) {
      console.error('Sandbox test failed:', err);
    } finally {
      setSandboxLoading(false);
    }
  };

  const handleFeedback = async (logId, isCorrect) => {
    try {
      await submitModerationFeedback(logId, isCorrect);
      fetchMetrics();
      setFlaggedLogs(prev => prev.map(log => log._id === logId ? { ...log, isCorrect } : log));
    } catch (err) {
      console.error('Failed to submit feedback:', err);
    }
  };

  const runBenchmark = async () => {
    setBenchmarkRunning(true);
    setBenchmarkResults([]);
    setBenchmarkMetrics(null);
    
    const results = [];
    let tp = 0;
    let tn = 0;
    let fp = 0;
    let fn = 0;

    try {
      for (const item of BENCHMARK_SUITE) {
        const data = await testTextModeration({ text: item.text, language: item.lang });
        const predicted = data.isFlagged ? 'profane' : 'clean';
        const passed = predicted === item.expected;
        
        if (item.expected === 'profane') {
          if (predicted === 'profane') tp++;
          else fn++;
        } else {
          if (predicted === 'clean') tn++;
          else fp++;
        }

        results.push({
          ...item,
          predicted,
          passed,
          latency: data.latency,
          detectedBy: data.detectedBy
        });
      }

      const total = BENCHMARK_SUITE.length;
      const accuracy = total > 0 ? ((tp + tn) / total) * 100 : 0;
      const precision = (tp + fp) > 0 ? (tp / (tp + fp)) * 100 : 0;
      const recall = (tp + fn) > 0 ? (tp / (tp + fn)) * 100 : 0;
      const f1Score = (precision + recall) > 0 ? (2 * precision * recall) / (precision + recall) : 0;

      setBenchmarkResults(results);
      setBenchmarkMetrics({
        accuracy: parseFloat(accuracy.toFixed(1)),
        precision: parseFloat(precision.toFixed(1)),
        recall: parseFloat(recall.toFixed(1)),
        f1Score: parseFloat((f1Score / 100).toFixed(2)),
        tp, tn, fp, fn
      });
    } catch (err) {
      console.error('Benchmark suite crashed:', err);
    } finally {
      setBenchmarkRunning(false);
    }
  };

  return (
    <>
      <AmbientVideoBackground variant="subtle" />
      <section className="page-section-wide">
        <div style={{ maxWidth: '800px', margin: '0 auto 4rem auto' }}>
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
        </div>

        <div style={{ borderTop: '1px solid var(--card-border)', paddingTop: '3rem', marginTop: '3rem' }}>
          <h2 className="page-title">Try the Moderation Engine</h2>
          <p className="page-subtitle" style={{ marginBottom: '2rem' }}>
            WaveTone uses an on-device/in-browser TF.js model paired with multingual Whisper processing to actively detect and block toxic behavior. You can test our moderation filters below.
          </p>

          {/* Metrics Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
            <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)', fontWeight: 600 }}>Total Flagged Items</span>
              <span style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--speaking)' }}>{metrics.totalFlagged}</span>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>Logged across sessions</span>
            </div>
            <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)', fontWeight: 600 }}>Verified Accuracy</span>
              <span style={{ fontSize: '1.8rem', fontWeight: 800, color: metrics.accuracyRate > 90 ? '#10b981' : '#f59e0b' }}>
                {metrics.accuracyRate}%
              </span>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>Based on moderator feedback</span>
            </div>
            <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)', fontWeight: 600 }}>False Positive Rate</span>
              <span style={{ fontSize: '1.8rem', fontWeight: 800, color: metrics.falsePositiveRate < 10 ? '#10b981' : '#ef4444' }}>
                {metrics.falsePositiveRate}%
              </span>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>Clean flagged as profane</span>
            </div>
            <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)', fontWeight: 600 }}>Active Classifiers</span>
              <span style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: '0.6rem' }}>
                Dictionary + TF.js
              </span>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>Whisper Multilingual</span>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
            {/* Sandbox Card */}
            <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
              <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>Interactive Sandbox</h3>
              <form onSubmit={handleSandboxSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', flex: 1 }}>
                <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  <label htmlFor="sandbox-text" className="form-label" style={{ fontSize: '0.8rem', fontWeight: 600 }}>Text to Evaluate</label>
                  <textarea
                    id="sandbox-text"
                    rows="3"
                    className="form-input"
                    placeholder="Type something to check profanity/toxicity..."
                    value={sandboxText}
                    onChange={(e) => setSandboxText(e.target.value)}
                    style={{ resize: 'none', borderRadius: '12px', fontSize: '0.88rem', padding: '0.75rem', fontFamily: 'inherit' }}
                    required
                  />
                </div>
                
                <div style={{ display: 'flex', gap: '0.8rem', alignItems: 'center' }}>
                  <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                    <label htmlFor="sandbox-lang" className="sr-only">Language Context</label>
                    <select
                      id="sandbox-lang"
                      className="form-select"
                      value={sandboxLang}
                      onChange={(e) => setSandboxLang(e.target.value)}
                      style={{ width: '100%', paddingBlock: '0.55rem', fontSize: '0.82rem' }}
                    >
                      <option value="en">English (Standard)</option>
                      <option value="auto">English (Accented / Auto)</option>
                      <option value="es">Spanish (Español)</option>
                      <option value="fr">French (Français)</option>
                      <option value="de">German (Deutsch)</option>
                      <option value="hi">Hindi (हिंदी)</option>
                      <option value="pt">Portuguese (Português)</option>
                    </select>
                  </div>
                  
                  <button
                    type="submit"
                    disabled={sandboxLoading}
                    className="home-btn home-btn-solid"
                    style={{ padding: '0.55rem 1.5rem', fontSize: '0.85rem' }}
                  >
                    {sandboxLoading ? 'Analyzing...' : 'Analyze'}
                  </button>
                </div>
              </form>

              {sandboxResult && (
                <div style={{ marginTop: '1.2rem', padding: '1rem', background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--card-border)', borderRadius: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.8rem' }}>
                    <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>Result:</span>
                    <span className={`badge ${sandboxResult.isFlagged ? 'badge-live' : 'badge-count'}`} style={{ background: sandboxResult.isFlagged ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)', color: sandboxResult.isFlagged ? '#ef4444' : '#10b981', border: `1px solid ${sandboxResult.isFlagged ? '#ef4444' : '#10b981'}` }}>
                      {sandboxResult.isFlagged ? 'FLAGGED (Profane/Toxic)' : 'CLEAN'}
                    </span>
                  </div>
                  
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                    <div><strong>Latency:</strong> {sandboxResult.latency}ms</div>
                    {sandboxResult.dictionary?.hasProfanity && (
                      <div style={{ color: 'var(--warning)' }}>
                        <strong>Dictionary Match:</strong> [{sandboxResult.dictionary.matchedWords.join(', ')}]
                      </div>
                    )}
                    {sandboxResult.toxicity && sandboxResult.toxicity.length > 0 && (
                      <div>
                        <strong>Toxicity Classifier Breakdown:</strong>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.3rem', marginTop: '0.3rem', paddingLeft: '0.4rem' }}>
                          {sandboxResult.toxicity.map(t => (
                            <div key={t.label} style={{ color: t.match ? '#ef4444' : 'var(--text-tertiary)', fontWeight: t.match ? 600 : 400 }}>
                              • {t.label}: {(t.probability * 100).toFixed(0)}% {t.match ? '⚠️' : ''}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Benchmark Runner Card */}
            <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
              <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>Bulk Benchmark Test Suite</h3>
              <p style={{ margin: '0 0 1rem 0', fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                Test the filters against {BENCHMARK_SUITE.length} pre-compiled scenarios including leet-speak, spaces, Spanish, French, German, and Hindi.
              </p>

              <button
                onClick={runBenchmark}
                disabled={benchmarkRunning}
                className="home-btn home-btn-solid"
                style={{ width: '100%', justifyContent: 'center', marginBottom: '1rem' }}
              >
                {benchmarkRunning ? 'Running Test Suite...' : 'Run Benchmark Suite'}
              </button>

              {benchmarkMetrics && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.5rem', background: 'rgba(255,255,255,0.02)', padding: '0.8rem', borderRadius: '12px', border: '1px solid var(--card-border)' }}>
                    <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontSize: '0.65rem', color: 'var(--text-tertiary)', fontWeight: 600 }}>Accuracy</span>
                      <span style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-primary)' }}>{benchmarkMetrics.accuracy}%</span>
                    </div>
                    <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontSize: '0.65rem', color: 'var(--text-tertiary)', fontWeight: 600 }}>Precision</span>
                      <span style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-primary)' }}>{benchmarkMetrics.precision}%</span>
                    </div>
                    <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontSize: '0.65rem', color: 'var(--text-tertiary)', fontWeight: 600 }}>Recall</span>
                      <span style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-primary)' }}>{benchmarkMetrics.recall}%</span>
                    </div>
                    <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontSize: '0.65rem', color: 'var(--text-tertiary)', fontWeight: 600 }}>F1-Score</span>
                      <span style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--speaking)' }}>{benchmarkMetrics.f1Score}</span>
                    </div>
                  </div>
                  
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', textAlign: 'center' }}>
                    Results: TP: {benchmarkMetrics.tp} | TN: {benchmarkMetrics.tn} | FP: {benchmarkMetrics.fp} | FN: {benchmarkMetrics.fn}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Benchmark results table */}
          {benchmarkResults.length > 0 && (
            <div className="card" style={{ marginBottom: '2rem', overflowX: 'auto' }}>
              <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>Benchmark Suite Breakdown</h3>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '1.5px solid var(--card-border)', color: 'var(--text-tertiary)' }}>
                    <th style={{ padding: '0.6rem 0.4rem' }}>Type</th>
                    <th style={{ padding: '0.6rem 0.4rem' }}>Text</th>
                    <th style={{ padding: '0.6rem 0.4rem', textAlign: 'center' }}>Expected</th>
                    <th style={{ padding: '0.6rem 0.4rem', textAlign: 'center' }}>Predicted</th>
                    <th style={{ padding: '0.6rem 0.4rem', textAlign: 'center' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {benchmarkResults.map((item, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid var(--card-border)' }}>
                      <td style={{ padding: '0.6rem 0.4rem', fontWeight: 600, color: 'var(--text-secondary)' }}>{item.type}</td>
                      <td style={{ padding: '0.6rem 0.4rem', color: 'var(--text-primary)' }}>"{item.text}" ({item.lang})</td>
                      <td style={{ padding: '0.6rem 0.4rem', textAlign: 'center', color: item.expected === 'profane' ? '#ef4444' : '#10b981', fontWeight: 600 }}>
                        {item.expected.toUpperCase()}
                      </td>
                      <td style={{ padding: '0.6rem 0.4rem', textAlign: 'center', color: item.predicted === 'profane' ? '#ef4444' : '#10b981', fontWeight: 600 }}>
                        {item.predicted.toUpperCase()}
                      </td>
                      <td style={{ padding: '0.6rem 0.4rem', textAlign: 'center' }}>
                        <span style={{ color: item.passed ? '#10b981' : '#ef4444', fontWeight: 700 }}>
                          {item.passed ? '✓ PASS' : '✗ FAIL'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Flagged logs queue */}
          <div className="card" style={{ overflowX: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.2rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>Moderator Review Queue</h3>
              <button onClick={fetchLogs} style={{ background: 'none', border: 'none', color: 'var(--speaking)', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600 }}>
                Refresh Logs
              </button>
            </div>

            {logsLoading ? (
              <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Loading flagged queue...</div>
            ) : flaggedLogs.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-tertiary)', fontSize: '0.85rem' }}>No flagged utterances found in database. Run audio sessions to log violations.</div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem', textAlign: 'left', minWidth: '600px' }}>
                <thead>
                  <tr style={{ borderBottom: '1.5px solid var(--card-border)', color: 'var(--text-tertiary)' }}>
                    <th style={{ padding: '0.6rem 0.4rem' }}>Timestamp</th>
                    <th style={{ padding: '0.6rem 0.4rem' }}>Flagged Transcript</th>
                    <th style={{ padding: '0.6rem 0.4rem', textAlign: 'center' }}>Detected By</th>
                    <th style={{ padding: '0.6rem 0.4rem', textAlign: 'center' }}>Language</th>
                    <th style={{ padding: '0.6rem 0.4rem', textAlign: 'center' }}>Moderator Action</th>
                  </tr>
                </thead>
                <tbody>
                  {flaggedLogs.map((log) => (
                    <tr key={log._id} style={{ borderBottom: '1px solid var(--card-border)', opacity: log.isCorrect !== null ? 0.72 : 1 }}>
                      <td style={{ padding: '0.6rem 0.4rem', color: 'var(--text-tertiary)', fontSize: '0.75rem' }}>
                        {new Date(log.timestamp).toLocaleTimeString()}
                      </td>
                      <td style={{ padding: '0.6rem 0.4rem', color: 'var(--text-primary)', fontWeight: 500 }}>
                        "{log.transcript}"
                      </td>
                      <td style={{ padding: '0.6rem 0.4rem', textAlign: 'center' }}>
                        <span className="badge" style={{ fontSize: '0.68rem', padding: '0.1rem 0.4rem', borderRadius: '4px', background: 'rgba(255,255,255,0.05)', color: 'var(--text-secondary)' }}>
                          {log.detectedBy}
                        </span>
                      </td>
                      <td style={{ padding: '0.6rem 0.4rem', textAlign: 'center', fontWeight: 600, textTransform: 'uppercase', fontSize: '0.72rem', color: 'var(--text-tertiary)' }}>
                        {log.language}
                      </td>
                      <td style={{ padding: '0.6rem 0.4rem', textAlign: 'center' }}>
                        {log.isCorrect === null ? (
                          <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'center' }}>
                            <button
                              onClick={() => handleFeedback(log._id, true)}
                              style={{ padding: '0.2rem 0.5rem', fontSize: '0.72rem', background: 'rgba(16, 185, 129, 0.15)', border: '1px solid rgba(16, 185, 129, 0.3)', color: '#10b981', borderRadius: '4px', cursor: 'pointer', fontWeight: 600 }}
                            >
                              Confirm Swear
                            </button>
                            <button
                              onClick={() => handleFeedback(log._id, false)}
                              style={{ padding: '0.2rem 0.5rem', fontSize: '0.72rem', background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#ef4444', borderRadius: '4px', cursor: 'pointer', fontWeight: 600 }}
                            >
                              False Positive
                            </button>
                          </div>
                        ) : (
                          <span style={{
                            color: log.isCorrect ? '#10b981' : '#ef4444',
                            fontWeight: 700,
                            fontSize: '0.75rem',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.2rem'
                          }}>
                            {log.isCorrect ? '✓ Verified Swear' : '✗ Verified False Positive'}
                            <button
                              onClick={() => handleFeedback(log._id, null)}
                              style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', fontSize: '0.7rem', textDecoration: 'underline', padding: 0, marginLeft: '0.4rem' }}
                            >
                              Undo
                            </button>
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </section>
    </>
  );
}

export default About;
