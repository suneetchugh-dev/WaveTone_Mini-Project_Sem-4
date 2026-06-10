// AudioWorklet processor — runs in a separate audio thread
// Implements a ring buffer with a controllable gate for profanity muting
// Enhanced with word-level timing and better buffering logic

class ProfanityGateProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    // Ring buffer: ~400ms at 48kHz = 19200 samples
    this.bufferSize = Math.floor(sampleRate * 0.4);
    this.ringBuffer = new Float32Array(this.bufferSize);
    this.writeIndex = 0;
    this.readIndex = 0;
    this.filled = 0; // how many samples are in the buffer
    this.gateOpen = true;
    this.muteUntilSample = 0;
    this.totalSamples = 0;
    this.mutedSegments = []; // track muted segments for better buffering logic

    // Downsampling state (Target 16kHz for whisper)
    this.targetSampleRate = 16000;
    this.downsampleRatio = sampleRate / this.targetSampleRate;
    this.downsampleCounter = 0;
    
    // Chunking state for sending to main thread
    this.chunkSize = 8000; // 0.5 second chunks at 16kHz
    this.chunkBuffer = new Int16Array(this.chunkSize);
    this.chunkIndex = 0;

    // Listen for mute commands from main thread
    this.port.onmessage = (event) => {
      if (event.data.type === 'mute') {
        const muteDuration = event.data.durationMs || 500;
        const muteSamples = Math.floor(sampleRate * muteDuration / 1000);
        const precisionMode = event.data.precisionMode || false;
        const wordCount = event.data.wordCount || 1;
        
        // Better buffering: Track muted segments for potential recovery or replay
        this.mutedSegments.push({
          startSample: this.totalSamples,
          endSample: this.totalSamples + muteSamples,
          duration: muteDuration,
          wordCount: wordCount,
          precisionMode: precisionMode,
          timestamp: Date.now()
        });
        
        // Keep only last 10 muted segments to avoid memory bloat
        if (this.mutedSegments.length > 10) {
          this.mutedSegments.shift();
        }
        
        this.gateOpen = false;
        this.muteUntilSample = this.totalSamples + muteSamples;
      }
    };
  }

  process(inputs, outputs) {
    const input = inputs[0];
    const output = outputs[0];

    if (!input || !input[0] || !output || !output[0]) return true;

    const inputChannel = input[0];
    const outputChannel = output[0];
    const blockSize = inputChannel.length; // typically 128 samples

    for (let i = 0; i < blockSize; i++) {
      // Write incoming sample to ring buffer
      this.ringBuffer[this.writeIndex] = inputChannel[i];
      this.writeIndex = (this.writeIndex + 1) % this.bufferSize;
      this.filled = Math.min(this.filled + 1, this.bufferSize);
      this.totalSamples++;

      // Check if mute period has ended
      if (!this.gateOpen && this.totalSamples >= this.muteUntilSample) {
        this.gateOpen = true;
      }

      // Read from buffer (delayed output) once buffer has enough data
      if (this.filled >= this.bufferSize) {
        if (this.gateOpen) {
          outputChannel[i] = this.ringBuffer[this.readIndex];
        } else {
          outputChannel[i] = 0; // silence when gate is closed
        }
        this.readIndex = (this.readIndex + 1) % this.bufferSize;
      } else {
        // Buffer still filling — output silence during initial delay
        outputChannel[i] = 0;
      }
      
      // Downsampling logic for server-side processing
      this.downsampleCounter += 1;
      if (this.downsampleCounter >= this.downsampleRatio) {
        this.downsampleCounter -= this.downsampleRatio;
        
        // Convert Float32 to Int16
        let sample = inputChannel[i];
        // Clamp
        sample = Math.max(-1, Math.min(1, sample));
        // Scale to 16-bit integer
        this.chunkBuffer[this.chunkIndex++] = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
        
        if (this.chunkIndex >= this.chunkSize) {
          // Send chunk to main thread
          this.port.postMessage({
            type: 'audio-chunk',
            data: this.chunkBuffer.buffer.slice(0) // copy buffer
          });
          this.chunkIndex = 0;
        }
      }
    }

    return true; // keep processor alive
  }
}

registerProcessor('profanity-gate', ProfanityGateProcessor);
