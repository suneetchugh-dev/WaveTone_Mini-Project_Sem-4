import Room from '../models/Room.js';
import Groq from 'groq-sdk';

const groq = process.env.GROQ_API_KEY
  ? new Groq({ apiKey: process.env.GROQ_API_KEY })
  : null;

const STOP_WORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'been', 'but', 'by', 'for', 'from',
  'had', 'has', 'have', 'he', 'her', 'his', 'i', 'if', 'in', 'is', 'it', 'its',
  'me', 'my', 'of', 'on', 'or', 'our', 'she', 'that', 'the', 'their', 'them',
  'there', 'they', 'this', 'to', 'was', 'we', 'were', 'will', 'with', 'you', 'your',
]);

function normalizeTranscripts(transcripts) {
  if (!Array.isArray(transcripts)) return [];

  return transcripts
    .filter((entry) => typeof entry === 'string')
    .map((entry) => entry.replace(/\s+/g, ' ').trim())
    .filter((entry) => entry.length > 2)
    .slice(0, 100);
}

function buildFallbackSummary({ transcripts, topic, category, duration, participantCount }) {
  const cleaned = normalizeTranscripts(transcripts);
  if (cleaned.length === 0) {
    return 'No clear transcript was captured for this session, so a detailed summary could not be generated.';
  }

  const uniqueSnippets = [];
  cleaned.forEach((entry) => {
    if (!uniqueSnippets.includes(entry)) uniqueSnippets.push(entry);
  });

  const keywordCounts = new Map();
  cleaned
    .join(' ')
    .toLowerCase()
    .match(/[a-z]{4,}/g)?.forEach((word) => {
      if (STOP_WORDS.has(word)) return;
      keywordCounts.set(word, (keywordCounts.get(word) || 0) + 1);
    });

  const keywords = [...keywordCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([word]) => word);

  const topicPart = topic ? ` about "${topic}"` : '';
  const categoryPart = category && category !== 'General' ? `${category.toLowerCase()} ` : '';
  const durationPart = duration ? ` over roughly ${duration} minute(s)` : '';
  const participantPart = participantCount ? ` with ${participantCount} participant(s)` : '';
  const opener = `This ${categoryPart}conversation${topicPart}${durationPart}${participantPart} focused on ${keywords.length > 0 ? keywords.join(', ') : 'several shared discussion points'}.`;

  const highlight = uniqueSnippets
    .slice(0, 2)
    .map((entry) => entry.length > 120 ? `${entry.slice(0, 117)}...` : entry)
    .join(' ');

  if (!highlight) return opener;

  return `${opener} Transcript highlights included: ${highlight}`;
}

function isLowConfidenceSummary(summaryText = '') {
  const text = String(summaryText).toLowerCase();
  if (!text) return true;

  return (
    text.includes('too fragmented to summarize')
    || text.includes('appears to be fragmented')
    || text.includes('does not provide enough information')
    || text.includes('not enough information to generate a summary')
    || text.includes('insufficient information to summarize')
  );
}

async function generateWithGroq(prompt) {
  try {
    const message = await groq.chat.completions.create({
      messages: [{ role: 'user', content: prompt }],
      model: 'llama-3.3-70b-versatile',
      max_tokens: 300,
      temperature: 0.6,
    });
    const raw = message;
    const summary = message.choices?.[0]?.message?.content?.trim();
    if (summary) return { summary, modelName: 'groq/llama-3.3-70b', raw };
  } catch (error) {
    console.warn('Groq generation failed:', error.message);
  }

  throw new Error('Groq generation failed');
}

// Exported helpers for debug route
export { normalizeTranscripts, buildFallbackSummary, generateWithGroq };

export const getSessionSummary = async (req, res) => {
  try {
    const room = await Room.findById(req.params.id);
    if (!room) return res.status(404).json({ error: 'Room not found' });
    res.json({
      roomId: room._id,
      topic: room.topic,
      category: room.category,
      duration: room.duration,
      participantCount: room.participants.length,
      createdAt: room.createdAt,
      isActive: room.isActive,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch session summary' });
  }
};

export const generateAISummary = async (req, res) => {
  try {
    const { transcripts, topic, category, duration, participantCount } = req.body;
    const cleanedTranscripts = normalizeTranscripts(transcripts);
    const fallbackSummary = buildFallbackSummary({
      transcripts: cleanedTranscripts,
      topic,
      category,
      duration,
      participantCount,
    });

    // Always return fallback as base message
    if (cleanedTranscripts.length === 0) {
      return res.json({ summary: fallbackSummary, provider: 'local-fallback', reason: 'No transcript data available.' });
    }

    // Build prompt for AI models
    const trimmedTranscripts = cleanedTranscripts.join('\n');
    const prompt = `You are summarizing an anonymous voice room conversation from WaveTone.

Room topic: "${topic || 'General'}"
Category: ${category || 'General'}
Duration: ${duration || '?'} minutes
Participants: ${participantCount || '?'}

Below are speech-to-text transcripts captured during the session. They may be incomplete or contain recognition errors.

Transcripts:
${trimmedTranscripts}

Generate a concise 2-4 sentence summary of what was discussed. Focus on key topics and takeaways. Do NOT include any personal identifiers. Keep it neutral and informative. If the transcripts are too fragmented to summarize, say so briefly.`;

    // Try Groq as primary provider
    if (groq) {
      try {
        const { summary, modelName } = await generateWithGroq(prompt);
        if (isLowConfidenceSummary(summary)) {
          return res.json({
            summary: fallbackSummary,
            provider: 'local-fallback',
            reason: 'AI summary was low-confidence. Using local transcript summary.',
            model: modelName,
          });
        }
        return res.json({ summary, provider: 'groq', model: modelName });
      } catch (groqErr) {
        console.warn('Groq failed:', groqErr.message);
      }
    }

    // fallback returned if groq failed
    console.warn('Groq unavailable, using local fallback');
    res.json({
      summary: fallbackSummary,
      provider: 'local-fallback',
      reason: 'AI provider unavailable. Using local transcript summary.',
    });
  } catch (err) {
    console.error('AI summary error:', err);
    res.json({
      summary: 'Summary generated from speech-to-text transcripts.',
      provider: 'local-fallback',
      reason: 'Error generating summary. Using local fallback.',
    });
  }
};
