import { containsProfanity } from './profanityWordList';

export class AudioPipeline {
  constructor({ rawStream, onProfanityDetected, onPipelineReady, onError, onServerModerationResult, socket }) {
    this.rawStream = rawStream;
    this.onProfanityDetected = onProfanityDetected;
    this.onPipelineReady = onPipelineReady;
    this.onError = onError;
    this.onServerModerationResult = onServerModerationResult; // callback for server moderation results
    this.socket = socket; // socket for server-side moderation
    this.audioContext = null;
    this.sourceNode = null;
    this.workletNode = null;
    this.destinationNode = null;
    this.processedStream = null;
    this.isActive = true;
    this.transcripts = []; // Transcripts are now populated by the server if needed
    this.mutedSegments = [];
  }

  async init() {
    try {
      // Create audio processing graph
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
      if (!this.audioContext.audioWorklet) {
        throw new Error('AudioWorklet is not supported in this browser');
      }
      if (typeof this.audioContext.createMediaStreamDestination !== 'function') {
        throw new Error('MediaStreamDestination is not supported in this browser');
      }

      await this.audioContext.audioWorklet.addModule('/profanity-worklet.js');

      this.sourceNode = this.audioContext.createMediaStreamSource(this.rawStream);
      this.workletNode = new AudioWorkletNode(this.audioContext, 'profanity-gate');
      this.destinationNode = this.audioContext.createMediaStreamDestination();

      // Wire: mic → worklet (ring buffer + gate) → destination
      this.sourceNode.connect(this.workletNode);
      this.workletNode.connect(this.destinationNode);

      this.processedStream = this.destinationNode.stream;

      // Handle audio chunks from worklet and stream to server
      this.workletNode.port.onmessage = (event) => {
        if (event.data.type === 'audio-chunk' && this.socket) {
          // Send 16kHz PCM data to server
          this.socket.emit('audio-stream-chunk', {
            chunk: event.data.data,
            roomId: localStorage.getItem('wavetone-active-room') // Include roomId for room context
          });
        }
      };

      // AudioPipeline initialized
      this.onPipelineReady(this.processedStream);
    } catch (err) {
      console.warn('AudioPipeline: failed to initialize, falling back to raw stream', err.message);
      this.processedStream = this.rawStream;
      this.onError?.(err);
      this.onPipelineReady(this.rawStream);
    }
  }



  getTranscripts() {
    return [...this.transcripts];
  }

  // Called from VoiceRoom when server detects profanity
  triggerServerMute() {
    if (this.workletNode) {
      // Retroactive mute, slightly longer duration to cover server latency
      this.workletNode.port.postMessage({ 
        type: 'mute', 
        durationMs: 1500,
        precisionMode: false
      });
    }
  }

  destroy() {
    this.isActive = false;
    this.workletNode?.disconnect();
    this.sourceNode?.disconnect();
    this.audioContext?.close().catch(() => {});
    // AudioPipeline destroyed
  }
}
