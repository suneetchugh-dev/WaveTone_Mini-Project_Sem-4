import express from 'express';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import connectDB from './src/db.js';
import cors from 'cors';
import dotenv from 'dotenv';
import roomRoutes from './src/routes/roomRoutes.js';
import roomDetailsRoutes from './src/routes/roomDetailsRoutes.js';
import summaryRoutes from './src/routes/summaryRoutes.js';
import Room from './src/models/Room.js';
import { containsProfanity, filterProfanity, extractProfanityWords, getProfanityWords } from './src/utils/profanityFilter.js';

dotenv.config();
connectDB();

const app = express();

const server = http.createServer(app);
const allowedOrigins = [
  'https://wave-tone-mini-project.vercel.app',
  'https://wavetone.vercel.app',
  'http://localhost:5173',
  'http://127.0.0.1:5173'
];
const io = new SocketIOServer(server, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST']
  }
});

app.use(cors({
  origin: allowedOrigins,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  credentials: true
}));
app.use(express.json());

// API routes
app.get('/', (req, res) => res.send('WaveTone backend running'));
app.use('/api/rooms', roomRoutes);
app.use('/api/rooms', roomDetailsRoutes);
app.use('/api/sessions', summaryRoutes);

// --- Socket.io in-memory state ---
const roomParticipants = new Map();  // roomId → [{socketId, alias}]
const socketAliases = new Map();     // socketId → alias
const roomBannedIPs = new Map();     // roomId → Set<ip>
const globalBannedIPs = new Set();   // Global IPs banned from all rooms (persistent across sessions)
const socketWarnings = new Map();    // socketId → { count, lastTimestamp }
const activeVotes = new Map();       // roomId → { targetSocketId, targetAlias, initiatorAlias, votes: Set, startTime, timeout }

const MAX_WARNINGS = 3;
const WARNING_AUTO_VOTE_THRESHOLD = 2; // Auto-start vote-kick after 2 warnings
const WARNING_RATE_LIMIT_MS = 500; // Reduced from 2000ms for faster detection
const VOTE_TIMEOUT_MS = 30000;
const VOTE_THRESHOLD = 0.7;
const HOST_RETURN_TIMEOUT_MS = 300000; // 5 minutes for Host to return before Sub-Host promotion

// Host and Sub-Host state
const roomHosts = new Map(); // roomId → { socketId, alias }
const roomSubHosts = new Map(); // roomId → [{ socketId, alias, rank }]
const hostTimeoutHandles = new Map(); // roomId → timeoutHandle

function _getIP(socket) {
  return socket.handshake.headers['x-forwarded-for']?.split(',')[0]?.trim()
    || socket.handshake.address;
}

function _banAndKick(socket, roomId, reason, isGlobalBan = false) {
  const ip = _getIP(socket);
  if (!roomBannedIPs.has(roomId)) roomBannedIPs.set(roomId, new Set());
  roomBannedIPs.get(roomId).add(ip);
  if (isGlobalBan) {
    globalBannedIPs.add(ip);
    console.log(`IP ${ip} added to global ban list`);
  }
  
  // Professional kick message
  const professionalkickMsg = `You have been removed from the room: ${reason}`;
  socket.emit('kicked', { 
    reason: professionalkickMsg,
    code: 'KICK_REMOVED',
    timestamp: new Date().toISOString()
  });
  _leaveRoom(socket, roomId);
}

function _promoteSubHostToHost(roomId) {
  console.log(`[DEBUG] _promoteSubHostToHost called for room ${roomId}`);
  console.log(`[DEBUG] roomSubHosts.has(${roomId}): ${roomSubHosts.has(roomId)}`);
  
  if (!roomSubHosts.has(roomId)) {
    console.log(`[DEBUG] No sub-hosts map for room ${roomId}, returning`);
    return;
  }
  const subHosts = roomSubHosts.get(roomId);
  console.log(`[DEBUG] Sub-Hosts in room ${roomId}:`, subHosts);
  
  if (subHosts.length > 0) {
    // Promote highest-ranking (lowest index) sub-host
    const newHost = subHosts[0];
    console.log(`[DEBUG] Promoting ${newHost.alias} to Host in room ${roomId}`);
    roomHosts.set(roomId, { socketId: newHost.socketId, alias: newHost.alias });
    subHosts.shift(); // Remove from sub-hosts list
    
    io.to(roomId).emit('host-promoted', {
      newHostAlias: newHost.alias,
      reason: 'Previous Host left the room',
      subHosts: subHosts
    });
    
    console.log(`Sub-Host ${newHost.alias} promoted to Host in room ${roomId}`);
  } else {
    console.log(`[DEBUG] No sub-hosts available for promotion in room ${roomId}`);
  }
}

