import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import './shared.css';
import { connectSocket } from '../services/socket';
import { AudioPipeline } from '../audio/AudioPipeline';

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};

function VoiceRoom() {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  const alias = location.state?.alias || 'Guest';
  const roomData = location.state?.room || {};
  const maxUsers = roomData.maxUsers || 10;

    useEffect(() => {
      document.title = `Room | ${roomId}`;
      document.body.setAttribute('data-route', 'voice-room');
      return () => {
        document.body.removeAttribute('data-route');
      };
    }, [roomId]);

    useEffect(() => {
      localStorage.setItem('wavetone-active-room', roomId);
      const handleUnload = () => {
        if (localStorage.getItem('wavetone-active-room') === roomId) {
          localStorage.removeItem('wavetone-active-room');
        }
      };
      window.addEventListener('beforeunload', handleUnload);
      return () => {
        window.removeEventListener('beforeunload', handleUnload);
        if (localStorage.getItem('wavetone-active-room') === roomId) {
          localStorage.removeItem('wavetone-active-room');
        }
      };
    }, [roomId]);

  const [participants, setParticipants] = useState([]);
  const [muted, setMuted] = useState(true);
  const [showManage, setShowManage] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [speakingStates, setSpeakingStates] = useState({});
  const [selfSpeaking, setSelfSpeaking] = useState(false);
  const [micError, setMicError] = useState(null);
  const [warningCount, setWarningCount] = useState(0);
  const [warningToast, setWarningToast] = useState(null);
  const [toastType, setToastType] = useState('warning'); // 'warning', 'kick', 'info'

  // Sub-Host state
  const [isHost, setIsHost] = useState(false);
  const [subHosts, setSubHosts] = useState([]);
  const [subHostToAssign, setSubHostToAssign] = useState(null);

  // Vote-kick state
  const [voteKick, setVoteKick] = useState(null);
  const [voteKickTimer, setVoteKickTimer] = useState(30);
  const [hasVoted, setHasVoted] = useState(false);

  const socketRef = useRef(null);
  const localStreamRef = useRef(null);
  const processedStreamRef = useRef(null);
  const audioPipelineRef = useRef(null);
  const peerConnectionsRef = useRef({});
  const analyserIntervalsRef = useRef({});
  const joinTimeRef = useRef(Date.now());
  const speakingTimeRef = useRef({});  // id → seconds of speaking time

  // --- Volume detection + speaking time tracking ---
  const setupVolumeDetection = (id, stream, setter) => {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      source.connect(analyser);
      const data = new Uint8Array(analyser.frequencyBinCount);
      if (!speakingTimeRef.current[id]) speakingTimeRef.current[id] = 0;
      const intervalId = setInterval(() => {
        analyser.getByteFrequencyData(data);
        const avg = data.reduce((a, b) => a + b, 0) / data.length;
        if (avg > 10) speakingTimeRef.current[id] += 0.1; // 100ms interval = 0.1s
        setter(avg > 10);
      }, 100);
      analyserIntervalsRef.current[id] = { intervalId, audioCtx: ctx };
    } catch { /* AudioContext not available */ }
  };

  // --- Create RTCPeerConnection for a remote peer ---
  const createPeerConnection = useCallback((targetSocketId) => {
    const pc = new RTCPeerConnection(ICE_SERVERS);

    // Use processed stream (through profanity gate) or raw stream as fallback
    const streamToSend = processedStreamRef.current || localStreamRef.current;
    if (streamToSend) {
      streamToSend.getTracks().forEach(track =>
        pc.addTrack(track, streamToSend)
      );
    }

    pc.onicecandidate = (event) => {
      if (event.candidate && socketRef.current) {
        socketRef.current.emit('ice-candidate', {
          candidate: event.candidate,
          targetSocketId,
        });
      }
    };

    pc.ontrack = (event) => {
      const remoteStream = event.streams[0];
      const audio = new Audio();
      audio.srcObject = remoteStream;
      audio.autoplay = true;
      audio.play().catch(() => {});
      setupVolumeDetection(
        targetSocketId,
        remoteStream,
        (speaking) => setSpeakingStates(prev => ({ ...prev, [targetSocketId]: speaking }))
      );
    };

    peerConnectionsRef.current[targetSocketId] = pc;
    return pc;
  }, []);

  // --- Cleanup a peer connection ---
  const cleanupPeer = (socketId) => {
    if (peerConnectionsRef.current[socketId]) {
      peerConnectionsRef.current[socketId].close();
      delete peerConnectionsRef.current[socketId];
    }
    const entry = analyserIntervalsRef.current[socketId];
    if (entry) {
      clearInterval(entry.intervalId);
      entry.audioCtx.close().catch(() => {});
      delete analyserIntervalsRef.current[socketId];
    }
    setSpeakingStates(prev => { const s = { ...prev }; delete s[socketId]; return s; });
  };

  // --- Vote-kick timer countdown ---
  useEffect(() => {
    if (!voteKick) return;
    const interval = setInterval(() => {
      setVoteKickTimer(prev => {
        if (prev <= 1) { clearInterval(interval); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [voteKick]);

  // --- Main effect: mic + pipeline + socket + signaling ---
  useEffect(() => {
    let active = true;

    const currentActiveRoom = localStorage.getItem('wavetone-active-room');
    if (currentActiveRoom && currentActiveRoom !== roomId) {
      navigate(`/join/${roomId}`);
      return;
    }

    const init = async () => {
      // Request microphone
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        if (!active) { stream.getTracks().forEach(t => t.stop()); return; }
        localStreamRef.current = stream;
        // Mute mic by default
        stream.getAudioTracks().forEach(track => { track.enabled = false; });
        setupVolumeDetection('self', stream, setSelfSpeaking);

        // Set up audio profanity pipeline if room has filter enabled
        const filterEnabled = roomData.profanityFilter !== false;
        if (filterEnabled) {
          const pipeline = new AudioPipeline({
            rawStream: stream,
            onProfanityDetected: () => {
              socketRef.current?.emit('profanity-warning', { roomId });
            },
            onServerModerationResult: (result) => {
              // Handle server moderation response
              if (result.confirmed) {
                console.log('Profanity confirmed by server:', result.badWords);
              } else {
                console.log('Server rejected profanity detection - false positive recovered');
              }
            },
            onPipelineReady: (processed) => {
              processedStreamRef.current = processed;
            },
            onError: () => {
              processedStreamRef.current = stream;
            },
            socket: socketRef.current // pass socket for hybrid moderation
          });
          audioPipelineRef.current = pipeline;
          await pipeline.init();
        } else {
          processedStreamRef.current = stream;
        }
      } catch {
        setMicError('Microphone access denied — you can still listen.');
      }

      // Connect socket and join room
      const socket = connectSocket();
      socketRef.current = socket;
      socket.emit('join-room', { roomId, alias });

      // Join denied (banned IP)
      socket.on('join-denied', ({ reason }) => {
        if (!active) return;
        navigate('/browse', { state: { error: reason } });
      });

        // Room destroyed or NOT_FOUND error
        socket.on('room-error', ({ code, error }) => {
          if (!active) return;
          if (code === 'NOT_FOUND') {
            // Redirect to 404 page if route exists, else to app domain
            navigate('/404');
          } else {
            // fallback: redirect to app domain
            window.location.href = 'https://wave-tone-mini-project.vercel.app/';
          }
        });

      // Current room users
      socket.on('room-users', (data) => {
        if (!active) return;
        // Handle both array format and object format from server
        const usersList = Array.isArray(data) ? data : (data?.participants || []);
        setParticipants(usersList);
      });

      // New user joined → initiate offer (no need to update state, room-users event will handle it)
      socket.on('user-joined', async ({ socketId, alias: newAlias }) => {
        if (!active) return;
        const pc = createPeerConnection(socketId);
        try {
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          socket.emit('offer', { offer, targetSocketId: socketId });
        } catch { /* negotiation error */ }
      });

      // Received offer → answer it
      socket.on('offer', async ({ offer, fromSocketId }) => {
        if (!active) return;
        const pc = createPeerConnection(fromSocketId);
        try {
          await pc.setRemoteDescription(new RTCSessionDescription(offer));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          socket.emit('answer', { answer, targetSocketId: fromSocketId });
        } catch { /* negotiation error */ }
      });

      socket.on('answer', async ({ answer, fromSocketId }) => {
        const pc = peerConnectionsRef.current[fromSocketId];
        if (pc) {
          try { await pc.setRemoteDescription(new RTCSessionDescription(answer)); } catch { }
        }
      });

      socket.on('ice-candidate', async ({ candidate, fromSocketId }) => {
        const pc = peerConnectionsRef.current[fromSocketId];
        if (pc) {
          try { await pc.addIceCandidate(new RTCIceCandidate(candidate)); } catch { }
        }
      });

      socket.on('user-left', ({ socketId }) => {
        if (!active) return;
        setParticipants(prev => prev.filter(p => p.socketId !== socketId));
        cleanupPeer(socketId);
      });

      // Kicked (with reason)
      socket.on('kicked', ({ reason, code } = {}) => {
        if (!active) return;
        
        // Show kick notification before redirect with emphasis
        setWarningToast(reason || 'You were removed from the room.');
        setToastType('kick');
        
        // Log the kick details
        console.log('🚫 Kicked from room:', {
          reason,
          code,
          timestamp: new Date().toISOString()
        });
        
        // Redirect after 3 seconds so user can read the message
        setTimeout(() => {
          navigate('/', { state: { kickReason: reason || 'You were removed from the room.', kickCode: code } });
        }, 3000);
      });

      // Profanity warning issued
      socket.on('warning-issued', ({ count, maxWarnings }) => {
        if (!active) return;
        setWarningCount(count);
        setWarningToast(`Profanity warning ${count}/${maxWarnings}. Watch your language!`);
        setToastType('warning');
        setTimeout(() => setWarningToast(null), 4000);
      });

      // Vote-kick events
      socket.on('vote-kick-active', (data) => {
        if (!active) return;
        setVoteKick(data);
        setVoteKickTimer(data.timeoutSeconds);
        setHasVoted(data.initiatorAlias === alias);
      });

      socket.on('vote-kick-update', ({ currentVotes, requiredVotes, totalVoters }) => {
        if (!active) return;
        setVoteKick(prev => prev ? { ...prev, currentVotes, requiredVotes, totalVoters } : null);
      });

      socket.on('vote-kick-ended', () => {
        if (!active) return;
        setVoteKick(null);
        setHasVoted(false);
      });

      socket.on('vote-kick-error', ({ message }) => {
        if (!active) return;
        setWarningToast(message);
        setToastType('warning');
        setTimeout(() => setWarningToast(null), 3000);
      });

      // Room metadata including Host and Sub-Host info
      socket.on('room-metadata', ({ isHost: hostStatus, subHosts: subHostList }) => {
        if (!active) return;
        setIsHost(hostStatus);
        setSubHosts(subHostList || []);
      });

      // Sub-Host assigned
      socket.on('sub-host-assigned', ({ targetSocketId, subHostAlias, rank }) => {
        if (!active) return;
        setSubHosts(prev => [...prev, { socketId: targetSocketId, alias: subHostAlias, rank }].sort((a, b) => a.rank - b.rank));
        setWarningToast(`${subHostAlias} is now a Sub-Host!`);
        setToastType('info');
        setTimeout(() => setWarningToast(null), 3000);
      });

      // Sub-Host revoked
      socket.on('sub-host-revoked', ({ targetSocketId, formerSubHostAlias }) => {
        if (!active) return;
        setSubHosts(prev => prev.filter(s => s.socketId !== targetSocketId));
        setWarningToast(`${formerSubHostAlias}'s Sub-Host status revoked.`);
        setToastType('info');
        setTimeout(() => setWarningToast(null), 3000);
      });

      // Sub-Host promoted to Host
      socket.on('sub-host-promoted', ({ newHostAlias }) => {
        if (!active) return;
        setIsHost(false);
        setSubHosts(prev => prev.filter(s => s.alias !== newHostAlias));
        setWarningToast(`${newHostAlias} promoted to Host!`);
        setToastType('info');
        setTimeout(() => setWarningToast(null), 3000);
      });

      // Host left and Sub-Host auto-promoted (automatic after timeout)
      socket.on('host-promoted', ({ newHostAlias, subHosts }) => {
        if (!active) return;
        // Update current user's Host status if they're the one being promoted
        if (alias === newHostAlias) {
          setIsHost(true);
          setSubHosts(subHosts || []);
          setWarningToast(`You are now the Host!`);
        } else {
          // Update UI to show new Host and remaining Sub-Hosts
          setSubHosts(subHosts || []);
          setWarningToast(`${newHostAlias} is now the Host!`);
        }
        setToastType('info');
        setTimeout(() => setWarningToast(null), 3000);
      });
    };

    init();

    return () => {
      active = false;
      audioPipelineRef.current?.destroy();
      localStreamRef.current?.getTracks().forEach(t => t.stop());
      Object.values(peerConnectionsRef.current).forEach(pc => pc.close());
      Object.values(analyserIntervalsRef.current).forEach(entry => {
        clearInterval(entry.intervalId);
        entry.audioCtx.close().catch(() => {});
      });
      socketRef.current?.emit('leave-room', { roomId });
      socketRef.current?.off('join-denied');
      socketRef.current?.off('room-users');
      socketRef.current?.off('user-joined');
      socketRef.current?.off('offer');
      socketRef.current?.off('answer');
      socketRef.current?.off('ice-candidate');
      socketRef.current?.off('user-left');
      socketRef.current?.off('kicked');
      socketRef.current?.off('warning-issued');
      socketRef.current?.off('vote-kick-active');
      socketRef.current?.off('vote-kick-update');
      socketRef.current?.off('vote-kick-ended');
      socketRef.current?.off('vote-kick-error');
      socketRef.current?.off('room-metadata');
      socketRef.current?.off('sub-host-assigned');
      socketRef.current?.off('sub-host-revoked');
      socketRef.current?.off('sub-host-promoted');
      socketRef.current?.off('host-promoted');
    };
  }, [roomId, alias, createPeerConnection, navigate]);

  const handleMuteToggle = () => {
    // Toggle mic state
    setMuted(m => {
      const newMuted = !m;
      localStreamRef.current?.getAudioTracks().forEach(t => { t.enabled = !newMuted; });
      return newMuted;
    });
  };

  const handleLeave = useCallback(() => {
    const durationMin = Math.max(1, Math.round((Date.now() - joinTimeRef.current) / 60000));
    const transcripts = audioPipelineRef.current?.getTranscripts() || [];
    socketRef.current?.emit('leave-room', { roomId });
    localStreamRef.current?.getTracks().forEach(t => t.stop());
    Object.values(peerConnectionsRef.current).forEach(pc => pc.close());
    // Build speaking time map with aliases
    const speakingTimes = {};
    speakingTimes[alias] = Math.round(speakingTimeRef.current['self'] || 0);
    participants.forEach(p => {
      if (p.alias !== alias) {
        speakingTimes[p.alias] = Math.round(speakingTimeRef.current[p.socketId] || 0);
      }
    });
    navigate(`/summary/${roomId}`, {
      state: { room: roomData, duration: durationMin, participantCount: participants.length, transcripts, speakingTimes },
    });
  }, [roomId, roomData, alias, participants, navigate]);

  useEffect(() => {
    const handleStorageChange = (e) => {
      if (e.key === 'wavetone-leave-room-signal' && e.newValue === roomId) {
        localStorage.removeItem('wavetone-leave-room-signal');
        handleLeave();
      }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [roomId, handleLeave]);

  const handleCopyLink = () => {
    const link = `${window.location.origin}/join/${roomId}`;
    navigator.clipboard.writeText(link).then(() => {
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    });
  };

  const handleKick = (socketId) => {
    socketRef.current?.emit('kick-user', { roomId, targetSocketId: socketId });
    setParticipants(prev => prev.filter(p => p.socketId !== socketId));
    cleanupPeer(socketId);
  };

  const handleStartVoteKick = (targetSocketId) => {
    socketRef.current?.emit('vote-kick-start', { roomId, targetSocketId });
  };

  const handleCastVote = (vote) => {
    socketRef.current?.emit('vote-kick-cast', { roomId, vote });
    setHasVoted(true);
  };

  const handleAssignSubHost = (socketId, participantAlias, rank = 0) => {
    socketRef.current?.emit('assign-sub-host', { roomId, targetSocketId: socketId, targetAlias: participantAlias, rank });
    setSubHostToAssign(null);
  };

  const handleRevokeSubHost = (socketId) => {
    const subHost = subHosts.find(s => s.socketId === socketId);
    if (subHost) {
      socketRef.current?.emit('revoke-sub-host', { roomId, targetSocketId: socketId, targetAlias: subHost.alias });
    }
  };

  const handlePromoteSubHost = (socketId) => {
    const subHost = subHosts.find(s => s.socketId === socketId);
    if (subHost) {
      socketRef.current?.emit('promote-sub-host', { roomId, targetSocketId: socketId, targetAlias: subHost.alias });
    }
  };

  // Build participant list: self + remote participants (exclude self from server list)
  const remoteParticipants = participants.filter(p => p.alias !== alias);
  const self = { socketId: 'self', alias, isSelf: true };
  const allParticipants = [self, ...remoteParticipants];

  return (
    <section className="page-section">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '0.5rem' }}>
        <div>
          <h2 className="page-title" style={{ marginBottom: '0.2rem' }}>
            {roomData.topic || 'Voice Room'}
          </h2>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <span className="badge badge-live"><span className="live-dot" /> Live</span>
            <span className="badge badge-count">{roomData.category || 'General'}</span>
            {warningCount > 0 && (
              <span className="badge" style={{ background: 'rgba(248,113,113,0.15)', color: 'var(--warning)' }}>
                {warningCount}/3 warnings
              </span>
            )}
          </div>
        </div>
        <button
          onClick={handleCopyLink}
          style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.5rem 1rem', background: linkCopied ? 'rgba(56,189,248,0.15)' : 'transparent', border: `1.5px solid ${linkCopied ? 'var(--speaking)' : 'var(--card-border)'}`, borderRadius: '8px', color: linkCopied ? 'var(--speaking)' : 'var(--text-secondary)', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600, transition: 'all 0.2s ease' }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            {linkCopied
              ? <><polyline points="20 6 9 17 4 12"/></>
              : <><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></>
            }
          </svg>
          {linkCopied ? 'Copied!' : 'Copy Link'}
        </button>
      </div>

      {/* Mic error */}
      {micError && (
        <div style={{ background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.3)', borderRadius: '8px', padding: '0.6rem 1rem', marginBottom: '1rem', color: 'var(--warning)', fontSize: '0.82rem' }}>
          {micError}
        </div>
      )}

      {/* Warning/Kick toast */}
      {warningToast && (
        <div style={{
          background: toastType === 'kick' ? 'rgba(239,68,68,0.15)' : toastType === 'info' ? 'rgba(251,191,36,0.12)' : 'rgba(248,113,113,0.1)',
          border: `1.5px solid ${toastType === 'kick' ? '#ef4444' : toastType === 'info' ? '#fbbf24' : 'var(--warning)'}`,
          borderRadius: '8px',
          padding: toastType === 'kick' ? '0.8rem 1.2rem' : '0.6rem 1rem',
          marginBottom: '1rem',
          color: toastType === 'kick' ? '#ef4444' : toastType === 'info' ? '#fbbf24' : 'var(--warning)',
          fontSize: toastType === 'kick' ? '0.95rem' : '0.85rem',
          fontWeight: toastType === 'kick' ? 700 : 600,
          animation: 'fadeIn 0.3s ease',
          display: 'flex',
          alignItems: 'center',
          gap: '0.6rem'
        }}>
          {toastType === 'kick' && (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/>
              <line x1="15" y1="9" x2="9" y2="15"/>
              <line x1="9" y1="9" x2="15" y2="15"/>
            </svg>
          )}
          {toastType === 'info' && (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z"/><path d="M12 7v5"/><path d="M12 17h.01"/>
            </svg>
          )}
          {warningToast}
        </div>
      )}

      {/* Vote-kick banner */}
      {voteKick && (
        <div className="card" style={{ marginBottom: '1.2rem', border: '1.5px solid var(--warning)', background: 'rgba(248,113,113,0.05)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.8rem' }}>
            <h4 style={{ margin: 0, color: 'var(--text-primary)', fontWeight: 700, fontSize: '0.95rem' }}>
              Vote Kick: {voteKick.targetAlias}
            </h4>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', fontWeight: 600 }}>
              {voteKickTimer}s
            </span>
          </div>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '0.8rem' }}>
            {voteKick.initiatorAlias} wants to remove {voteKick.targetAlias}. {voteKick.currentVotes}/{voteKick.requiredVotes} votes needed.
          </p>
          {/* Progress bar */}
          <div style={{ background: 'var(--card-border)', borderRadius: '4px', height: '6px', marginBottom: '0.8rem', overflow: 'hidden' }}>
            <div style={{
              width: `${Math.min((voteKick.currentVotes / voteKick.requiredVotes) * 100, 100)}%`,
              background: 'var(--warning)', height: '100%', borderRadius: '4px', transition: 'width 0.3s ease'
            }} />
          </div>
          {!hasVoted ? (
            <div style={{ display: 'flex', gap: '0.6rem' }}>
              <button onClick={() => handleCastVote('yes')}
                style={{ flex: 1, padding: '0.5rem', background: 'rgba(248,113,113,0.15)', border: '1px solid rgba(248,113,113,0.3)', color: 'var(--warning)', borderRadius: '8px', fontWeight: 600, cursor: 'pointer', fontSize: '0.82rem' }}>
                Remove
              </button>
              <button onClick={() => handleCastVote('no')}
                style={{ flex: 1, padding: '0.5rem', background: 'var(--card-border)', border: '1px solid var(--card-border)', color: 'var(--text-secondary)', borderRadius: '8px', fontWeight: 600, cursor: 'pointer', fontSize: '0.82rem' }}>
                Keep
              </button>
            </div>
          ) : (
            <p style={{ fontSize: '0.82rem', color: 'var(--text-tertiary)', textAlign: 'center', fontWeight: 600, margin: 0 }}>
              Vote cast. Waiting for others...
            </p>
          )}
        </div>
      )}

      {/* Participants grid */}
      <div className="card" style={{ marginBottom: '1.2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
          <h3 style={{ color: 'var(--text-primary)', fontWeight: 700, fontSize: '1rem', margin: 0 }}>
            Participants ({allParticipants.length}/{maxUsers})
          </h3>
          <button
            className="control-btn"
            onClick={() => setShowManage(s => !s)}
            title="Manage Participants"
            style={{ width: '40px', height: '40px' }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: '1.5rem', padding: '0.5rem 0' }}>
          {allParticipants.map(p => {
            const isSpeaking = p.isSelf
              ? (selfSpeaking && !muted)
              : speakingStates[p.socketId];
            return (
              <div
                key={p.socketId}
                className={`participant-card${isSpeaking ? ' speaking' : ''}`}
                style={{ textAlign: 'center', padding: '1rem', borderRadius: '10px', transition: 'all 0.2s ease', width: 'fit-content', margin: '0 auto', display: 'flex', flexDirection: 'column', alignItems: 'center' }}
              >
                <div className={`participant-avatar${isSpeaking ? ' speaking' : ''}`}>
                  {p.alias[0].toUpperCase()}
                </div>
                <div style={{ marginTop: '0.6rem', fontSize: '0.8rem', color: isSpeaking ? 'var(--speaking)' : 'var(--text-tertiary)', fontWeight: 600, marginBottom: '0.4rem' }} className={`participant-text${isSpeaking ? ' speaking' : ''}`}>
                  <div className="participant-name">
                    {p.alias}{p.isSelf ? ' (you)' : ''}
                  </div>
                  {isHost && p.isSelf && (
                    <span style={{ display: 'block', fontSize: '0.65rem', color: 'var(--speaking)', opacity: 0.7, marginTop: '0.1rem' }}>Host</span>
                  )}
                  {subHosts.some(s => s.socketId === p.socketId) && (
                    <span style={{ display: 'block', fontSize: '0.65rem', color: '#fbbf24', opacity: 0.9, marginTop: '0.1rem' }}>⭐ Sub-Host</span>
                  )}
                </div>
                {showManage && !p.isSelf && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                    {isHost && (
                      <button
                        onClick={() => handleKick(p.socketId)}
                        style={{ fontSize: '0.7rem', padding: '0.3rem 0.6rem', background: 'rgba(248,113,113,0.2)', border: '1px solid rgba(248,113,113,0.4)', color: '#F87171', borderRadius: '4px', cursor: 'pointer', width: '100%', fontWeight: 600 }}
                        onMouseEnter={(e) => { e.target.style.background = '#F87171'; e.target.style.color = '#fff'; }}
                        onMouseLeave={(e) => { e.target.style.background = 'rgba(248,113,113,0.2)'; e.target.style.color = '#F87171'; }}
                      >
                        Kick
                      </button>
                    )}
                    {!isHost && (
                      <button
                        disabled
                        style={{ fontSize: '0.7rem', padding: '0.3rem 0.6rem', background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.1)', color: '#aaa', borderRadius: '4px', cursor: 'not-allowed', width: '100%', fontWeight: 600 }}
                        title="Only the Host can kick directly"
                      >
                        Kick
                      </button>
                    )}
                    <button
                      onClick={() => handleStartVoteKick(p.socketId)}
                      disabled={allParticipants.length < 3}
                      style={{ fontSize: '0.7rem', padding: '0.3rem 0.6rem', background: allParticipants.length < 3 ? 'rgba(56,189,248,0.08)' : 'rgba(56,189,248,0.15)', border: '1px solid rgba(56,189,248,0.3)', color: allParticipants.length < 3 ? '#aaa' : 'var(--speaking)', borderRadius: '4px', cursor: allParticipants.length < 3 ? 'not-allowed' : 'pointer', width: '100%', fontWeight: 600 }}
                      title={allParticipants.length < 3 ? 'Vote kick requires at least 3 participants' : 'Vote Kick'}
                    >
                      Vote Kick
                    </button>
                    {isHost && (
                      <>
                        {subHosts.some(s => s.socketId === p.socketId) ? (
                          <button
                            onClick={() => handleRevokeSubHost(p.socketId)}
                            style={{ fontSize: '0.7rem', padding: '0.3rem 0.6rem', background: 'rgba(251, 191, 36, 0.2)', border: '1px solid rgba(251, 191, 36, 0.4)', color: '#fbbf24', borderRadius: '4px', cursor: 'pointer', width: '100%', fontWeight: 600 }}
                            onMouseEnter={(e) => { e.target.style.background = '#fbbf24'; e.target.style.color = '#000'; }}
                            onMouseLeave={(e) => { e.target.style.background = 'rgba(251, 191, 36, 0.2)'; e.target.style.color = '#fbbf24'; }}
                          >
                            Revoke Sub-Host
                          </button>
                        ) : (
                          <button
                            onClick={() => handleAssignSubHost(p.socketId, p.alias, subHosts.length)}
                            style={{ fontSize: '0.7rem', padding: '0.3rem 0.6rem', background: 'rgba(251, 191, 36, 0.15)', border: '1px solid rgba(251, 191, 36, 0.3)', color: '#fbbf24', borderRadius: '4px', cursor: 'pointer', width: '100%', fontWeight: 600 }}
                            onMouseEnter={(e) => { e.target.style.background = 'rgba(251, 191, 36, 0.25)'; }}
                            onMouseLeave={(e) => { e.target.style.background = 'rgba(251, 191, 36, 0.15)'; }}
                          >
                            Make Sub-Host
                          </button>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Controls */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', marginTop: '0.5rem' }}>
        <button
          className={`control-btn${!muted ? ' active' : ''} mic-btn-voiceroom`}
          onClick={handleMuteToggle}
          title={muted ? 'Unmute' : 'Mute'}
        >
          {muted ? (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="1" y1="1" x2="23" y2="23"/><path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6"/><path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2c0 .67-.1 1.32-.27 1.94"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>
          ) : (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>
          )}
        </button>
        <button
          className="control-btn danger exit-btn-voiceroom"
          onClick={handleLeave}
          title="Leave Room"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
        </button>
      </div>
    </section>
  );
}

export default VoiceRoom;
