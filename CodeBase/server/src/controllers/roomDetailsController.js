import Room from '../models/Room.js';

// GET /api/rooms/:id
export const getRoomById = async (req, res) => {
  try {
    const room = await Room.findById(req.params.id);
    if (!room) return res.status(404).json({ error: 'Room not found' });
    res.json(room);
  } catch (err) {
    if (err.name === 'CastError') {
      return res.status(400).json({ error: 'Invalid room ID format.' });
    }
    res.status(500).json({ error: `Failed to fetch room details: ${err.message}` });
  }
};

// POST /api/rooms/:id/join — adds a participant record
export const joinRoom = async (req, res) => {
  try {
    const room = await Room.findById(req.params.id);
    if (!room) return res.status(404).json({ error: 'Room not found' });
    if (!room.isActive) return res.status(403).json({ error: 'Room is no longer active' });

    const activeCount = room.participants.filter(p => !p.leftAt).length;
    if (activeCount >= room.maxUsers) {
      return res.status(403).json({ error: 'Room is full' });
    }

    const { alias, userId } = req.body;
    room.participants.push({
      userId: userId || `anon_${Date.now()}`,
      alias: alias || 'Anonymous',
      joinedAt: new Date(),
    });
    await room.save();

    res.json({ message: 'Joined room', room });
  } catch (err) {
    if (err.name === 'CastError') {
      return res.status(400).json({ error: 'Invalid room ID format.' });
    }
    res.status(500).json({ error: `Failed to join room: ${err.message}` });
  }
};

// POST /api/rooms/:id/leave — marks participant as left
export const leaveRoom = async (req, res) => {
  try {
    const room = await Room.findById(req.params.id);
    if (!room) return res.status(404).json({ error: 'Room not found' });

    const { userId } = req.body;
    const participant = room.participants
      .slice()
      .reverse()
      .find(p => p.userId === userId && !p.leftAt);

    if (participant) {
      participant.leftAt = new Date();
      await room.save();
    }

    const activeCount = room.participants.filter(p => !p.leftAt).length;
    if (activeCount === 0) {
      room.isActive = false;
      await room.save();
    }

    res.json({ message: 'Left room' });
  } catch (err) {
    if (err.name === 'CastError') {
      return res.status(400).json({ error: 'Invalid room ID format.' });
    }
    res.status(500).json({ error: `Failed to leave room: ${err.message}` });
  }
};
