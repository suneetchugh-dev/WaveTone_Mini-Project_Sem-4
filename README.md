# WaveTone

WaveTone is a cutting-edge, anonymous voice room platform designed for real-time peer-to-peer communication. Built with modern web technologies, it emphasizes privacy, accessibility, and elegant design.

---


## Features

- **Anonymous Voice Rooms**: Connect without revealing your identity.
- **Real-Time Communication**: Powered by WebRTC and Socket.io.
- **Advanced Moderation**: Profanity filters, warning systems, and vote-kick mechanisms.
- **AI-Powered Summaries**: Post-session summaries using Groq SDK and fallback summaries.
- **Customizable Rooms**: Set topics, categories, and participant limits.
- **Responsive Design**: Optimized for both desktop and mobile.

---

## Tech Stack

### Frontend
- React.js, Vite, React Router
- Web Audio API, Web Speech API
- CSS3 with glassmorphism and animations

### Backend
- Node.js, Express.js, Socket.io
- MongoDB Atlas, Mongoose
- Groq SDK, WebRTC

---

## Project Structure

```
CodeBase/
├── client/                  # React frontend
│   ├── index.html           # Entry HTML
│   ├── vite.config.js       # Vite config
│   ├── public/              # Static assets
│   └── src/                 # Source code
│       ├── App.jsx          # Root component
│       ├── pages/           # React pages
│       ├── audio/           # Audio pipeline
│       └── services/        # API and socket helpers
├── server/                  # Node backend
│   ├── index.js             # Entry point
│   ├── src/                 # Source code
│       ├── controllers/     # API controllers
│       ├── routes/          # API routes
│       ├── models/          # Database models
│       └── utils/           # Utility functions
└── Z+ Updates & Help/       # Documentation
```

---

## Getting Started

### Prerequisites
- Node.js v18+
- MongoDB Atlas account
- Groq API Key

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/WaveTone.git
cd WaveTone/CodeBase

# Install dependencies
cd client && npm install
cd ../server && npm install
```

### Environment Variables

Create a `.env` file in `server/` with the following:
```
MONGO_URI=your_mongodb_connection_string
GROQ_API_KEY=your_groq_api_key
```

### Run Locally

```bash
# Start backend
cd server
npm run dev

# Start frontend
cd client
npm run dev
```

---

## Docker (Production and Development)

Recommended layout: keep the `client` and `server` folders under `CodeBase/`, and place the production `docker-compose.yml` at the repository root. For development you can use the provided `docker-compose.dev.yml` which uses bind-mounts and runs dev servers inside containers.

Production quick run (from repository root):

```bash
docker compose up --build
```

Development quick run (bind-mounts, nodemon, and vite dev server):

```bash
# from repository root
docker compose -f docker-compose.dev.yml up --build
```

Important notes and best practices:
- Do NOT mount your application source directory into a production container image (i.e. avoid host bind-mounts) — doing so can mask files that were built into the image (for example `node_modules`) and cause missing-dependency errors. The production `docker-compose.yml` intentionally does not include any `volumes:` for this reason.
- Use `docker-compose.dev.yml` for local iterative development; it mounts source directories and starts `nodemon` / `vite` for live reload.
- Keep secrets out of your Git repository. Use `.env` files referenced in your compose files or CI/CD secrets.
- When deploying to a cloud provider, ensure your `MONGO_URI` and any API keys are provided as environment variables.

If you previously had a `docker-compose.yml` inside `CodeBase/`, it has been moved to the repository root to follow common conventions (so `docker compose up` works from the project root).

---

## Deployment

### Frontend
- Deploy `client/dist/` to Vercel.
- Set `VITE_API_URL` environment variable.

### Backend
- Deploy `server/` to Railway or Render.
- Set `MONGO_URI`, `GROQ_API_KEY`, and `PORT`.

---

## Recent Enhancements (Latest)

### Real-Time Participant Count on Browse Page
- **Instant Updates**: Participant count now updates in real-time using Socket.io instead of polling
- **Reduced Server Load**: Eliminated 10-second polling interval, now using event-driven updates
- **Better UX**: Users see immediate participant changes when someone joins or leaves
- **Fallback Polling**: Still polls every 30 seconds as fallback for resilience

### Sub-Host Role System
- **Multiple Sub-Hosts**: Host can assign multiple Sub-Hosts with hierarchical ranking (primary + backup roles)
- **Automatic Promotion**: Sub-Host automatically promoted to Host if Host leaves and doesn't return within 5 minutes
- **UI Indicators**: Clear visual indication of Host and Sub-Hosts with their respective roles
- **Revocable Status**: Host can revoke Sub-Host status at any time
- **Session Continuity**: Ensures the session remains managed even if the original Host leaves

### Enhanced Profanity Detection
- **Improved Mute Duration**: Increased from 500ms to 1200ms max with intelligent word-count scaling
- **Better Logging**: Comprehensive detection logs with timestamps, word counts, and mute durations
- **Server Verification**: Enhanced server-side validation with confidence levels and false-positive detection
- **Word-Level Precision**: Improved word timing extraction for more accurate muting

### Professional Kick/Ban Messages
- **Host Kicks**: `"You have been removed by the Host ({hostAlias}) for moderation reasons."`
- **Vote-Kicks**: `"You were vote-kicked by participants ({votes}/{required} votes)."`
- **Profanity Auto-Kicks**: `"Removed after 3 profanity warnings."`
- **Broadcast Details**: Room receives context about removals via `user-kicked` event

---

## Known Limitations & Planned Enhancements

### Current Limitations

#### Profanity Detection
- **Speech Recognition Delays**: Browser speech recognition may not transcribe words accurately, especially for slang, accents, or fast speech.
- **Mute Timing**: Audio may pass through briefly due to processing delay before muting takes effect.
- **AudioWorklet Delay**: The worklet only mutes after receiving a message from the main thread, introducing latency.
- **Detection Accuracy**: Current regex-based detection may miss variations or unexpected character combinations.

#### Host Role Management
- **No Host Transfer**: If the Host leaves, there is currently no auto-assignment of a new Host, potentially leaving the room unmanaged.

### Planned Enhancements

#### Sub-Host Role (✅ Implemented)
- ✅ Implement a **Sub-Host** role that can be assigned by the Host
- ✅ Add UI button for Host to assign/revoke Sub-Host status
- ✅ Support **multiple Sub-Hosts** with ranking for backup hierarchy
- ✅ Automatic promotion: Sub-Host becomes Host if Host leaves (with 5-minute timeout)
- ✅ Clear UI indication of Host and Sub-Hosts with their roles
- ✅ Enable Host to revoke Sub-Host status at any time
- ✅ Add timeout mechanism before automatic promotion

#### Enhanced Profanity Detection
- ✅ Improved mute duration calculation (up to 1200ms)
- ✅ Enhanced logging for debugging
- ✅ Better server verification
- [ ] Consider integrating TensorFlow.js toxicity model for more robust detection
- [ ] Add language and accent support improvements
- [ ] Implement pre-muting before detected words when possible

#### User Experience Improvements
- ✅ Professional kick/ban notification messages
- ✅ Detailed logging for transcript analysis
- [ ] Add testing utilities for profanity detection validation
- [ ] Improve error messaging clarity

---

## Documentation

- **Project_Info.txt**: Architecture and data flows.
- **Future Upgrades AI.txt**: AI feature roadmap.
- **AI_Recommendations.txt**: Prioritized feature recommendations.
- **Viva_Questions.txt**: Viva preparation Q&A.

---

**WaveTone**: *Connect anonymously. Speak freely. Listen respectfully.*
