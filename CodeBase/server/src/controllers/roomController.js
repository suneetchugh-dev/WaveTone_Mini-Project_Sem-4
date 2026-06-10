import Room from '../models/Room.js';
import { containsProfanity } from '../utils/profanityFilter.js';

export const getRooms = async (req, res) => {
  try {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

    // Clean up stale rooms: 
    // 1. If all participants have left.
    // 2. If it was created over 5 minutes ago and never had any participants.
    await Room.updateMany(
      {
        isActive: true,
        $or: [
          {
            'participants.0': { $exists: true },
            participants: {
              $not: {
                $elemMatch: {
                  $or: [
                    { leftAt: { $exists: false } },
                    { leftAt: null }
                  ]
                }
              }
            }
          },
          {
            'participants.0': { $exists: false },
            createdAt: { $lt: fiveMinutesAgo }
          }
        ]
      },
      { $set: { isActive: false } }
    );

    const rooms = await Room.find({ isActive: true, isPrivate: { $ne: true } })
      .sort({ createdAt: -1 });
    res.json(rooms);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch rooms' });
  }
};

export const createRoom = async (req, res) => {
  try {
    const { topic, category, maxUsers, isPrivate, profanityFilter, language } = req.body;
    
    if (containsProfanity(topic, language)) {
      return res.status(400).json({ 
        error: 'Room topic contains inappropriate language. Please choose a cleaner topic.', 
        field: 'topic' 
      });
    }
    
    if (containsProfanity(category, language)) {
      return res.status(400).json({ 
        error: 'Room category contains inappropriate language. Please choose a cleaner category.', 
        field: 'category' 
      });
    }

    const room = new Room({ topic, category, maxUsers, isPrivate, profanityFilter, language });
    await room.save();
    res.status(201).json(room);
  } catch (err) {
    res.status(400).json({ error: 'Failed to create room' });
  }
};
