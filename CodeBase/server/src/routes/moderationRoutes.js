import express from 'express';
import FlaggedContent from '../models/FlaggedContent.js';
import { containsProfanity, extractProfanityWords } from '../utils/profanityFilter.js';
import { getToxicityDetails } from '../utils/toxicityModerator.js';

const router = express.Router();

// GET /api/moderation/flagged
// Retrieve recent flagged items
router.get('/flagged', async (req, res) => {
  try {
    const logs = await FlaggedContent.find()
      .sort({ timestamp: -1 })
      .limit(50);
    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve flagged logs' });
  }
});

// POST /api/moderation/flagged
// Create a flagged content log manually or from filters
router.post('/flagged', async (req, res) => {
  try {
    const { transcript, detectedBy, confidence, roomId, language } = req.body;
    const log = new FlaggedContent({
      transcript,
      detectedBy,
      confidence,
      roomId: roomId || 'sandbox',
      language: language || 'en'
    });
    await log.save();
    res.status(201).json(log);
  } catch (err) {
    res.status(400).json({ error: 'Failed to create flagged content log' });
  }
});

// PUT /api/moderation/flagged/:id/feedback
// Submit moderator evaluation feedback
router.put('/flagged/:id/feedback', async (req, res) => {
  try {
    const { isCorrect } = req.body;
    const log = await FlaggedContent.findByIdAndUpdate(
      req.params.id,
      { isCorrect },
      { new: true }
    );
    if (!log) {
      return res.status(404).json({ error: 'Flagged log not found' });
    }
    res.json(log);
  } catch (err) {
    res.status(400).json({ error: 'Failed to update feedback' });
  }
});

// GET /api/moderation/metrics
// Retrieve aggregate stats for dashboard metrics
router.get('/metrics', async (req, res) => {
  try {
    const totalFlagged = await FlaggedContent.countDocuments();
    const verifiedCorrect = await FlaggedContent.countDocuments({ isCorrect: true });
    const verifiedFalsePositive = await FlaggedContent.countDocuments({ isCorrect: false });
    const pendingVerification = await FlaggedContent.countDocuments({ isCorrect: null });
    
    const totalVerified = verifiedCorrect + verifiedFalsePositive;
    const falsePositiveRate = totalVerified > 0 
      ? parseFloat(((verifiedFalsePositive / totalVerified) * 100).toFixed(1)) 
      : 0;
    const accuracyRate = totalVerified > 0 
      ? parseFloat(((verifiedCorrect / totalVerified) * 100).toFixed(1)) 
      : 100; // default to 100% accuracy if no overrides

    res.json({
      totalFlagged,
      verifiedCorrect,
      verifiedFalsePositive,
      pendingVerification,
      totalVerified,
      falsePositiveRate,
      accuracyRate
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch metrics' });
  }
});

// POST /api/moderation/test-text
// Evaluate raw text input and return granular classifier scores (for sandbox)
router.post('/test-text', async (req, res) => {
  try {
    const { text, language } = req.body;
    if (!text || text.trim().length === 0) {
      return res.status(400).json({ error: 'No text provided' });
    }

    const startTime = Date.now();
    const targetLang = language || 'en';

    // 1. Dictionary checks
    const hasProfanity = containsProfanity(text, targetLang);
    const matchedWords = extractProfanityWords(text, targetLang);

    // 2. TF.js Toxicity model checks
    const toxicityDetails = await getToxicityDetails(text);
    const hasToxicity = toxicityDetails ? toxicityDetails.some(t => t.match) : false;

    const latency = Date.now() - startTime;
    const isFlagged = hasProfanity || hasToxicity;
    const detectedBy = hasProfanity && hasToxicity ? 'both' : hasProfanity ? 'dictionary' : hasToxicity ? 'tfjs' : null;

    res.json({
      text,
      language: targetLang,
      isFlagged,
      detectedBy,
      dictionary: {
        hasProfanity,
        matchedWords
      },
      toxicity: toxicityDetails || [],
      latency
    });
  } catch (err) {
    res.status(500).json({ error: 'Evaluation failed' });
  }
});

export default router;
