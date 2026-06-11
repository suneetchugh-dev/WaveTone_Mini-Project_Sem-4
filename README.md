# WaveTone

> Connect anonymously. Speak freely. Listen respectfully.

WaveTone is a cutting-edge, privacy-first anonymous voice room platform designed for focused, real-time peer-to-peer discussions. Built with low-latency WebRTC and a multi-layered hybrid AI moderation engine, WaveTone ensures safe conversations without compromising user privacy.

---

## 🌟 What Makes WaveTone Unique?

WaveTone is engineered from the ground up to offer a premium, secure, and private voice discussion experience:

*   **Zero-Trust Ephemerality (No Accounts & No Recordings)**
    *   No registration, email, or passwords required. 
    *   Audio is streamed peer-to-peer and processed in-memory. **Zero audio files and zero session transcripts are ever stored** on any database or server.
*   **Hybrid Client-Server AI Moderation**
    *   **On-Device TF.js Classifier**: Detects toxic language inside the user's browser before it leaves their machine.
    *   **Multilingual Whisper Speech-to-Text**: Converts real-time stream chunks into text in the background.
    *   **Groq LLM Verification**: Leverages Llama models to review flagged content with a validation loop, protecting against false positives and restoring speech context.
*   **Sub-Second Audio Muting (Profanity Gate)**
    *   A custom `AudioWorklet` processor implements a ring-buffer gate to retroactively mute offending utterances within milliseconds of detection.
*   **Resilient Host Promotion & Sub-Hosts Hierarchy**
    *   Hosts can designate multiple Sub-Hosts with ranked hierarchies. If the Host goes offline, a ranked Sub-Host is automatically promoted to Host after a 5-minute grace period to prevent room collapse.
*   **State-of-the-Art Premium UX/UI**
    *   **Glassmorphism & Backdrop Blurs**: Vibrant glassmorphic card layouts over custom ambient video backgrounds.
    *   **Glowing Lamp Beam Effects**: Cascading dynamic glow indicators on cards representing room portals.
    *   **Skeleton Loader Shimmers**: Smooth shimmer animations for components waiting for server data.
    *   **Active Speaker Indicators**: Real-time pulsing soundwave animations for participants who are speaking.

---

## 🚀 Core Features

WaveTone is packed with features designed to make voice rooms collaborative, manageable, and highly interactive:

*   **Customizable Ephemeral Rooms**
    *   **Custom Settings**: Set room topics, categories, and participant limits (up to 10 users) on creation.
    *   **Language Specific Context**: Select room languages (English, Spanish, French, German, Hindi, Portuguese) to customize transcription and dictionary filters.
    *   **Private/Public Visibility**: Toggle rooms between public (visible on the Browse page) and private (accessible only via a direct URL link).
*   **Real-Time Collaborative Moderation**
    *   **Democratic Vote-Kick**: Participants can start a vote to kick disruptive users, requiring a simple majority to remove them.
    *   **Host Kick & Ban**: Hosts can kick users directly and ban their IP addresses from rejoining the room.
    *   **Dynamic Warnings & Auto-Kicks**: Sends automated toast notifications to users when profanity is detected. Users are automatically kicked after 3 warnings.
*   **Post-Session Summary Dashboard**
    *   **Ephemerality Safe Summaries**: After a room ends, view a dashboard showing session duration, participant count, and participant lists using random aliases.
    *   **Groq AI Summarization**: Automatically processes text transcripts via Groq Llama models to generate a clean, 2-4 sentence summary of what was discussed (safely stripped of any personal identifiers). Includes a local NLP-based fallback generator if the AI API is unreachable.
*   **Interactive Moderation Sandbox & Admin Queue**
    *   **Interactive Sandbox (About Page)**: Test text snippets or upload audio files (e.g. WAV, MP3) to see real-time transcription, latency, dictionary matching, and TF.js classifier breakdown scores.
    *   **Admin Review Queue**: Live review panel showing recent flagged utterances where administrators can confirm swears or mark false positives to refine filter parameters.

---

## 🛠 Tech Stack

### Frontend
*   React.js, Vite, Framer Motion
*   Web Audio API, Web Speech API (SpeechRecognition fallback)
*   CSS3 variables with glassmorphism, shimmers, and lamp filters

### Backend
*   Node.js, Express.js, Socket.io
*   MongoDB Atlas, Mongoose
*   Groq SDK, WebRTC

---

## 📁 Project Structure

