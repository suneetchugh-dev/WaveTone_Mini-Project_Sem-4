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
    this.recognition = null;
    this.isActive = true;
    this.transcripts = []; // collected final transcripts for AI summary
    this.lastInterimTranscript = '';
    this.wordTimings = []; // track word timings for word-level precision
    this.recognitionStartTime = 0; // timestamp when recognition started
    this.mutedSegments = []; // track muted segments for better buffering
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

      // Start speech recognition in parallel
      this._startSpeechRecognition();

      // AudioPipeline initialized with 400ms buffer
      this.onPipelineReady(this.processedStream);
    } catch (err) {
      console.warn('AudioPipeline: failed to initialize, falling back to raw stream', err.message);
      this.processedStream = this.rawStream;
      this._startSpeechRecognition(); // still try speech detection even without worklet
      this.onError?.(err);
      this.onPipelineReady(this.rawStream);
    }
  }

  _startSpeechRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.warn('AudioPipeline: SpeechRecognition not available in this browser');
      return;
    }

    this.recognition = new SpeechRecognition();
    this.recognition.continuous = true;
    this.recognition.interimResults = true;
    this.recognition.lang = 'en-US';

    this.recognition.onresult = (event) => {
      let latestInterim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        const cleanedTranscript = transcript?.replace(/\s+/g, ' ').trim() || '';
        const isFinal = event.results[i].isFinal;
        
        // Word-level timing: extract individual words with their positions
        this._extractWordTimings(cleanedTranscript, isFinal);
        
        // Check profanity on both interim and final results for faster detection
        if (cleanedTranscript.length > 0 && containsProfanity(cleanedTranscript)) {
          // Trigger client-side mute with word-level precision
          this._triggerMutePrecise(cleanedTranscript);
          this.onProfanityDetected?.(cleanedTranscript);
          
          // Profanity detected - mute triggered
          
          // Send to server for hybrid moderation verification
          if (this.socket) {
            this._sendToServerModeration(cleanedTranscript);
          }
          break;
        }
        
        // Collect final (non-interim) transcripts for AI summary
        if (isFinal && cleanedTranscript.length > 2) {
          this.transcripts.push(cleanedTranscript);
          this.lastInterimTranscript = '';
        } else if (cleanedTranscript.length > 2) {
          latestInterim = cleanedTranscript;
        }
      }
      if (latestInterim) this.lastInterimTranscript = latestInterim;
    };

    this.recognition.onerror = (event) => {
      // no-speech and aborted are normal — restart silently
      if (event.error === 'no-speech' || event.error === 'aborted') {
        this._restartRecognition();
      }
    };

    this.recognition.onend = () => {
      if (this.isActive) this._restartRecognition();
    };

    try {
      this.recognition.start();
      // SpeechRecognition started
    } catch {
      console.warn('AudioPipeline: SpeechRecognition failed to start');
    }
  }

  _triggerMute() {
    if (this.workletNode) {
      this.workletNode.port.postMessage({ type: 'mute', durationMs: 500 });
    }
  }

  // Word-level precise mute: calculate exact mute duration based on detected word
  _triggerMutePrecise(transcript) {
    // Estimate mute duration based on word length and typical speech rate
    // Average speech rate: 150 words per minute = 2.5 words per second = 400ms per word
    const duration = this._calculateMuteDuration(transcript);
    
    if (this.workletNode) {
      // Use enhanced mute message with word-level precision
      this.workletNode.port.postMessage({ 
        type: 'mute', 
        durationMs: duration,
        wordCount: transcript.trim().split(/\s+/).length,
        precisionMode: true // indicates word-level timing
      });
    }
  }

  _calculateMuteDuration(transcript) {
    const wordCount = transcript.trim().split(/\s+/).length;
    return Math.max(500, Math.min(1200, wordCount * 300)); // Increased from 800ms max to 1200ms
  }

  // Extract word timings for word-level precision
  _extractWordTimings(transcript, isFinal) {
    const currentTime = Date.now();
    if (!this.recognitionStartTime) {
      this.recognitionStartTime = currentTime;
    }
    
    const words = transcript.trim().split(/\s+/);
    const timeBetweenWords = 150; // estimated ms between words
    
    words.forEach((word, index) => {
      if (word.length > 0) {
        const startTime = this.recognitionStartTime + (index * timeBetweenWords);
        const endTime = startTime + (word.length * 30); // rough estimate: 30ms per character
        
        this.wordTimings.push({
          word: word.toLowerCase(),
          startTime,
          endTime,
          wordIndex: index,
          isFinal
        });
      }
    });
  }

  // Send transcript to server for hybrid moderation
  _sendToServerModeration(transcript) {
    if (!this.socket) return;
    
    // Sending to server for moderation verification
    
    // Emit to server for moderation verification
    this.socket.emit('check-profanity-server', {
      transcript,
      wordTimings: this.wordTimings,
      clientDetected: true,
      timestamp: Date.now()
    }, (response) => {
      // Handle server response
      if (response && response.isProfane) {
        // Server confirmed profanity
        this.onServerModerationResult?.({
          confirmed: true,
          badWords: response.badWords,
          confidence: response.confidence
        });
      } else if (response && !response.isProfane) {
        // Server disputed client detection - possible false positive
        // Server says it's not profane - could trigger recovery
        this.onServerModerationResult?.({
          confirmed: false,
          reason: 'Server validation failed - false positive',
          confidence: response.confidence
        });
      }
    });
  }

  _restartRecognition() {
    if (!this.isActive) return;
    try { this.recognition?.stop(); } catch { /* already stopped */ }
    // Reduce restart delay from 300ms to 100ms for faster re-detection
    setTimeout(() => {
      if (this.isActive && this.recognition) {
        try { this.recognition.start(); } catch { /* may fail if already running */ }
      }
    }, 100);
  }

  getTranscripts() {
    const transcripts = [...this.transcripts];
    const fallbackInterim = this.lastInterimTranscript.replace(/\s+/g, ' ').trim();

    if (fallbackInterim.length > 2 && !transcripts.includes(fallbackInterim)) {
      transcripts.push(fallbackInterim);
    }

    // Retrieved transcripts for summary
    return transcripts;
  }

  destroy() {
    this.isActive = false;
    try { this.recognition?.stop(); } catch { /* ok */ }
    this.workletNode?.disconnect();
    this.sourceNode?.disconnect();
    this.audioContext?.close().catch(() => {});
    this.recognition = null;
    // AudioPipeline destroyed
  }
}
