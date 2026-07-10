import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import './shared.css';
import { connectSocket } from '../services/socket';
import { AudioPipeline } from '../audio/AudioPipeline';

import exitBtnAudio from '../../../../Assets/Audio/For-VoiceRoom/Exit-Button.ogg';
import otherParticipantJoinedAudio from '../../../../Assets/Audio/For-VoiceRoom/Other-Participant-Joined.mp3';
import userKickedAudio from '../../../../Assets/Audio/For-VoiceRoom/User-Kicked.ogg';
import userJoinAudio from '../../../../Assets/Audio/For-VoiceRoom/User-join.wav';
import cannotFindRoomAudio from '../../../../Assets/Audio/For-VoiceRoom/cannot-find-room-OR-server-down.wav';

let audioCtx = null;
const soundBuffers = {};

const getAudioContext = () => {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  return audioCtx;
};

const preloadSound = async (src) => {
  if (!src || soundBuffers[src]) return;
  try {
    const response = await fetch(src);
    const arrayBuffer = await response.arrayBuffer();
    const ctx = getAudioContext();
    const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
    soundBuffers[src] = audioBuffer;
  } catch (err) {
    console.warn(`Failed to preload sound: ${src}`, err);
  }
};

const playSound = async (audioSrc) => {
  try {
    const ctx = getAudioContext();
    if (ctx.state === 'suspended') {
      await ctx.resume().catch(() => {});
    }

    const buffer = soundBuffers[audioSrc];
    if (!buffer) {
      // Fallback: standard Audio if buffer is not loaded or fetch failed
      const audio = new Audio(audioSrc);
      audio.volume = 0.45;
      audio.play().catch((err) => console.warn('Audio playback fallback prevented:', err));
      return;
    }

    // Play decoded buffer instantly
    const source = ctx.createBufferSource();
    source.buffer = buffer;

    const gainNode = ctx.createGain();
    gainNode.gain.value = 0.45;

    source.connect(gainNode);
    gainNode.connect(ctx.destination);
    source.start(0);
  } catch (err) {
    console.warn('Failed to play sound via Web Audio API:', err);
  }
};



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

    // Preload voice room sound effects on component mount for zero-latency playback
    useEffect(() => {
      const sounds = [
        exitBtnAudio,
        otherParticipantJoinedAudio,
        userKickedAudio,
        userJoinAudio,
        cannotFindRoomAudio,
      ];
      sounds.forEach((src) => {
        preloadSound(src).catch((err) => {
          console.warn('Error preloading voice room sound:', err);
        });
      });
    }, []);


    useEffect(() => {
      const handleClickOutside = (event) => {
        console.log("handleClickOutside triggered:", event.target);
        if (micGroupRef.current && !micGroupRef.current.contains(event.target)) {
          setShowMicSubmenu(false);
        }
        if (participantGroupRef.current) {
          const contains = participantGroupRef.current.contains(event.target);
          console.log("participantGroupRef contains target:", contains);
          if (!contains) {
            setShowParticipantSubmenu(false);
            setSelectedSubmenuParticipant(null);
          }
        }
      };
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }, []);

  const [participants, setParticipants] = useState([]);
  const [assignedAlias, setAssignedAlias] = useState(alias);
  const [muted, setMuted] = useState(true);
  const [audioDevices, setAudioDevices] = useState([]);
  const [selectedAudioDevice, setSelectedAudioDevice] = useState('');
  const [showMicSubmenu, setShowMicSubmenu] = useState(false);
  const micGroupRef = useRef(null);
  const [showManage, setShowManage] = useState(false);
  const [showParticipantSubmenu, setShowParticipantSubmenu] = useState(false);
  const [selectedSubmenuParticipant, setSelectedSubmenuParticipant] = useState(null);
  const participantGroupRef = useRef(null);
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
  const hasPlayedJoinSoundRef = useRef(false);

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

    // Use raw stream directly if profanity filter is disabled, ensuring maximum audio reliability
    const useRawStream = roomData.profanityFilter === false;
    const streamToSend = useRawStream ? localStreamRef.current : (processedStreamRef.current || localStreamRef.current);
    
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
  }, [roomData.profanityFilter]);

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

    // Redirect to Join Room page if the user accessed the room URL directly without choosing an alias
    if (!location.state?.alias) {
      navigate(`/join/${roomId}`, { replace: true });
      return;
    }

    const currentActiveRoom = localStorage.getItem('wavetone-active-room');
    if (currentActiveRoom && currentActiveRoom !== roomId) {
      navigate(`/join/${roomId}`);
      return;
    }

    const handleDeviceChange = () => {
      navigator.mediaDevices.enumerateDevices().then(devices => {
        const audioInputs = devices.filter(d => d.kind === 'audioinput');
        setAudioDevices(audioInputs);
      });
    };
    navigator.mediaDevices.addEventListener('devicechange', handleDeviceChange);

    // Setup BroadcastChannel for tab-duplication prevention
    let roomChannel = null;
    let duplicateDetected = false;
    const tabId = Math.random().toString(36).substring(2, 15);

    try {
      if (typeof BroadcastChannel !== 'undefined') {
        roomChannel = new BroadcastChannel(`wavetone-room-${roomId}`);
        roomChannel.onmessage = (e) => {
          if (e.data.type === 'PING' && e.data.tabId !== tabId) {
            roomChannel.postMessage({ type: 'PONG', tabId });
          } else if (e.data.type === 'PONG' && e.data.tabId !== tabId) {
            duplicateDetected = true;
            navigate('/browse', { state: { error: 'You are already in this room in another tab of this browser.' } });
          }
        };
        // Ping other tabs
        roomChannel.postMessage({ type: 'PING', tabId });
      }
    } catch (err) {
      console.warn('BroadcastChannel not supported or restricted:', err);
    }

    const init = async () => {
      // Wait briefly for other tabs to reply on the channel
      await new Promise(resolve => setTimeout(resolve, 150));
      if (!active || duplicateDetected) return;

      // Request microphone
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        if (!active) { stream.getTracks().forEach(t => t.stop()); return; }
        localStreamRef.current = stream;
        // Mute mic by default
        stream.getAudioTracks().forEach(track => { track.enabled = false; });
        setupVolumeDetection('self', stream, setSelfSpeaking);

        // Get default device ID
        const currentTrack = stream.getAudioTracks()[0];
        if (currentTrack) {
          setSelectedAudioDevice(currentTrack.getSettings().deviceId || '');
        }

        // Enumerate input devices
        navigator.mediaDevices.enumerateDevices().then(devices => {
          const audioInputs = devices.filter(d => d.kind === 'audioinput');
          setAudioDevices(audioInputs);
        });

        // Set up audio pipeline (always initialized for transcription/Whisper/AI summaries)
        const pipeline = new AudioPipeline({
          rawStream: stream,
          onProfanityDetected: () => {
            if (roomData.profanityFilter !== false) {
              socketRef.current?.emit('profanity-warning', { roomId });
            }
          },
          onServerModerationResult: (result) => {
            if (roomData.profanityFilter !== false) {
              // Handle server moderation response
              if (result.confirmed) {
                console.log('Profanity confirmed by server:', result.badWords);
              } else {
                console.log('Server rejected profanity detection - false positive recovered');
              }
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
      } catch (err) {
        let msg = 'Microphone access error — you can still listen.';
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
          msg = 'Microphone access denied — please allow permission in your browser settings.';
        } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
          msg = 'No microphone detected. Please connect an input device and try again.';
        } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
          msg = 'Microphone is already in use by another tab or application.';
        } else if (err.name === 'OverconstrainedError') {
          msg = 'Microphone hardware does not meet the required constraints.';
        } else if (err.message) {
          msg = `Microphone error: ${err.message}`;
        }
        setMicError(msg);
      }

      // Connect socket and join room
      const socket = connectSocket();
      socketRef.current = socket;

      // Get or generate a persistent unique Device ID for session takeover
      let deviceId = localStorage.getItem('wavetone-device-id');
      if (!deviceId) {
        deviceId = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
        localStorage.setItem('wavetone-device-id', deviceId);
      }

      socket.emit('join-room', { roomId, alias, deviceId });

      // Connection error / Server down
      socket.on('connect_error', () => {
        if (!active) return;
        playSound(cannotFindRoomAudio);
      });

      // Join denied (banned IP)
      socket.on('join-denied', ({ reason }) => {
        if (!active) return;
        playSound(cannotFindRoomAudio);
        navigate('/browse', { state: { error: reason } });
      });

        // Room destroyed or NOT_FOUND error
        socket.on('room-error', ({ code, error }) => {
          if (!active) return;
          playSound(cannotFindRoomAudio);
          if (code === 'NOT_FOUND') {
            navigate('/404');
          } else {
            navigate('/browse', { state: { error: error || 'Room error occurred.' } });
          }
        });

      // Current room users
      socket.on('room-users', (data) => {
        if (!active) return;
        // Handle both array format and object format from server
        const usersList = Array.isArray(data) ? data : (data?.participants || []);
        setParticipants(usersList);
        
        // Find our own assigned alias from the server list using our socket ID
        const selfUser = usersList.find(p => p.socketId === socket.id);
        if (selfUser && selfUser.alias) {
          setAssignedAlias(selfUser.alias);
        }
      });

      // New user joined → initiate offer (no need to update state, room-users event will handle it)
      socket.on('user-joined', async ({ socketId, alias: newAlias }) => {
        if (!active) return;
        playSound(otherParticipantJoinedAudio);
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

      socket.on('user-mute-toggle', ({ socketId, isMuted }) => {
        if (!active) return;
        setParticipants(prev => prev.map(p => p.socketId === socketId ? { ...p, isMuted } : p));
      });

      // Kicked (with reason)
      socket.on('kicked', ({ reason, code } = {}) => {
        if (!active) return;
        
        playSound(userKickedAudio);

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

      // Server detected profanity (trigger retroactive mute)
      socket.on('server-detected-profanity', ({ transcript }) => {
        if (!active) return;
        console.log('Server detected profanity, muting locally...', transcript);
        if (audioPipelineRef.current) {
          audioPipelineRef.current.triggerServerMute();
        }
      });

      // Vote-kick events
      socket.on('vote-kick-active', (data) => {
        if (!active) return;
        setVoteKick(data);
        setVoteKickTimer(data.timeoutSeconds);
        setHasVoted(data.initiatorAlias === assignedAlias);
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

        // Play user-join sound once when current user successfully joins
        if (!hasPlayedJoinSoundRef.current) {
          playSound(userJoinAudio);
          hasPlayedJoinSoundRef.current = true;
        }
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
        if (assignedAlias === newHostAlias) {
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
      socketRef.current?.off('server-detected-profanity');
      socketRef.current?.off('vote-kick-active');
      socketRef.current?.off('vote-kick-update');
      socketRef.current?.off('vote-kick-ended');
      socketRef.current?.off('vote-kick-error');
      socketRef.current?.off('room-metadata');
      socketRef.current?.off('sub-host-assigned');
      socketRef.current?.off('sub-host-revoked');
      socketRef.current?.off('sub-host-promoted');
      socketRef.current?.off('host-promoted');
      socketRef.current?.off('user-mute-toggle');

      navigator.mediaDevices.removeEventListener('devicechange', handleDeviceChange);

      // Close the broadcast channel if created
      if (roomChannel) {
        roomChannel.close();
      }
    };
  }, [roomId, alias, createPeerConnection, navigate]);

  const changeAudioDevice = async (deviceId) => {
    if (!deviceId) return;
    try {
      const constraints = {
        audio: { deviceId: { exact: deviceId } },
        video: false
      };
      const newStream = await navigator.mediaDevices.getUserMedia(constraints);
      
      // Stop current tracks
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(t => t.stop());
      }
      
      localStreamRef.current = newStream;
      setSelectedAudioDevice(deviceId);
      
      // Reset local volume detector
      const selfAnalyser = analyserIntervalsRef.current?.['self'];
      if (selfAnalyser) {
        clearInterval(selfAnalyser.intervalId);
        selfAnalyser.audioCtx.close().catch(() => {});
        delete analyserIntervalsRef.current['self'];
      }
      // If muted is false, new track should be enabled. If muted is true, new track should be disabled.
      newStream.getAudioTracks().forEach(track => { track.enabled = !muted; });
      setupVolumeDetection('self', newStream, setSelfSpeaking);
      
      // Re-create the Audio Pipeline so it binds to the new stream
      if (audioPipelineRef.current) {
        audioPipelineRef.current.destroy();
      }
      
      const pipeline = new AudioPipeline({
        rawStream: newStream,
        onProfanityDetected: () => {
          if (roomData.profanityFilter !== false) {
            socketRef.current?.emit('profanity-warning', { roomId });
          }
        },
        onServerModerationResult: (result) => {
          if (roomData.profanityFilter !== false) {
            if (result.confirmed) {
              console.log('Profanity confirmed by server:', result.badWords);
            } else {
              console.log('Server rejected profanity detection - false positive recovered');
            }
          }
        },
        onPipelineReady: (processed) => {
          processedStreamRef.current = processed;
          
          // Replace track on all active peer connections
          const newTrack = processed.getAudioTracks()[0];
          if (newTrack) {
            newTrack.enabled = !muted;
            Object.values(peerConnectionsRef.current).forEach(pc => {
              const sender = pc.getSenders().find(s => s.track && s.track.kind === 'audio');
              if (sender) {
                sender.replaceTrack(newTrack).catch(err => console.error('Error replacing track:', err));
              }
            });
          }
        },
        onError: () => {
          processedStreamRef.current = newStream;
        },
        socket: socketRef.current
      });
      audioPipelineRef.current = pipeline;
      await pipeline.init();
      
      // Re-sync local speech recognition state
      if (roomData.profanityFilter !== false) {
        audioPipelineRef.current?.toggleSpeechRecognition(muted);
      }
      
    } catch (err) {
      console.error('Error changing audio input device:', err);
    }
  };

  const handleMuteToggle = () => {
    // Resume audio contexts if suspended (browser user-gesture security policy)
    if (audioPipelineRef.current && audioPipelineRef.current.audioContext && audioPipelineRef.current.audioContext.state === 'suspended') {
      audioPipelineRef.current.audioContext.resume().then(() => {
        console.log('AudioContext successfully resumed.');
      }).catch(err => {
        console.warn('Failed to resume AudioContext:', err);
      });
    }
    const selfAnalyser = analyserIntervalsRef.current?.['self'];
    if (selfAnalyser && selfAnalyser.audioCtx && selfAnalyser.audioCtx.state === 'suspended') {
      selfAnalyser.audioCtx.resume().catch(() => {});
    }
    // Toggle mic state
    setMuted(m => {
      const newMuted = !m;
      localStreamRef.current?.getAudioTracks().forEach(t => { t.enabled = !newMuted; });
      // Sync client-side speech recognition state (only if profanity filter is active)
      if (roomData.profanityFilter !== false) {
        audioPipelineRef.current?.toggleSpeechRecognition(newMuted);
      }
      socketRef.current?.emit('toggle-mute', { roomId, isMuted: newMuted });
      return newMuted;
    });
  };

  const handleLeave = useCallback(() => {
    playSound(exitBtnAudio);
    const durationMin = Math.max(1, Math.round((Date.now() - joinTimeRef.current) / 60000));
    const transcripts = audioPipelineRef.current?.getTranscripts() || [];
    socketRef.current?.emit('leave-room', { roomId });
    localStreamRef.current?.getTracks().forEach(t => t.stop());
    Object.values(peerConnectionsRef.current).forEach(pc => pc.close());
    // Build speaking time map with aliases
    const speakingTimes = {};
    speakingTimes[assignedAlias] = Math.round(speakingTimeRef.current['self'] || 0);
    participants.forEach(p => {
      if (p.socketId !== socketRef.current?.id) {
        speakingTimes[p.alias] = Math.round(speakingTimeRef.current[p.socketId] || 0);
      }
    });
    navigate(`/summary/${roomId}`, {
      state: { room: roomData, duration: durationMin, participantCount: participants.length, transcripts, speakingTimes },
    });
  }, [roomId, roomData, assignedAlias, participants, navigate]);

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
  const remoteParticipants = participants.filter(p => p.socketId !== socketRef.current?.id);
  const self = { socketId: 'self', alias: assignedAlias, isSelf: true };
  const allParticipants = [self, ...remoteParticipants];

  return (
    <section className="page-section">
      {/* Header */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', marginBottom: '2rem', gap: '0.8rem' }}>
        <h2 className="voiceroom-title">
          {roomData.topic || 'Voice Room'}
        </h2>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap' }}>
          <span className="badge badge-live"><span className="live-dot" /> Live</span>
          <span className="badge badge-count">{roomData.category || 'General'}</span>
          {warningCount > 0 && (
            <span className="badge" style={{ background: 'rgba(248,113,113,0.15)', color: 'var(--warning)' }}>
              {warningCount}/3 warnings
            </span>
          )}
        </div>
      </div>

      {/* Mic error */}
      {micError && (
        <div style={{ background: 'rgba(248,113,113,0.06)', border: '1.5px solid var(--warning)', borderRadius: '15px', padding: '1.2rem', marginBottom: '1.5rem', color: 'var(--text-primary)', animation: 'fadeIn 0.3s ease' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.8rem', color: 'var(--warning)' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
              <line x1="1" y1="1" x2="23" y2="23"/>
              <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6"/>
              <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2c0 .67-.1 1.32-.27 1.94"/>
            </svg>
            <strong style={{ fontSize: '0.92rem', fontWeight: 700 }}>{micError}</strong>
          </div>
          <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
            <p style={{ margin: '0 0 0.6rem 0', fontWeight: 600 }}>To enable your microphone and start speaking, please follow these steps:</p>
            <ul style={{ margin: 0, paddingLeft: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <li><strong>Chrome:</strong> Click the lock icon 🔒 next to the URL, find <em>Microphone</em>, and toggle it to <strong>Allow</strong>. Refresh the page.</li>
              <li><strong>Safari:</strong> Open <em>Settings for This Website...</em> (Safari menu) and change <em>Microphone</em> access to <strong>Allow</strong>.</li>
              <li><strong>Firefox:</strong> Click the microphone permission block icon in the URL bar, clear the blocked status, and reload the page.</li>
            </ul>
          </div>
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

      {/* Participants grid with Lamp effect */}
      <div className="card participants-card-with-lamp" style={{ marginBottom: '1.2rem' }}>
        {/* Lamp visual effect wrapper */}
        <div className="voice-room-lamp-wrapper">
          <div className="voice-room-lamp-beam-left"></div>
          <div className="voice-room-lamp-beam-right"></div>
          <div className="voice-room-lamp-blur-mid"></div>
          <div className="voice-room-lamp-line"></div>
        </div>

        <div className="card-content-relative">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <h3 style={{ color: 'var(--text-primary)', fontWeight: 700, fontSize: '1rem', margin: 0 }}>
              Participants ({allParticipants.length}/{maxUsers})
            </h3>
            <div ref={participantGroupRef} style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <button
                className="control-btn manage-btn-voiceroom"
                onClick={() => setShowManage(s => !s)}
                title="Manage Participants"
                style={{ width: '40px', height: '40px' }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
              </button>
              <button
                className="mic-submenu-indicator-btn"
                onClick={(e) => {
                  console.log("Indicator button clicked! Stop propagation. Prev state:", showParticipantSubmenu);
                  e.stopPropagation();
                  setShowParticipantSubmenu(prev => !prev);
                }}
                aria-label="Manage Participants Menu"
                style={{ 
                  position: 'absolute',
                  top: '-4px',
                  right: '-4px',
                  width: '18px',
                  height: '18px',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: 0,
                  boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
                  cursor: 'pointer',
                  zIndex: 10,
                  border: 'none'
                }}
              >
                <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="18 15 12 9 6 15"/>
                </svg>
              </button>

              {showParticipantSubmenu && (
                <div 
                  className="mic-submenu" 
                  style={{ right: 0, left: 'auto', transform: 'none', top: 'calc(100% + 8px)', bottom: 'auto' }}
                  onClick={(e) => {
                    console.log("Submenu click event captured (stopping propagation)");
                    e.stopPropagation();
                  }}
                >
                  <div className="mic-submenu-header">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                    {selectedSubmenuParticipant ? selectedSubmenuParticipant.alias : 'Participants'}
                  </div>
                  <div className="mic-submenu-list">
                    {!selectedSubmenuParticipant ? (
                      remoteParticipants.length === 0 ? (
                        <div style={{ padding: '0.55rem 0.75rem', fontSize: '0.78rem', color: 'var(--text-tertiary)', fontWeight: 600 }}>
                          No other participants
                        </div>
                      ) : (
                        remoteParticipants.map(p => {
                          const isSubHost = subHosts.some(s => s.socketId === p.socketId);
                          return (
                            <button
                              key={p.socketId}
                              onClick={(e) => {
                                console.log("Participant clicked:", p.alias);
                                e.stopPropagation();
                                setSelectedSubmenuParticipant(p);
                              }}
                              className="mic-submenu-item"
                            >
                              <span className="mic-submenu-checkmark">
                                {isSubHost && (
                                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fbbf24" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                                  </svg>
                                )}
                              </span>
                              <span className="mic-submenu-label">
                                {p.alias}
                              </span>
                            </button>
                          );
                        })
                      )
                    ) : (
                      <>
                        <button
                          onClick={(e) => {
                            console.log("Back clicked");
                            e.stopPropagation();
                            setSelectedSubmenuParticipant(null);
                          }}
                          className="mic-submenu-item"
                          style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)', borderRadius: '10px 10px 0 0' }}
                        >
                          <span className="mic-submenu-checkmark">
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="15 18 9 12 15 6"/>
                            </svg>
                          </span>
                          <span className="mic-submenu-label">Back</span>
                        </button>

                        {isHost ? (
                          <button
                            onClick={(e) => {
                              console.log("Kick clicked for:", selectedSubmenuParticipant.alias);
                              e.stopPropagation();
                              handleKick(selectedSubmenuParticipant.socketId);
                              setShowParticipantSubmenu(false);
                              setSelectedSubmenuParticipant(null);
                            }}
                            className="mic-submenu-item"
                            style={{ color: '#F87171' }}
                          >
                            <span className="mic-submenu-checkmark" />
                            <span className="mic-submenu-label">Kick</span>
                          </button>
                        ) : (
                          <button
                            disabled
                            className="mic-submenu-item"
                            style={{ opacity: 0.5, cursor: 'not-allowed' }}
                            title="Only the Host can kick directly"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <span className="mic-submenu-checkmark" />
                            <span className="mic-submenu-label">Kick (Host Only)</span>
                          </button>
                        )}

                        <button
                          onClick={(e) => {
                            console.log("Vote kick clicked for:", selectedSubmenuParticipant.alias);
                            e.stopPropagation();
                            handleStartVoteKick(selectedSubmenuParticipant.socketId);
                            setShowParticipantSubmenu(false);
                            setSelectedSubmenuParticipant(null);
                          }}
                          disabled={allParticipants.length < 3}
                          className="mic-submenu-item"
                          style={allParticipants.length < 3 ? { opacity: 0.5, cursor: 'not-allowed' } : {}}
                          title={allParticipants.length < 3 ? 'Vote kick requires at least 3 participants' : 'Vote Kick'}
                        >
                          <span className="mic-submenu-checkmark" />
                          <span className="mic-submenu-label">Vote Kick</span>
                        </button>

                        {isHost && (
                          subHosts.some(s => s.socketId === selectedSubmenuParticipant.socketId) ? (
                            <button
                              onClick={(e) => {
                                console.log("Revoke subhost clicked for:", selectedSubmenuParticipant.alias);
                                e.stopPropagation();
                                handleRevokeSubHost(selectedSubmenuParticipant.socketId);
                                setShowParticipantSubmenu(false);
                                setSelectedSubmenuParticipant(null);
                              }}
                              className="mic-submenu-item"
                              style={{ color: '#fbbf24' }}
                            >
                              <span className="mic-submenu-checkmark" />
                              <span className="mic-submenu-label">Revoke Sub-Host</span>
                            </button>
                          ) : (
                            <button
                              onClick={(e) => {
                                console.log("Make subhost clicked for:", selectedSubmenuParticipant.alias);
                                e.stopPropagation();
                                handleAssignSubHost(selectedSubmenuParticipant.socketId, selectedSubmenuParticipant.alias, subHosts.length);
                                setShowParticipantSubmenu(false);
                                setSelectedSubmenuParticipant(null);
                              }}
                              className="mic-submenu-item"
                              style={{ color: '#fbbf24' }}
                            >
                              <span className="mic-submenu-checkmark" />
                              <span className="mic-submenu-label">Make Sub-Host</span>
                            </button>
                          )
                        )}
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: '1.5rem', padding: '0.5rem 0' }}>
            {allParticipants.map(p => {
              const isSpeaking = p.isSelf
                ? (selfSpeaking && !muted)
                : speakingStates[p.socketId];
              const isMuted = p.isSelf ? muted : (p.isMuted !== false);
              return (
                <div
                  key={p.socketId}
                  className={`participant-card${isSpeaking ? ' speaking' : ''}`}
                  style={{ textAlign: 'center', padding: '1rem', borderRadius: '10px', transition: 'all 0.2s ease', width: 'fit-content', margin: '0 auto', display: 'flex', flexDirection: 'column', alignItems: 'center' }}
                >
                  <div style={{ position: 'relative' }}>
                    <div className={`participant-avatar${isSpeaking ? ' speaking' : ''}`}>
                      {p.alias[0].toUpperCase()}
                    </div>
                    <div 
                      className={`participant-mic-status ${isMuted ? 'muted' : 'unmuted'}`}
                      style={{
                        position: 'absolute',
                        bottom: '-2px',
                        right: '-2px',
                        background: isMuted ? 'var(--warning)' : '#10b981',
                        border: '2px solid var(--surface)',
                        borderRadius: '50%',
                        width: '20px',
                        height: '20px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
                        color: '#ffffff',
                        transition: 'all 0.25s ease'
                      }}
                    >
                      {isMuted ? (
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="1" y1="1" x2="23" y2="23"/><path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6"/><path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2c0 .67-.1 1.32-.27 1.94"/></svg>
                      ) : (
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/></svg>
                      )}
                    </div>
                  </div>
                  <div style={{ marginTop: '0.6rem', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.4rem' }} className={`participant-text${isSpeaking ? ' speaking' : ''}`}>
                    <div className="participant-name">
                      {p.alias}{p.isSelf ? ' (you)' : ''}
                    </div>
                    {isHost && p.isSelf && (
                      <span className="host-tag-label">Host</span>
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
      </div>

      {/* Controls */}
      <div className="voiceroom-controls">
        <div ref={micGroupRef} className="mic-control-group" style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
          <div className="control-btn-wrapper" data-tooltip={muted ? 'Unmute Microphone' : 'Mute Microphone'}>
            <button
              className={`control-btn${!muted ? ' active' : ''} mic-btn-voiceroom`}
              onClick={handleMuteToggle}
              aria-label={muted ? 'Unmute Microphone' : 'Mute Microphone'}
            >
              {muted ? (
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="1" y1="1" x2="23" y2="23"/><path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6"/><path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2c0 .67-.1 1.32-.27 1.94"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>
              ) : (
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>
              )}
            </button>
          </div>
          {audioDevices.length > 0 && (
            <button
              className="mic-submenu-indicator-btn"
              onClick={() => setShowMicSubmenu(prev => !prev)}
              aria-label="Select Input Device"
              style={{ 
                position: 'absolute',
                top: '-4px',
                right: '-4px',
                width: '18px',
                height: '18px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 0,
                boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
                cursor: 'pointer',
                zIndex: 10,
                border: 'none'
              }}
            >
              <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="18 15 12 9 6 15"/>
              </svg>
            </button>
          )}

          {/* Custom Popover Submenu */}
          {showMicSubmenu && audioDevices.length > 0 && (
            <div className="mic-submenu">
              <div className="mic-submenu-header">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/></svg>
                Input Device
              </div>
              <div className="mic-submenu-list">
                {audioDevices.map(device => {
                  const isSelected = selectedAudioDevice === device.deviceId;
                  return (
                    <button
                      key={device.deviceId}
                      onClick={() => {
                        changeAudioDevice(device.deviceId);
                        setShowMicSubmenu(false);
                      }}
                      className={`mic-submenu-item${isSelected ? ' selected' : ''}`}
                    >
                      <span className="mic-submenu-checkmark">
                        {isSelected && (
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="var(--speaking)" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                        )}
                      </span>
                      <span className="mic-submenu-label">
                        {device.label || `Microphone ${device.deviceId.slice(0, 5)}`}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
        <div className="control-btn-wrapper" data-tooltip={linkCopied ? 'Link Copied!' : 'Copy Room Link'}>
          <button
            className={`control-btn${linkCopied ? ' active' : ''} copy-btn-voiceroom`}
            onClick={handleCopyLink}
            aria-label={linkCopied ? 'Link Copied!' : 'Copy Room Link'}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect className="copy-rect" x="9" y="9" width="13" height="13" rx="2"/>
              <path className="copy-path" d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
            </svg>
          </button>
        </div>
        <div className="control-btn-wrapper" data-tooltip="Leave Room">
          <button
            className="control-btn exit-btn-voiceroom"
            onClick={handleLeave}
            aria-label="Leave Room"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
          </button>
        </div>
      </div>
    </section>
  );
}

export default VoiceRoom;