```
CodeBase/
├── client/                  # React frontend
│   ├── index.html           # Entry HTML
│   ├── vite.config.js       # Vite config
│   ├── public/              # Static assets (including profanity-worklet.js)
│   └── src/                 # Source code
│       ├── App.jsx          # Root component
│       ├── pages/           # React pages (BrowseRooms, VoiceRoom, About, etc.)
│       ├── audio/           # Audio pipeline (AudioPipeline.js, profanity lists)
│       └── services/        # API and Socket helpers
├── server/                  # Node backend
│   ├── index.js             # Entry point
│   ├── src/                 # Source code
│       ├── controllers/     # API controllers (Room details, AI summaries)
│       ├── routes/          # API routes (Moderation, rooms, summaries)
│       ├── models/          # Database models (Room, FlaggedContent)
│       └── utils/           # Utility functions (Whisper, profanity lists)
└── Z+ Improvements/         # Backlog & Offline Mode Documentation
```

---

## 🚀 Getting Started

### Prerequisites
*   Node.js v18+
*   MongoDB Atlas account
*   Groq API Key

### Installation

```bash
# Clone the repository
git clone https://github.com/suneetchugh-dev/WaveTone_Mini-Project_Sem-4.git
cd WaveTone_Mini-Project_Sem-4/CodeBase

# Install frontend dependencies
cd client && npm install

# Install backend dependencies
cd ../server && npm install
```

### Environment Variables

Create a `.env` file in the `CodeBase/server/` directory:
```env
MONGO_URI=your_mongodb_connection_string
GROQ_API_KEY=your_groq_api_key
PORT=5000
```

### Run Locally

```bash
# Start backend (from CodeBase/server)
npm run dev

# Start frontend (from CodeBase/client in a separate terminal)
npm run dev
```

---

## 🐳 Docker (Production and Development)

The project includes pre-configured Docker environments. Place the `docker-compose` files at the root of the repository.

### Production Build & Launch (Nginx + Node production image)
```bash
docker compose up --build
```

### Local Development (Live Reload + Bind Mounts)
```bash
docker compose -f docker-compose.dev.yml up --build
```
> [!NOTE]
> Client Nginx configuration (`nginx.conf`) is excluded from `.dockerignore` to ensure production builds compile successfully. Heavy assets, binaries, and local developer caches (`bin/`, `models/`, `temp/`) are ignored in `CodeBase/server/.dockerignore` to minimize production image footprint.

---

## 🧪 Developer Testing & Utilities

WaveTone includes a terminal-native test validation suite to verify the profanity filter's regex rules, word-masking algorithms, and multilingual checks.

### Run Profanity Tests
To run the automated validation test suite:
```bash
cd CodeBase/server
npm run test:profanity
```

### Test Scope
*   **Classification**: Validates standard swearing, leet-speak (e.g. `f*ck`, `sh1t`), spaced characters (e.g. `s h i t`), and multilingual profanity (French, Spanish, German, Hindi).
*   **Masking**: Confirms correct word obscuring (e.g., `shit` ➔ `s***`).
*   **Extraction**: Verifies words are correctly isolated from sentences.
*   **Performance Latency**: Runs 1,000 checks in a loop and prints average processing latency in microseconds to guarantee WebRTC real-time safety suitability.

---

## 📈 Recent Enhancements

### 1. Robust Server-Side & Client Error Handling (New)
*   **Granular Mic Diagnostics**: Detects and displays clear user instructions for browser microphone blocks (`NotAllowedError`), missing devices (`NotFoundError`), or microphone conflicts (`NotReadableError`).
*   **Mongoose Validations**: Room creation errors now extract exact field-validation issues (e.g., missing topic) instead of generic crashes.
*   **Malformed IDs**: Checks malformed mongo IDs (`CastError`) and returns `400 Invalid ID format` to prevent 500 crashes.
*   **Secure Routing Fallbacks**: Socket and navigation failures cleanly redirect back to `/browse` with context-toast error payloads, rather than hijacking URLs.

### 2. Developer Validation Testing Suite (New)
*   **Profanity Verification CLI**: Automated regression test utility detailing classification accuracy, precision, recall, and F1-score.

### 3. Real-Time Participant Updates
*   **Event-Driven Sync**: Browse page participant counts update in real-time using Socket.io instead of server-heavy polling.

### 4. Advanced Sub-Host Role System
*   **Failover Promotions**: Support for multiple Sub-Hosts with ranked promotions if the Host drops off.

---

**WaveTone**: *Connect anonymously. Speak freely. Listen respectfully.*
