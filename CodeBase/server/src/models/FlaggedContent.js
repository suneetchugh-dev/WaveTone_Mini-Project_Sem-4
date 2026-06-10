import mongoose from 'mongoose';

const FlaggedContentSchema = new mongoose.Schema({
  transcript: { type: String, required: true },
  detectedBy: { type: String, enum: ['dictionary', 'tfjs', 'both'], default: 'dictionary' },
  confidence: { type: Number, default: 0 },
  isCorrect: { type: Boolean, default: null }, // Null = pending verification, True = correctly flagged, False = false positive
  roomId: { type: String, required: true },
  language: { type: String, default: 'en' },
  timestamp: { type: Date, default: Date.now }
});

export default mongoose.model('FlaggedContent', FlaggedContentSchema);