// --- Socket.io signaling ---
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  // ==================== JOIN ROOM ====================
  socket.on('join-room', async ({ roomId, alias }) => {
    const ip = _getIP(socket);

    // Check global ban first
    if (globalBannedIPs.has(ip)) {
      socket.emit('join-denied', { reason: 'You have been globally banned from WaveTone.' });
      return;
    }

    if (roomBannedIPs.has(roomId) && roomBannedIPs.get(roomId).has(ip)) {
      socket.emit('join-denied', { reason: 'You have been banned from this room.' });
      return;
    }

    // Check if room exists in database and enforce maxUsers
    let roomExists;
    try {
      roomExists = await Room.findById(roomId);
      if (!roomExists) {
        socket.emit('room-error', { code: 'NOT_FOUND', error: 'Room has been destroyed or does not exist.' });
        return;
      }
    } catch (err) {
      socket.emit('room-error', { code: 'NOT_FOUND', error: 'Room not found.' });
      return;
    }

    if (!roomParticipants.has(roomId)) roomParticipants.set(roomId, []);
    const participants = roomParticipants.get(roomId);

    // Enforce maxUsers limit
    const maxUsers = roomExists.maxUsers || 10;
    if (participants.length >= maxUsers) {
      socket.emit('join-denied', { reason: 'Room is full.' });
      return;
    }

    // Assign first participant as Host, but keep their alias
    let cleanAlias;
    let isHost = false;
    if (participants.length === 0) {
      // First participant is Host, but keep their alias instead of renaming to 'Host'
      let userAlias = alias ? alias.trim() : 'Guest';
      if (userAlias.toLowerCase() === 'host') {
        userAlias = 'Guest';
      }
      cleanAlias = containsProfanity(userAlias) ? filterProfanity(userAlias) : userAlias;
      isHost = true;
      roomHosts.set(roomId, { socketId: socket.id, alias: cleanAlias });
      if (hostTimeoutHandles.has(roomId)) {
        clearTimeout(hostTimeoutHandles.get(roomId));
        hostTimeoutHandles.delete(roomId);
      }
    } else {
      // Validate alias: reject 'Host' claims and use provided alias
      let userAlias = alias ? alias.trim() : 'Guest';
      
      // Prevent non-hosts from claiming Host status
      if (userAlias.toLowerCase() === 'host') {
        userAlias = 'Guest';
      }
      
      // Check profanity on the provided alias
      cleanAlias = containsProfanity(userAlias) ? filterProfanity(userAlias) : userAlias;
    }

    socket.join(roomId);
    socketAliases.set(socket.id, cleanAlias);

    // Add new participant to the list BEFORE sending room-users
    participants.push({ socketId: socket.id, alias: cleanAlias });
    
    // Send complete participant list to the new joiner (including themselves)
    socket.emit('room-users', participants);
    socket.emit('room-metadata', { 
      isHost, 
      hostInfo: isHost ? { alias: cleanAlias } : roomHosts.get(roomId) || null,
      subHosts: roomSubHosts.get(roomId) || [],
      hostReturnTimeout: HOST_RETURN_TIMEOUT_MS
    });
    
    // Broadcast updated participant list to all other users in the room
    // (socket.to excludes the new joiner, they already got it above)
    socket.to(roomId).emit('room-users', participants.map(p => ({ 
      socketId: p.socketId, 
      alias: p.alias, 
      joinedAt: p.joinedAt, 
      leftAt: p.leftAt 
    })));
    
    socket.to(roomId).emit('user-joined', { 
      socketId: socket.id, 
      alias: cleanAlias,
      isHost,
      hostReturnTimeout: HOST_RETURN_TIMEOUT_MS
    });

    console.log(`${cleanAlias} (${socket.id}) [${ip}] joined room ${roomId}. IsHost: ${isHost}`);
  });

  // ==================== ASSIGN SUB-HOST (Host only) ====================
  socket.on('assign-sub-host', ({ roomId, targetSocketId, targetAlias, rank = 0 }) => {
    const host = roomHosts.get(roomId);
    if (!host || host.socketId !== socket.id) {
      socket.emit('error', { message: 'Only the Host can assign Sub-Hosts.' });
      return;
    }

    if (!roomSubHosts.has(roomId)) roomSubHosts.set(roomId, []);
    const subHosts = roomSubHosts.get(roomId);
    
    // Check if already a sub-host
    const existing = subHosts.find(s => s.socketId === targetSocketId);
    if (existing) {
      socket.emit('error', { message: 'User is already a Sub-Host.' });
      return;
    }

    const newSubHost = {
      socketId: targetSocketId,
      alias: targetAlias,
      rank: rank || 0,
      assignedAt: new Date()
    };
    subHosts.push(newSubHost);
    subHosts.sort((a, b) => a.rank - b.rank);

    io.to(roomId).emit('sub-host-assigned', {
      hostAlias: host.alias,
      targetSocketId: targetSocketId,
      subHostAlias: targetAlias,
      rank: rank,
      subHosts: subHosts
    });

    console.log(`Sub-Host assigned: ${targetAlias} (rank ${rank}) in room ${roomId}`);
  });

  // ==================== REVOKE SUB-HOST (Host only) ====================
  socket.on('revoke-sub-host', ({ roomId, targetSocketId, targetAlias }) => {
    const host = roomHosts.get(roomId);
    if (!host || host.socketId !== socket.id) {
      socket.emit('error', { message: 'Only the Host can revoke Sub-Hosts.' });
      return;
    }

    if (!roomSubHosts.has(roomId)) return;
    const subHosts = roomSubHosts.get(roomId);
    
    const index = subHosts.findIndex(s => s.socketId === targetSocketId);
    if (index !== -1) {
      subHosts.splice(index, 1);
      io.to(roomId).emit('sub-host-revoked', {
        hostAlias: host.alias,
        formerSubHostAlias: targetAlias,
        subHosts: subHosts
      });
      console.log(`Sub-Host revoked: ${targetAlias} from room ${roomId}`);
    }
  });

  // ==================== PROMOTE SUB-HOST TO HOST (Host only) ====================
  socket.on('promote-sub-host', ({ roomId, targetSocketId, targetAlias }) => {
    const host = roomHosts.get(roomId);
    if (!host || host.socketId !== socket.id) {
      socket.emit('error', { message: 'Only the Host can promote Sub-Hosts.' });
      return;
    }

    if (!roomSubHosts.has(roomId)) return;
    const subHosts = roomSubHosts.get(roomId);
    
    const index = subHosts.findIndex(s => s.socketId === targetSocketId);
    if (index !== -1) {
      const newHost = subHosts[index];
      const formerHostAlias = host.alias;
      
      // Update Host
      roomHosts.set(roomId, { socketId: newHost.socketId, alias: newHost.alias });
      
      // Remove from Sub-Hosts and add former Host to Sub-Hosts
      subHosts.splice(index, 1);
      subHosts.unshift({ 
        socketId: socket.id, 
        alias: formerHostAlias, 
        rank: 0,
        assignedAt: new Date()
      });
      
      io.to(roomId).emit('sub-host-promoted', {
        newHostAlias: newHost.alias,
        formerHostAlias: formerHostAlias,
        subHosts: subHosts
      });
      console.log(`Sub-Host ${newHost.alias} promoted to Host, ${formerHostAlias} demoted to Sub-Host in room ${roomId}`);
    }
  });

  // ==================== LEAVE ROOM ====================
  socket.on('leave-room', ({ roomId }) => {
    _leaveRoom(socket, roomId);
  });

  // ==================== WEBRTC SIGNALING ====================
  socket.on('offer', ({ offer, targetSocketId }) => {
    io.to(targetSocketId).emit('offer', { offer, fromSocketId: socket.id });
  });

  socket.on('answer', ({ answer, targetSocketId }) => {
    io.to(targetSocketId).emit('answer', { answer, fromSocketId: socket.id });
  });

  socket.on('ice-candidate', ({ candidate, targetSocketId }) => {
    io.to(targetSocketId).emit('ice-candidate', { candidate, fromSocketId: socket.id });
  });

  // ==================== HOST KICK ====================
  socket.on('kick-user', ({ roomId, targetSocketId }) => {
    // Verify Host by checking roomHosts map
    const hostInfo = roomHosts.get(roomId);
    if (!hostInfo || hostInfo.socketId !== socket.id) {
      socket.emit('error', { message: 'Only the Host can kick users.' });
      return;
    }
    
    const targetSocket = io.sockets.sockets.get(targetSocketId);
    if (targetSocket) {
      const targetAlias = socketAliases.get(targetSocketId) || 'User';
      _banAndKick(targetSocket, roomId, `You have been removed by the Host (${hostInfo.alias}) for moderation reasons.`);
      io.to(roomId).emit('user-kicked', { 
        targetAlias,
        hostAlias: hostInfo.alias,
        reason: 'Removed by Host'
      });
      console.log(`Host ${hostInfo.alias} kicked ${targetAlias} from room ${roomId}`);
    }
  });

  // ==================== PROFANITY WARNING SYSTEM ====================
  socket.on('profanity-warning', ({ roomId }) => {
    const now = Date.now();

    if (!socketWarnings.has(socket.id)) {
      socketWarnings.set(socket.id, { count: 0, lastTimestamp: 0 });
    }
    const record = socketWarnings.get(socket.id);

    // Rate-limit: ignore if too soon
    if (now - record.lastTimestamp < WARNING_RATE_LIMIT_MS) return;

    record.count += 1;
    record.lastTimestamp = now;

    console.log(`Profanity warning #${record.count}/${MAX_WARNINGS} for ${socket.id} in room ${roomId}`);

    socket.emit('warning-issued', { count: record.count, maxWarnings: MAX_WARNINGS });

    // Auto-start vote-kick at WARNING_AUTO_VOTE_THRESHOLD (2 warnings)
    if (record.count === WARNING_AUTO_VOTE_THRESHOLD) {
      const participants = roomParticipants.get(roomId);
      if (participants && participants.length >= 3) {
        const targetAlias = socketAliases.get(socket.id) || 'User';
        const initiatorAlias = 'System';
        const totalVoters = participants.length - 1;

        if (!activeVotes.has(roomId)) {
          const voteSession = {
            targetSocketId: socket.id,
            targetAlias,
            initiatorAlias,
            votes: new Set(),
            timeout: null,
          };

          voteSession.timeout = setTimeout(() => {
            if (activeVotes.has(roomId)) {
              io.to(roomId).emit('vote-kick-ended', {
                targetSocketId: socket.id, targetAlias,
                result: 'failed', reason: 'Vote timed out.',
              });
              activeVotes.delete(roomId);
            }
          }, VOTE_TIMEOUT_MS);

          activeVotes.set(roomId, voteSession);
          const requiredVotes = Math.ceil(totalVoters * VOTE_THRESHOLD);

          io.to(roomId).emit('vote-kick-active', {
            targetSocketId: socket.id, targetAlias, initiatorAlias,
            currentVotes: 0, requiredVotes, totalVoters,
            timeoutSeconds: VOTE_TIMEOUT_MS / 1000,
          });

          console.log(`Auto vote-kick started (system) against ${targetAlias} after ${WARNING_AUTO_VOTE_THRESHOLD} warnings in room ${roomId}`);
        }
      }
    }

    // Auto-kick at MAX_WARNINGS threshold (3 warnings) with global ban
    if (record.count >= MAX_WARNINGS) {
      console.log(`Auto-kicking ${socket.id} after ${MAX_WARNINGS} profanity warnings (global ban)`);
      socketWarnings.delete(socket.id);
      _banAndKick(socket, roomId, `Removed after ${MAX_WARNINGS} profanity warnings.`, true);
    }
  });

  // ==================== HYBRID MODERATION: SERVER-SIDE VERIFICATION ====================
  socket.on('check-profanity-server', ({ transcript, wordTimings, clientDetected, timestamp }, callback) => {
    // Server-side profanity check for hybrid moderation
    // This verifies the client's detection with independent server logic
    
    if (!transcript || transcript.length === 0) {
      callback?.({ isProfane: false, confidence: 0, reason: 'Empty transcript' });
      return;
    }

    const hasProfanity = containsProfanity(transcript);
    const badWords = hasProfanity ? extractProfanityWords(transcript) : [];
    
    // Calculate confidence based on word match strength
    const confidence = hasProfanity ? Math.min(1, badWords.length / Math.max(1, transcript.split(/\s+/).length)) : 0;

    console.log(`[Server Moderation] Transcript: "${transcript}", Profane: ${hasProfanity}, Confidence: ${confidence.toFixed(2)}, BadWords: [${badWords.join(', ')}]`);

    // Send result back to client
    callback?.({
      isProfane: hasProfanity,
      badWords: badWords,
      confidence: confidence,
      wordTimings: wordTimings,
      serverTimestamp: Date.now(),
      latency: Date.now() - timestamp
    });
  });

  // ==================== VOTE-KICK SYSTEM ====================
  socket.on('vote-kick-start', ({ roomId, targetSocketId }) => {
    if (targetSocketId === socket.id) return;

    if (activeVotes.has(roomId)) {
      socket.emit('vote-kick-error', { message: 'A vote is already in progress.' });
      return;
    }

    const participants = roomParticipants.get(roomId);
    if (!participants) return;
    if (participants.length < 3) {
      socket.emit('vote-kick-error', { message: 'Vote kick requires at least 3 participants.' });
      return;
    }
    const target = participants.find(p => p.socketId === targetSocketId);
    if (!target) return;

    const initiatorAlias = socketAliases.get(socket.id) || 'User';
    const totalVoters = participants.length - 1; // exclude target

    const voteSession = {
      targetSocketId,
      targetAlias: target.alias,
      initiatorAlias,
      votes: new Set([socket.id]), // initiator auto-votes yes
      timeout: null,
    };

    // 30-second timeout
    voteSession.timeout = setTimeout(() => {
      if (activeVotes.has(roomId)) {
        io.to(roomId).emit('vote-kick-ended', {
          targetSocketId, targetAlias: target.alias,
          result: 'failed', reason: 'Vote timed out.',
        });
        activeVotes.delete(roomId);
      }
    }, VOTE_TIMEOUT_MS);

    activeVotes.set(roomId, voteSession);

    const requiredVotes = Math.ceil(totalVoters * VOTE_THRESHOLD);

    // Notify everyone except the target
    participants.forEach(p => {
      if (p.socketId !== targetSocketId) {
        io.to(p.socketId).emit('vote-kick-active', {
          targetSocketId, targetAlias: target.alias, initiatorAlias,
          currentVotes: voteSession.votes.size, requiredVotes, totalVoters,
          timeoutSeconds: VOTE_TIMEOUT_MS / 1000,
        });
      }
    });

    console.log(`Vote-kick started by ${initiatorAlias} against ${target.alias} in room ${roomId}`);
  });

  socket.on('vote-kick-cast', ({ roomId, vote }) => {
    const session = activeVotes.get(roomId);
    if (!session || socket.id === session.targetSocketId) return;

    if (vote === 'yes') session.votes.add(socket.id);

    const participants = roomParticipants.get(roomId);
    if (!participants) return;

    const totalVoters = participants.length - 1;
    const requiredVotes = Math.ceil(totalVoters * VOTE_THRESHOLD);

    // Broadcast updated count (except target)
    participants.forEach(p => {
      if (p.socketId !== session.targetSocketId) {
        io.to(p.socketId).emit('vote-kick-update', {
          currentVotes: session.votes.size, requiredVotes, totalVoters,
        });
      }
    });

    // Check threshold
    if (session.votes.size >= requiredVotes) {
      clearTimeout(session.timeout);

      const targetSocket = io.sockets.sockets.get(session.targetSocketId);
      if (targetSocket) {
        _banAndKick(targetSocket, roomId, `You were vote-kicked from this room by participants (${session.votes.size}/${requiredVotes} votes).`);
      }

      io.to(roomId).emit('vote-kick-ended', {
        targetSocketId: session.targetSocketId, 
        targetAlias: session.targetAlias,
        result: 'passed', 
        reason: `Vote passed: ${session.votes.size} participants voted to remove ${session.targetAlias}.`,
        voteCount: session.votes.size,
        requiredVotes: requiredVotes
      });

      activeVotes.delete(roomId);
      console.log(`Vote-kick passed for ${session.targetAlias} in room ${roomId}. Votes: ${session.votes.size}/${requiredVotes}`);
    }
  });

  // ==================== DISCONNECT ====================
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    socketAliases.delete(socket.id);
    socketWarnings.delete(socket.id);
    roomParticipants.forEach((participants, roomId) => {
      const idx = participants.findIndex(p => p.socketId === socket.id);
      if (idx !== -1) {
        participants.splice(idx, 1);
        socket.to(roomId).emit('user-left', { socketId: socket.id });

        // Cancel active vote if target disconnected
        _cleanupVote(roomId, socket.id);

        if (participants.length === 0) {
          roomParticipants.delete(roomId);
          roomBannedIPs.delete(roomId);
          _cleanupVote(roomId);
          Room.findByIdAndUpdate(roomId, { isActive: false }).catch(() => {});
        }
      }
    });
  });
});

