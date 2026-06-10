// Mongoose schema
import mongoose from 'mongoose';

const RoomSchema = new mongoose.Schema({
  topic: { type: String, required: true },
  category: { type: String, required: true },
  maxUsers: { type: Number, default: 8 },
  duration: { type: Number, default: 30 }, // in minutes
  isPrivate: { type: Boolean, default: false },
  profanityFilter: { type: Boolean, default: false },
  rejoinAllowed: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
  isActive: { type: Boolean, default: true },
  hostId: { type: String, default: null }, // socketId of Host
  subHosts: [
    {
      socketId: String,
      alias: String,
      rank: { type: Number, default: 0 }, // 0 = primary sub-host, 1+ = backup
      assignedAt: Date,
      hostReturnTimeout: { type: Number, default: 300000 } // 5 minutes default
    }
  ],
  participants: [
    {
      userId: String,
      alias: String,
      joinedAt: Date,
      leftAt: Date
    }
  ]
});

export default mongoose.model('Room', RoomSchema);
