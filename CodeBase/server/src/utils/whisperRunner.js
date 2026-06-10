import { execFile } from 'child_process';
import path from 'path';
import fs from 'fs/promises';
import fsSync from 'fs';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BIN_DIR = path.join(__dirname, '..', '..', 'bin');
const MODEL_DIR = path.join(__dirname, '..', '..', 'models');

const WHISPER_BIN = path.join(BIN_DIR, 'main.exe');
const WHISPER_MODEL_EN = path.join(MODEL_DIR, 'ggml-tiny.en.bin');
const WHISPER_MODEL_MULTI = path.join(MODEL_DIR, 'ggml-tiny.bin');
const TEMP_DIR = path.join(__dirname, '..', '..', 'temp');

// Ensure temp dir exists
fs.mkdir(TEMP_DIR, { recursive: true }).catch(console.error);

/**
 * Creates a valid WAV file buffer from raw PCM data.
 * @param {Buffer} pcmData - Raw 16-bit PCM mono audio at 16kHz
 * @returns {Buffer} WAV formatted buffer
 */
function createWavHeader(pcmData) {
  const numChannels = 1;
  const sampleRate = 16000;
  const bitsPerSample = 16;
  const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
  const blockAlign = numChannels * (bitsPerSample / 8);
  
  const buffer = Buffer.alloc(44 + pcmData.length);
  
  // RIFF chunk descriptor
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + pcmData.length, 4);
  buffer.write('WAVE', 8);
  
  // fmt sub-chunk
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16); // Subchunk1Size
  buffer.writeUInt16LE(1, 20); // AudioFormat (1 = PCM)
  buffer.writeUInt16LE(numChannels, 22); // NumChannels
  buffer.writeUInt32LE(sampleRate, 24); // SampleRate
  buffer.writeUInt32LE(byteRate, 28); // ByteRate
  buffer.writeUInt16LE(blockAlign, 32); // BlockAlign
  buffer.writeUInt16LE(bitsPerSample, 34); // BitsPerSample
  
  // data sub-chunk
  buffer.write('data', 36);
  buffer.writeUInt32LE(pcmData.length, 40);
  
  // Write PCM data
  pcmData.copy(buffer, 44);
  
  return buffer;
}

/**
 * Runs whisper.cpp on a buffer of 16-bit 16kHz Mono PCM data.
 * @param {Buffer} pcmBuffer - Raw PCM data
 * @param {string} [language='en'] - Target transcription language
 * @returns {Promise<string>} Transcribed text
 */
export async function runWhisper(pcmBuffer, language = 'en') {
  if (!pcmBuffer || pcmBuffer.length === 0) return '';
  
  const wavBuffer = createWavHeader(pcmBuffer);
  const tempId = crypto.randomBytes(16).toString('hex');
  const tempWavPath = path.join(TEMP_DIR, `${tempId}.wav`);
  
  // Choose correct model file
  let modelPath = WHISPER_MODEL_MULTI;
  if (language === 'en' && fsSync.existsSync(WHISPER_MODEL_EN)) {
    modelPath = WHISPER_MODEL_EN;
  } else if (!fsSync.existsSync(WHISPER_MODEL_MULTI)) {
    // Fallback if multilingual model is not available
    modelPath = WHISPER_MODEL_EN;
  }

  try {
    await fs.writeFile(tempWavPath, wavBuffer);
    
    // Spawn whisper
    // Arguments: -m model.bin -f file.wav -nt (no timestamps)
    const args = ['-m', modelPath, '-f', tempWavPath, '-nt'];
    
    // If using multilingual model, pass language parameter
    if (modelPath === WHISPER_MODEL_MULTI && language) {
      args.push('-l', language);
    }

    return new Promise((resolve, reject) => {
      execFile(WHISPER_BIN, args, (error, stdout, stderr) => {
        // Clean up the temp file
        fs.unlink(tempWavPath).catch(() => {});
        
        if (error) {
          console.error('Whisper execution error:', error);
          // Don't reject completely, whisper might still output something to stdout even if it errors
          // But if stdout is empty, resolve to empty string
        }
        
        // Whisper outputs lines like: " [00:00:00.000 --> 00:00:02.000]   Hello world."
        // With -nt, it just outputs " Hello world."
        const text = stdout.replace(/\[.*?\]/g, '').replace(/\r?\n|\r/g, ' ').trim();
        resolve(text);
      });
    });
  } catch (err) {
    console.error('Failed to run whisper:', err);
    // Attempt cleanup just in case
    fs.unlink(tempWavPath).catch(() => {});
    return '';
  }
}