// --- Helper functions ---

function _leaveRoom(socket, roomId) {
  socket.leave(roomId);
  const participants = roomParticipants.get(roomId);
  if (participants) {
    const idx = participants.findIndex(p => p.socketId === socket.id);
    if (idx !== -1) participants.splice(idx, 1);

    _cleanupVote(roomId, socket.id);

    // Check if Host left
    const host = roomHosts.get(roomId);
    if (host && host.socketId === socket.id) {
      console.log(`Host ${host.alias} left room ${roomId}`);
      
      // Start timeout to allow Host to return before Sub-Host promotion
      const timeoutHandle = setTimeout(() => {
        console.log(`[DEBUG] Host timeout fired for room ${roomId}. HOST_RETURN_TIMEOUT_MS: ${HOST_RETURN_TIMEOUT_MS}ms`);
        // Check if Host still hasn't returned
        const hostNow = roomHosts.get(roomId);
        console.log(`[DEBUG] Current Host in room ${roomId}:`, hostNow);
        console.log(`[DEBUG] Original Host socketId: ${host.socketId}`);
        if (!hostNow || hostNow.socketId === host.socketId) {
          console.log(`[DEBUG] Host has not returned, promoting Sub-Host`);
          // Promote Sub-Host if available
          _promoteSubHostToHost(roomId);
        } else {
          console.log(`[DEBUG] Host has returned, no promotion needed`);
        }
        hostTimeoutHandles.delete(roomId);
      }, HOST_RETURN_TIMEOUT_MS);
      
      hostTimeoutHandles.set(roomId, timeoutHandle);
      
      // Notify room about Host departure
      io.to(roomId).emit('host-left', {
        formerHostAlias: host.alias,
        timeoutSeconds: HOST_RETURN_TIMEOUT_MS / 1000,
        hasSubHosts: (roomSubHosts.get(roomId) || []).length > 0
      });
    }

    // Check if Sub-Host left
    if (roomSubHosts.has(roomId)) {
      const subHosts = roomSubHosts.get(roomId);
      const subHostIdx = subHosts.findIndex(sh => sh.socketId === socket.id);
      if (subHostIdx !== -1) {
        const formerSubHost = subHosts[subHostIdx];
        subHosts.splice(subHostIdx, 1);
        
        io.to(roomId).emit('sub-host-left', {
          formerSubHostAlias: formerSubHost.alias,
          subHosts: subHosts
        });
        console.log(`Sub-Host ${formerSubHost.alias} left room ${roomId}`);
      }
    }

    if (participants.length === 0) {
      roomParticipants.delete(roomId);
      roomBannedIPs.delete(roomId);
      roomHosts.delete(roomId);
      roomSubHosts.delete(roomId);
      if (hostTimeoutHandles.has(roomId)) {
        clearTimeout(hostTimeoutHandles.get(roomId));
        hostTimeoutHandles.delete(roomId);
      }
      _cleanupVote(roomId);
      Room.findByIdAndUpdate(roomId, { isActive: false }).catch(() => {});
      console.log(`Room ${roomId} closed — no participants remain`);
    } else {
      // Broadcast updated participant list for Browse page real-time updates
      io.to(roomId).emit('room-users', participants.map(p => ({ 
        socketId: p.socketId, 
        alias: p.alias, 
        joinedAt: p.joinedAt, 
        leftAt: p.leftAt 
      })));
    }
  }
  socket.to(roomId).emit('user-left', { socketId: socket.id });
}

function _cleanupVote(roomId, disconnectedSocketId) {
  const vote = activeVotes.get(roomId);
  if (!vote) return;

  // If vote target left, cancel vote
  if (disconnectedSocketId && vote.targetSocketId === disconnectedSocketId) {
    clearTimeout(vote.timeout);
    io.to(roomId).emit('vote-kick-ended', {
      targetSocketId: vote.targetSocketId, targetAlias: vote.targetAlias,
      result: 'cancelled', reason: 'Target left the room.',
    });
    activeVotes.delete(roomId);
  }

  // If room is empty, just delete
  if (!disconnectedSocketId) {
    clearTimeout(vote.timeout);
    activeVotes.delete(roomId);
  }
}

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
