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
    this.recognition = null;
    this.isSpeechRecognitionSupported = false;
    this.isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    this.speechRecognitionActive = false;
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

      // Listen for transcripts from the server
      if (this.socket) {
        this.socket.on('transcript-chunk', ({ alias, text }) => {
          if (this.isActive && text && text.trim().length > 0) {
            console.log(`[Speech-to-Text] ${alias}: ${text}`);
            this.transcripts.push(`${alias}: ${text}`);
          }
        });
      }

      // Initialize desktop-only SpeechRecognition fallback
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SpeechRecognition && !this.isMobile) {
        this.isSpeechRecognitionSupported = true;
        this.recognition = new SpeechRecognition();
        this.recognition.continuous = true;
        this.recognition.interimResults = true;
        this.recognition.lang = 'en-US';

        this.recognition.onresult = (event) => {
          for (let i = event.resultIndex; i < event.results.length; i++) {
            const transcript = event.results[i][0].transcript;
            const cleanedTranscript = transcript?.replace(/\s+/g, ' ').trim() || '';
            const isFinal = event.results[i].isFinal;
            
            // Client-side quick check
            if (cleanedTranscript.length > 0 && containsProfanity(cleanedTranscript)) {
              this._triggerMutePrecise(cleanedTranscript);
              this.onProfanityDetected?.(cleanedTranscript);
              if (this.socket) {
                this._sendToServerModeration(cleanedTranscript);
              }
              break;
            }
            
            // Backup final transcripts for summary
            if (isFinal && cleanedTranscript.length > 0) {
              const formattedEntry = `Guest: ${cleanedTranscript}`;
              if (!this.transcripts.includes(formattedEntry)) {
                console.log(`[Local Speech-to-Text Backup] Guest: ${cleanedTranscript}`);
                this.transcripts.push(formattedEntry);
              }
            }
          }
        };

        this.recognition.onerror = (event) => {
          console.warn('Local SpeechRecognition error:', event.error);
          // Stop auto-restart loop for fatal/persistent errors
          if (['network', 'not-allowed', 'service-not-allowed', 'language-not-supported'].includes(event.error)) {
            this.speechRecognitionActive = false;
          }
        };

        this.recognition.onend = () => {
          if (this.isActive && this.speechRecognitionActive) {
            this._restartRecognition();
          }
        };
      }

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

  _triggerMutePrecise(transcript) {
    const wordCount = transcript.trim().split(/\s+/).length;
    const duration = Math.max(500, Math.min(1200, wordCount * 300));
    if (this.workletNode) {
      this.workletNode.port.postMessage({ 
        type: 'mute', 
        durationMs: duration,
        wordCount: wordCount,
        precisionMode: true
      });
    }
  }

  _sendToServerModeration(transcript) {
    if (!this.socket) return;
    this.socket.emit('check-profanity-server', {
      transcript,
      wordTimings: [],
      clientDetected: true,
      timestamp: Date.now()
    }, (response) => {
      if (response && response.isProfane) {
        this.onServerModerationResult?.({
          confirmed: true,
          badWords: response.badWords,
          confidence: response.confidence
        });
      } else if (response && !response.isProfane) {
        this.onServerModerationResult?.({
          confirmed: false,
          reason: 'Server validation failed - false positive',
          confidence: response.confidence
        });
      }
    });
  }

  _restartRecognition() {
    if (!this.isActive || !this.speechRecognitionActive || !this.recognition) return;
    try { this.recognition.stop(); } catch {}
    setTimeout(() => {
      if (this.isActive && this.speechRecognitionActive && this.recognition) {
        try { this.recognition.start(); } catch {}
      }
    }, 200);
  }

  toggleSpeechRecognition(muted) {
    if (!this.isSpeechRecognitionSupported || !this.recognition) return;
    const shouldBeActive = !muted;
    if (shouldBeActive === this.speechRecognitionActive) return;
    this.speechRecognitionActive = shouldBeActive;
    if (shouldBeActive) {
      console.log('Starting client-side SpeechRecognition backup...');
      try {
        this.recognition.start();
      } catch (err) {
        console.warn('Failed to start SpeechRecognition:', err.message);
      }
    } else {
      console.log('Stopping client-side SpeechRecognition backup...');
      try {
        this.recognition.stop();
      } catch (err) {
        console.warn('Failed to stop SpeechRecognition:', err.message);
      }
    }
  }

  destroy() {
    this.isActive = false;
    this.speechRecognitionActive = false;
    if (this.socket) {
      this.socket.off('transcript-chunk');
    }
    try {
      this.recognition?.stop();
    } catch {}
    this.recognition = null;
    this.workletNode?.disconnect();
    this.sourceNode?.disconnect();
    this.audioContext?.close().catch(() => {});
    // AudioPipeline destroyed
  }
}
