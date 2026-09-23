# FellowGrad AI — Technical Architecture & Technology Stack Documentation

> **Document Type:** System Architecture & Technical Stack Specification  
> **Repository:** `D:\FellowGrad-AI`  
> **Status:** Current Production Architecture (Verified against active codebase)  
> **Academic Session:** 2026 / 2026–27  
> **Primary Persona:** FellowGrad (Maya) — Strictly Education-Focused AI Companion  

---

## Table of Contents

1. [Executive Summary & System Overview](#1-executive-summary--system-overview)
2. [End-to-End Architectural Data Flow](#2-end-to-end-architectural-data-flow)
3. [Frontend Technology Stack](#3-frontend-technology-stack)
4. [Backend Technology Stack](#4-backend-technology-stack)
5. [AI & Gemini Live Technology](#5-ai--gemini-live-technology)
6. [Gemini Live Voice Pipeline & Audio Architecture](#6-gemini-live-voice-pipeline--audio-architecture)
7. [Voice Personas & Voice Selection](#7-voice-personas--voice-selection)
8. [Android Native Audio Modules](#8-android-native-audio-modules)
9. [WebSocket Architecture & Live Protocol](#9-websocket-architecture--live-protocol)
10. [Voice Activity Detection (VAD) & Turn-Taking Engine](#10-voice-activity-detection-vad--turn-taking-engine)
11. [Education Domain & Knowledge Retrieval Layer](#11-education-domain--knowledge-retrieval-layer)
12. [Authentication & Account Security System](#12-authentication--account-security-system)
13. [Google Cloud Firestore Database Architecture](#13-google-cloud-firestore-database-architecture)
14. [Long-Term Memory Architecture](#14-long-term-memory-architecture)
15. [Conversation History & Historical Search Engine](#15-conversation-history--historical-search-engine)
16. [Incognito & Ephemeral Privacy Mode](#16-incognito--ephemeral-privacy-mode)
17. [User Profile & Personalization Schema](#17-user-profile--personalization-schema)
18. [Complete API Endpoints Catalog](#18-complete-api-endpoints-catalog)
19. [Google Cloud & Production Infrastructure](#19-google-cloud--production-infrastructure)
20. [Environment Variables Specification](#20-environment-variables-specification)
21. [Android Build & Standalone Release APK Pipeline](#21-android-build--standalone-release-apk-pipeline)
22. [Automated Verification & Test Benchmark Results](#22-automated-verification--test-benchmark-results)
23. [Complete Repository Directory Map](#23-complete-repository-directory-map)
24. [Security & Isolation Architecture](#24-security--isolation-architecture)

---

## 1. Executive Summary & System Overview

**FellowGrad AI** is a real-time, voice-first personal academic companion built specifically for students. It simulates a natural, full-duplex conversational telephone call between a student and an AI mentor ("Maya"). 

### Key Characteristics
- **Strictly Education-Focused:** Constrained exclusively to academics, colleges, courses, admissions, exams, syllabi, scholarships, placements, internships, and student learning. General non-education queries receive a polite, standardized educational redirection.
- **Coimbatore, Tamil Nadu & India Priority:** In-depth knowledge of Coimbatore institutions (PSG Tech, CIT, GCT, KCT, Bharathiar University, TNAU, etc.) and Tamil Nadu admission routes (TNEA, TNGASA, TANCET) for the **2026 / 2026–27** academic cycle.
- **Multilingual & Conversational Tanglish:** Seamlessly understands and responds in natural English, Tamil, and Tanglish (Tamil + English code-mixing) without rigid slang or artificiality.
- **Full-Duplex Phone-Call Model:** Uses continuous bidirectional audio streaming over WebSockets, hardware-accelerated Acoustic Echo Cancellation (AEC), and real-time interruption (barge-in) yielding under 50ms.
- **Zero Hallucination Policy:** Does not fabricate college cutoff marks, fees, admission deadlines, or subjective rankings. Cutoffs and fees are explicitly tied to official portals (DOTE/TNEA) and categorized by quota (Government vs. Management).
- **Persistent Personal Memory:** Stores academic milestones, projects, and learning preferences in Google Cloud Firestore while honoring strict privacy controls (Incognito mode and memory toggles).

---

## 2. End-to-End Architectural Data Flow

```mermaid
flowchart TD
    subgraph Client ["Android Client (React Native + Kotlin)"]
        MIC["Mobile Microphone (16kHz Mono PCM)"]
        AR["AudioRecord (VOICE_COMMUNICATION + AEC + NS)"]
        ASM["AudioStreamModule.kt (Native)"]
        AIS["audioInputService.ts"]
        AOS["audioOutputService.ts"]
        AT["AudioTrack (24kHz Mono Stream, USAGE_VOICE_COMMUNICATION)"]
        SPK["Loudspeaker / Earpiece"]
        FWS["WebSocket Client (wss://.../ws/live)"]
        RN_NAV["React Navigation (Auth Stack / Main Stack)"]
        AUTH_CTX["AuthContext (AsyncStorage + JWT)"]
    end

    subgraph Backend ["Google Cloud Run (Node.js + Express)"]
        BWS["WebSocket Server (/ws/live)"]
        LVC["liveVoiceSocket.js"]
        EDU_INTENT["EducationIntentService.js"]
        EDU_SEARCH["EducationSearchService.js"]
        EDU_DATA["coimbatoreData.js (16 Verified Institutions)"]
        HIST_RECALL["ConversationSearchService.js (Date/Topic Search)"]
        MEM_SRV["MemoryService.js (Extraction & Injection)"]
        CONV_SRV["ConversationService.js"]
        AUTH_SRV["AuthService.js (Bcrypt + JWT)"]
        G_LIVE["GeminiLiveService.js (@google/genai Vertex AI)"]
    end

    subgraph Cloud ["Google Cloud Platform & Vertex AI"]
        VAI["Vertex AI Gemini Live API (gemini-live-2.5-flash-native-audio)"]
        FS[("Google Cloud Firestore (users, conversations, memories)")]
    end

    %% Audio Ingestion Flow
    MIC --> AR --> ASM --> AIS --> FWS
    FWS -->|PCM Chunks (50ms base64)| BWS
    BWS --> LVC --> G_LIVE
    G_LIVE -->|Realtime Bidirectional Stream| VAI

    %% Realtime Turn-Taking Context Injection
    VAI -->|User Speech Transcription| G_LIVE
    G_LIVE -->|onTranscript: USER| LVC
    LVC --> EDU_INTENT --> EDU_SEARCH
    EDU_DATA -.-> EDU_SEARCH
    EDU_SEARCH -->|Grounded Facts / Redirect| G_LIVE
    LVC --> HIST_RECALL -->|Historical Turn Context| G_LIVE
    G_LIVE -->|sendTextMessage Injection| VAI

    %% Audio Playback Flow
    VAI -->|Streaming 24kHz Audio Response| G_LIVE
    G_LIVE -->|Audio Chunks| LVC --> BWS
    BWS -->|WebSocket 'audio' Event| FWS
    FWS --> AOS --> ASM --> AT --> SPK

    %% Interruption / Barge-in Flow
    AR -.->|User Speaks While Assistant Talking| VAI
    VAI -->|Server Interrupted Signal| G_LIVE
    G_LIVE -->|'interrupted' Event| LVC --> FWS
    FWS -->|flushPlayer()| AOS --> ASM -->|pause() + flush() + play()| AT

    %% Persistence Flow
    LVC -.->|Async Message Save| CONV_SRV --> FS
    LVC -.->|Async Memory Extraction| MEM_SRV --> FS
    AUTH_CTX <-->|REST API (/api/auth)| AUTH_SRV --> FS
```

---

## 3. Frontend Technology Stack

| Category | Technology | Version | Purpose | File Location |
| :--- | :--- | :--- | :--- | :--- |
| **Framework** | React Native | `0.86.2` | Core mobile application framework | `frontend/package.json` |
| **Core UI Engine** | React | `19.2.3` | Reactive component rendering | `frontend/package.json` |
| **Language** | TypeScript | `^5.8.3` | Type-safe application development | `frontend/tsconfig.json` |
| **Build CLI** | React Native Community CLI | `20.1.0` | CLI bundling and native orchestration | `frontend/package.json` |
| **Bundler** | Metro | `0.86.2` | JavaScript bundler for React Native | `frontend/metro.config.js` |
| **Navigation Core** | `@react-navigation/native` | `^7.3.16` | Application navigation container | `frontend/src/navigation/AppNavigator.tsx` |
| **Stack Navigation** | `@react-navigation/stack` | `^7.10.22` | Card-based screen transitions | `frontend/src/navigation/AppNavigator.tsx` |
| **Screen Optimization**| `react-native-screens` | `^4.27.0` | Native view hierarchy optimization | `frontend/android/app/build.gradle` |
| **Gesture System** | `react-native-gesture-handler`| `^3.1.0` | High-performance touch gesture handling | `frontend/App.tsx` |
| **Safe Areas** | `react-native-safe-area-context`| `^5.8.1` | Edge-to-edge layout & status bar insets | `frontend/App.tsx` |
| **Vector Graphics** | `react-native-svg` | `^15.15.5` | SVG icons, avatars, and visual assets | `frontend/src/components/VoiceOrb/` |
| **Styling Pipeline** | `react-native-sass-transformer` / `sass` | `^3.0.0` / `^1.102.0` | SCSS modules compiled to RN style objects | `frontend/metro.config.js`, `HomeScreen.scss` |
| **Local Storage** | `@react-native-async-storage/async-storage` | `^3.1.1` | Tokens (`accessToken`, `refreshToken`), preferences | `frontend/src/context/AuthContext.tsx` |
| **HTTP Client** | Axios | `^1.19.0` | REST API communication with Cloud Run | `frontend/src/services/api/apiClient.ts` |
| **Voice Transport** | Native WebSocket | Built-in | Bidirectional audio streaming over WSS | `frontend/src/services/geminiLiveService.ts` |
| **Native Audio Engine**| `AudioStreamModule.kt` | Custom Native | 16kHz AudioRecord capture + 24kHz AudioTrack | `frontend/android/app/src/main/java/...` |
| **Speech Fallback** | `react-native-tts` | `^4.1.1` | Local Android Text-to-Speech fallback | `frontend/package.json` |

---

## 4. Backend Technology Stack

| Category | Technology | Version | Purpose | File Location |
| :--- | :--- | :--- | :--- | :--- |
| **Runtime** | Node.js | `>= 22.11.0` | Server-side JavaScript runtime engine | `backend/package.json` |
| **Web Framework** | Express.js | `^4.21.2` | REST API routing and middleware pipeline | `backend/src/app.js` |
| **WebSocket Engine**| `ws` | `^8.18.0` | High-throughput binary/text WebSocket proxy (`/ws/live`)| `backend/src/sockets/liveVoiceSocket.js` |
| **Realtime Gateway**| `socket.io` | `^4.8.1` | Auxiliary event notifications and socket bridge | `backend/src/sockets/socketHandler.js` |
| **AI SDK** | `@google/genai` | `^2.23.0` | Vertex AI Gemini Live API client library | `backend/src/services/geminiLiveService.js`|
| **Cloud Database** | `@google-cloud/firestore` | `^9.2.0` | Google Cloud Firestore client for user data | `backend/src/config/firestore.js` |
| **Firebase Admin** | `firebase-admin` | `^14.4.0` | Application Default Credentials (ADC) management | `backend/src/config/firestore.js` |
| **Authentication** | `jsonwebtoken` | `^9.0.2` | JWT generation and cryptographic verification | `backend/src/services/authService.js` |
| **Password Security**| `bcryptjs` | `^2.4.3` | Salted SHA-512 password hashing (10 rounds) | `backend/src/services/authService.js` |
| **HTTP Client** | Axios | `^1.7.9` | Outbound HTTP requests to Google APIs | `backend/src/services/geminiService.js` |
| **ID Generation** | `uuid` | `^11.0.5` | Cryptographically secure RFC4122 UUID v4 | `backend/src/services/conversationService.js`|
| **Multi-Part Parser**| `multer` | `^1.4.5-lts.1` | Multi-part audio payload buffer parsing | `backend/src/routes/voiceRoutes.js` |
| **CORS Middleware** | `cors` | `^2.8.5` | Cross-Origin Resource Sharing policy | `backend/src/app.js` |
| **Configuration** | `dotenv` | `^16.4.7` | Local `.env` environment loading | `backend/src/server.js` |
| **Relational DB** | `pg` | `^8.13.1` | Optional PostgreSQL client connector | `backend/src/config/database.js` |
| **Document DB** | `mongoose` | `^8.9.5` | Optional MongoDB connector | `backend/src/config/database.js` |

---

## 5. AI & Gemini Live Technology

### Gemini Live Native Audio Model
- **Live Model Identifier:** `gemini-live-2.5-flash-native-audio`
- **Configured In:** `backend/src/config/geminiLive.js` (`geminiLiveConfig.model`)
- **SDK Class:** `GoogleGenAI` from `@google/genai`
- **Client Mode:** Vertex AI Enterprise (`vertexai: true`, `project: 'fellowgrad-ai'`, `location: 'global'`)
- **Connection Method:** `ai.live.connect({ model, config, callbacks })`
- **Session Modality:** `responseModalities: ['AUDIO']`
- **Realtime Transcriptions:** 
  - `inputAudioTranscription: {}` (Transcribes incoming student speech)
  - `outputAudioTranscription: {}` (Streams assistant speech transcription)

### Secondary / REST Model
- **Model Identifier:** `gemini-1.5-flash`
- **Endpoint:** `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent`
- **Use Case:** Background memory extraction (`MemoryService._extractWithGemini`) and legacy REST chat endpoints.
- **Search Grounding:** Integrated with `tools: [{ googleSearch: {} }]`.

---

## 6. Gemini Live Voice Pipeline & Audio Architecture

### Audio Format Specifications

| Parameter | Input Stream (Microphone) | Output Stream (Speaker) |
| :--- | :--- | :--- |
| **Sample Rate** | `16,000 Hz` (16kHz) | `24,000 Hz` (24kHz) |
| **Bit Depth** | `16-bit Linear PCM` (Little-Endian) | `16-bit Linear PCM` (Little-Endian) |
| **Channels** | `1` (Mono) | `1` (Mono) |
| **Chunk Duration** | `50 ms` | Variable chunk streaming from Gemini |
| **Chunk Size (Bytes)**| `1,600 bytes` | ~1,280 to 20,480 bytes |
| **MIME Type** | `audio/pcm;rate=16000` | `audio/pcm;rate=24000` |
| **Encoding** | Base64 strings over WebSocket | Base64 strings over WebSocket |

### Audio Pipeline Execution Steps
1. **Immediate Mic Start:** Tapping the Maya orb starts native capture in `<20ms` via `AudioStream.startRecording(16000, 50)`.
2. **Pre-Buffering:** While the WebSocket connects, early PCM chunks are buffered in memory (`pendingAudioQueue`) so speech is not lost.
3. **Hardware DSP Processing:** Android OS routes microphone audio through `AcousticEchoCanceler` and `NoiseSuppressor` on the `AudioRecord` session ID.
4. **WebSocket Transport:** Base64 audio frames stream via `ws.send(JSON.stringify({ type: 'audio', data: base64Chunk }))`.
5. **Node.js Forwarding:** Backend forwards audio to Gemini Live using `session.sendRealtimeInput({ audio: { data, mimeType } })`.
6. **Streaming Playback:** Incoming chunks from Gemini Live are dispatched to `AudioStream.playChunk(base64Chunk)` and written to `AudioTrack` configured with `MODE_STREAM`.
7. **Barge-In Interruption:** When the student speaks mid-sentence, Gemini Live emits an `interrupted: true` signal. The backend dispatches `{ type: 'interrupted' }` and the Android client instantly invokes `AudioTrack.pause()`, `AudioTrack.flush()`, and `AudioTrack.play()`, silencing speaker playback in `<10ms`.

---

## 7. Voice Personas & Voice Selection

All supported voices are prebuilt Google Gemini Live native voices configured in `frontend/src/constants/voices.ts` and `backend/src/config/geminiLive.js`.

| Voice Name | Gender | Natural Tone Description | Role in FellowGrad |
| :--- | :--- | :--- | :--- |
| **Aoede** *(Default)* | Female | Natural, conversational, warm, and engaging tone | Default voice for Maya |
| **Charon** | Male | Deep, calm, and reassuring tone for steady focus | Available in Voice Selector |
| **Puck** | Male | Upbeat, bright, and energetic tone | Available in Voice Selector |
| **Kore** | Female | Warm, articulate, and confident tone | Available in Voice Selector |

### Voice Configuration Flow
1. **Selection:** Chosen via `VoiceSelectorModal.tsx` on `HomeScreen.tsx` or in `SettingsScreen.tsx`.
2. **Storage:** Cached in `AsyncStorage` under `@fellowgrad_selected_voice` and synced to Firestore `preferences.voice`.
3. **Session Handshake:** Sent in the session request `POST /api/voice/live/session { voice: 'Aoede' }` and embedded into the session JWT.
4. **Gemini Configuration:** Passed to Gemini Live in `speechConfig.voiceConfig.prebuiltVoiceConfig.voiceName`.
5. **Live Mid-Call Switching:** Tapping a new voice mid-call triggers a seamless reconnect without terminating the session state.

---

## 8. Android Native Audio Modules

Located in `frontend/android/app/src/main/java/com/fellowgrad/`:

### 1. `AudioStreamModule.kt`
- **Native Registration:** Registered in React Native via `AudioStreamPackage.kt`.
- **Audio Capture (`AudioRecord`):**
  - Audio Source: `MediaRecorder.AudioSource.VOICE_COMMUNICATION`
  - Audio Format: `AudioFormat.ENCODING_PCM_16BIT`, `AudioFormat.CHANNEL_IN_MONO`
  - Buffer Size: Calculated via `AudioRecord.getMinBufferSize() * 2`
  - Dedicated background thread reads raw PCM bytes and emits `onAudioChunk` events via `RCTDeviceEventEmitter`.
- **Hardware Effects (DSP):**
  - `AcousticEchoCanceler.create(audioSessionId)`: Actively eliminates acoustic feedback from speaker to microphone.
  - `NoiseSuppressor.create(audioSessionId)`: Removes background stationary noise.
- **Audio Routing (`AudioManager`):**
  - Mode: `AudioManager.MODE_IN_COMMUNICATION`
  - Speakerphone: `isSpeakerphoneOn = true` (Forces output through loudspeaker rather than earpiece).
- **Audio Playback (`AudioTrack`):**
  - Audio Attributes: `USAGE_VOICE_COMMUNICATION`, `CONTENT_TYPE_SPEECH`
  - Stream Mode: `AudioTrack.MODE_STREAM`
  - Non-blocking chunk writes: `audioTrack.write(pcmBytes, 0, pcmBytes.size)`
  - Instant Flush: `flushPlayer()` clears hardware buffers upon barge-in.

### 2. `SpeechRecognizerModule.kt`
- Wraps Android native `SpeechRecognizer` (`android.speech.SpeechRecognizer`).
- Acts as a local speech-to-text fallback when offline.

---

## 9. WebSocket Architecture & Live Protocol

- **Endpoint:** `wss://fellowgrad-backend-hlihip5lvq-uc.a.run.app/ws/live?token=<JWT>`
- **Server File:** `backend/src/sockets/liveVoiceSocket.js`
- **Authentication:** Token verified during connection handshake via `jwt.verify(token, JWT_SECRET)`. Invalid or missing tokens close with code `4401`.

### WebSocket Message Protocol

#### Client -> Server (Upstream)
```json
// Audio Chunk (Streamed continuously every 50ms)
{
  "type": "audio",
  "data": "<base64-pcm-16k>"
}

// End of Audio Stream
{
  "type": "end_audio"
}

// Send Text Instruction or Query
{
  "type": "text",
  "text": "Explain DBMS normalization"
}
```

#### Server -> Client (Downstream)
```json
// Connection Status
{
  "type": "status",
  "status": "CONNECTING" | "LISTENING" | "PROCESSING" | "SPEAKING",
  "sessionId": "uuid"
}

// Audio Playback Chunk
{
  "type": "audio",
  "data": "<base64-pcm-24k>",
  "tServer": 1790084615683
}

// Speech Transcript (Streaming caption)
{
  "type": "transcript",
  "role": "USER" | "ASSISTANT",
  "content": "Good evening",
  "isComplete": true | false
}

// Barge-In Interruption Signal
{
  "type": "interrupted"
}

// Error Event
{
  "type": "error",
  "message": "Gemini Live encountered an issue. Reconnecting..."
}

// Session Closed
{
  "type": "closed",
  "reason": "Normal close"
}
```

---

## 10. Voice Activity Detection (VAD) & Turn-Taking Engine

Configured in `backend/src/config/geminiLive.js` under `realtimeInputConfig.automaticActivityDetection`:

```javascript
realtimeInputConfig: {
  automaticActivityDetection: {
    disabled: false,
    startOfSpeechSensitivity: 'START_SENSITIVITY_LOW',
    prefixPaddingMs: 300,
    silenceDurationMs: 400,
  }
}
```

### Parameters & Turn-Taking Dynamics
1. **`prefixPaddingMs = 300` (Speech Lookback Buffer):**
   - Keeps 9,600 bytes of audio before speech is officially detected.
   - Prevents the first syllable or soft consonant onset from being clipped (e.g., words like *"Three"*, *"Stop"*, *"Puck"*).
2. **`silenceDurationMs = 400` (Natural Pause Tolerance):**
   - Allows natural mid-sentence hesitations between 200ms and 350ms (e.g., *"Tomorrow I have an exam... [300ms pause] ...in computer networks"*) without cutting off the user prematurely.
   - Pauses exceeding 400ms automatically commit the turn and trigger the assistant's response.
3. **`startOfSpeechSensitivity = 'START_SENSITIVITY_LOW'`:**
   - Calibrated with Android hardware AEC to prevent speaker echo or low background hum from triggering false interruptions.

---

## 11. Education Domain & Knowledge Retrieval Layer

All education domain services reside in `backend/src/services/education/`:

```
backend/src/services/education/
├── coimbatoreData.js          # Verified database of 16 Coimbatore institutions
├── educationSourceService.js  # Source hierarchy & voice-safe citations
├── educationIntentService.js  # 26+ intent categories & Tanglish detection
├── collegeService.js          # College query, course filtering & factual comparison
├── courseService.js           # Verified course offering validation
├── admissionService.js        # 2026/2026-27 admission, fee & cutoff disclaimers
└── educationSearchService.js  # Unified retrieval coordinator & prompt grounder
```

### 1. Verified Coimbatore Knowledge Base (`coimbatoreData.js`)
Contains verified, structured data for 16 institutions:
- **Autonomous & Government Engineering:** PSG College of Technology, Coimbatore Institute of Technology (CIT), Government College of Technology (GCT), Kumaraguru College of Technology (KCT), Sri Krishna College of Engineering & Technology (SKCET), Sri Ramakrishna Engineering College (SREC).
- **Universities & Campuses:** Bharathiar University, Anna University Regional Campus Coimbatore, Tamil Nadu Agricultural University (TNAU), Amrita Vishwa Vidyapeetham, Avinashilingam Institute (Women), Karunya Institute of Technology and Sciences, Karpagam Academy of Higher Education.
- **Arts & Science:** PSG College of Arts & Science (PSG CAS), Sri Krishna Arts & Science College (SKASC), Government Arts College (GAC Coimbatore).

### 2. College Data Model Schema
```typescript
interface CollegeDocument {
  collegeName: string;
  shortName: string;
  aliases: string[];
  city: "Coimbatore";
  district: "Coimbatore";
  state: "Tamil Nadu";
  institutionType: string;
  officialWebsite: string;
  affiliation: string;
  accreditation: string[];
  ugCourses: string[];
  pgCourses: string[];
  phdPrograms: string[];
  admissionMode: string;
  eligibility: string[];
  applicationUrl: string;
  admissionOpen: boolean | null; // null if unverified, never guessed
  lastUpdated: string;
  lastVerifiedAt: string;
  sourceUrls: string[];
  notes?: string;
}
```

### 3. Education Intent Categories (`educationIntentService.js`)
Classifies queries into 26 distinct categories:
`COLLEGE_SEARCH`, `COURSE_SEARCH`, `ADMISSION`, `FEES`, `ELIGIBILITY`, `CUTOFF`, `COUNSELLING`, `SCHOLARSHIP`, `EXAM`, `RESULT`, `SYLLABUS`, `ACADEMIC_CALENDAR`, `PLACEMENT`, `INTERNSHIP`, `HACKATHON`, `COLLEGE_EVENT`, `COURSE_COMPARISON`, `COLLEGE_COMPARISON`, `CAREER`, `STUDY_PLAN`, `SUBJECT_HELP`, `PROGRAMMING_HELP`, `APTITUDE`, `INTERVIEW_PREPARATION`, `RESUME`, `ACADEMIC_PROFILE`, `HISTORICAL_RECALL`, `NON_EDUCATION`.

### 4. Non-Education Redirection Policy
If the user asks about weather, sports scores, stocks, celebrity gossip, general shopping, or entertainment:
```text
"I'm focused on education and student-related support. I can help with studies, colleges, courses, admissions, exams, scholarships, placements, and academic planning."
```
*(Exception: Education-connected political/news questions, like "Who is the education minister?", are answered neutrally with factual sources).*

### 5. Official Source Priority & Citation
- **Priority Order:** Official College Websites (Priority 1) > Government Portals (`.gov.in`, `.nic.in`) (Priority 2) > Regulatory Bodies (UGC, AICTE) (Priority 3) > Affiliating Universities (Anna Univ, Bharathiar Univ) (Priority 4) > State Admission Portals (TNEA, TNGASA) (Priority 5) > Third-Party (Priority 6).
- **Voice Citation Formatting:** Never speaks raw URLs. Uses natural conversational attributions: *"According to the official college website..."*.

---

## 12. Authentication & Account Security System

- **Controller:** `backend/src/controllers/authController.js`
- **Service:** `backend/src/services/authService.js`
- **Password Hashing:** `bcryptjs` with 10 salt rounds.
- **Tokens:**
  - **Access Token:** JWT HS256, expires in 24 hours (`86,400,000 ms`). Payload: `{ sub, userId, name, email }`.
  - **Refresh Token:** JWT HS256 (`JWT_REFRESH_SECRET`), expires in 30 days (`2,592,000 s`). Payload: `{ sub, userId, email, type: 'refresh' }`.
- **Live Session Token:** JWT HS256, expires in 4 hours. Payload: `{ sessionId, userId, conversationId, voice, incognito }`.
- **Rate Limiting (`rateLimitMiddleware.js`):**
  - Auth endpoints: 30 requests per 15 minutes per IP (`authRateLimiter`).
  - Password change/reset: 5 requests per 15 minutes per IP (`passwordRateLimiter`).
- **Account Operations:**
  - `POST /api/auth/register`: Creates user document and atomic `userEmails/{email}` index.
  - `POST /api/auth/login`: Authenticates password and returns token pair.
  - `POST /api/auth/refresh`: Exchanges valid refresh token for a new access token.
  - `GET /api/auth/me`: Validates Bearer token and returns safe user profile.
  - `POST /api/auth/change-password`: Verifies old password and hashes new password.
  - `DELETE /api/auth/account`: Atomically deletes user profile, email index, all conversations, messages, and memories.

---

## 13. Google Cloud Firestore Database Architecture

- **Initialization:** `backend/src/config/firestore.js` using Firebase Admin SDK with Application Default Credentials (ADC).
- **Project ID:** `fellowgrad-ai` (Environment variable `GOOGLE_CLOUD_PROJECT`).

### Collection Hierarchy

```
users/{userId}
  ├── profile data (fullName, email, passwordHash, createdAt, preferences, academicProfile)
  │
  ├── conversations/{conversationId}
  │     ├── metadata (id, userId, title, createdAt, updatedAt, lastMessage, messageCount, status)
  │     │
  │     └── messages/{messageId}
  │           ├── message data (id, conversationId, userId, role, content, type, createdAt)
  │
  └── memories/{memoryId}
        ├── memory data (id, category, content, importance, sourceConversationId, createdAt, updatedAt)

userEmails/{normalizedEmail}
  └── atomic index ({ userId, createdAt })
```

### Security & Isolation
- All student data is scoped strictly under `users/{userId}`.
- Cross-user queries are rejected at both controller and service layers with HTTP `403 Forbidden`.
- The `userEmails/{normalizedEmail}` collection guarantees unique email registration without table-scanning the users collection.

---

## 14. Long-Term Memory Architecture

- **Service:** `backend/src/services/memoryService.js`
- **Storage Path:** `users/{userId}/memories/{memoryId}`
- **Memory Categories:** `academic`, `career`, `project`, `preference`, `learning_style`, `goals`, `personal_context`, `communication_preference`.
- **Extraction Mechanism:**
  - After an assistant speech turn completes, `MemoryService.extractMemoriesFromTurn(userId, conversationId, assistantText)` runs asynchronously on `setImmediate()` without blocking real-time audio.
  - Calls `gemini-1.5-flash` with a strict JSON extraction schema to identify concrete academic milestones (e.g. *"Student is preparing for HCL placement interviews"*, *"Student struggles with DBMS normalization"*).
- **Duplicate Prevention:** Before creating a new memory, evaluates existing memories using keyword matching and updates existing records rather than creating redundant documents.
- **Context Injection:** When starting a live session, `getUserContext(userId)` compiles the top relevant memories into the Gemini system prompt:
  ```text
  --- STUDENT LONG-TERM MEMORIES & PREFERENCES ---
  • [academic] Student is studying Data Structures and Algorithms
  • [career] Student is preparing for campus placement interviews
  ```
- **Memory Toggle:** If a user sets `preferences.memoryEnabled = false`, memory extraction and context injection are bypassed.

---

## 15. Conversation History & Historical Search Engine

- **Service:** `backend/src/services/conversationSearchService.js`
- **Storage:** `users/{userId}/conversations/{conversationId}/messages/{messageId}`
- **Historical Query Detection:** Recognizes natural historical triggers:
  - English: *"What did I study yesterday?"*, *"What did I tell you 2 days ago?"*, *"What did we discuss about Java?"*
  - Tanglish: *"Yesterday naan enna padichen?"*, *"Last week Java pathi enna pesinom?"*
- **Date-Aware Search:** Parses relative time anchors:
  - `yesterday`: Resolves to previous calendar date.
  - `two days ago` / `2 days ago`: Resolves to 48 hours prior.
  - `last week`: Filters messages from the previous 7 days.
- **Query-Time Context Injection:** When a historical query is recognized during a voice call, relevant previous turns are retrieved from Firestore and injected directly into the active Gemini session via `liveSession.sendTextMessage('[SYSTEM MEMORY RECALL CONTEXT]...')`.

---

## 16. Incognito & Ephemeral Privacy Mode

Incognito mode provides a completely ephemeral voice session for private questions or testing without persistent side effects.

| Capability | Normal Mode | Incognito Mode |
| :--- | :--- | :--- |
| **Conversation Document Created** | Yes (`users/{userId}/conversations/{id}`) | **No** (`conversationId = null`) |
| **User Messages Saved to Firestore**| Yes | **No** (Storage bypassed) |
| **Assistant Messages Saved** | Yes | **No** (Storage bypassed) |
| **Long-Term Memory Extraction** | Yes (Background task) | **No** (Completely disabled) |
| **Personal Memories Injected** | Yes (Loaded from Firestore) | **No** (Zero personal memories loaded) |
| **System Instruction** | Full student profile + memory | Ephemeral instruction (`buildIncognitoSystemInstruction`)|
| **Gemini Live Voice Interaction** | Active | Active |
| **Voice Persona & AEC/NS** | Active | Active |

---

## 17. User Profile & Personalization Schema

Stored in Firestore at `users/{userId}`:

```json
{
  "id": "uuid-v4",
  "fullName": "Student Name",
  "email": "student@fellowgrad.edu",
  "profileImageUrl": null,
  "createdAt": "2026-09-22T00:00:00.000Z",
  "updatedAt": "2026-09-22T00:00:00.000Z",
  "lastLoginAt": "2026-09-22T00:00:00.000Z",
  "preferences": {
    "theme": "dark",
    "language": "en",
    "voice": "Aoede",
    "memoryEnabled": true,
    "notificationsEnabled": true
  },
  "academicProfile": {
    "college": "PSG College of Technology",
    "course": "B.E. Computer Science and Engineering",
    "year": "3rd Year",
    "interests": ["Machine Learning", "Cloud Computing"],
    "goals": ["Product Company Placement", "Higher Studies"]
  }
}
```

---

## 18. Complete API Endpoints Catalog

| Method | Endpoint | Auth | Purpose | Request Body / Query | Response | Source File |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `GET` | `/health` | None | Service liveness probe | None | `{ success, message }` | `app.js` |
| `POST`| `/api/auth/register` | Rate Limited | Register student account | `{ fullName, email, password }` | `{ token, refreshToken, user }` | `authController.js` |
| `POST`| `/api/auth/login` | Rate Limited | Authenticate student | `{ email, password }` | `{ token, refreshToken, user }` | `authController.js` |
| `POST`| `/api/auth/refresh` | None | Refresh access token | `{ refreshToken }` | `{ token, refreshToken, user }` | `authController.js` |
| `POST`| `/api/auth/logout` | None | Invalidate session | None | `{ success, message }` | `authController.js` |
| `GET` | `/api/auth/validate`| None | Check JWT token validity | `?token=<jwt>` | `{ valid: boolean }` | `authController.js` |
| `GET` | `/api/auth/me` | Bearer JWT | Retrieve authenticated user | None | `{ user }` | `authController.js` |
| `POST`| `/api/auth/change-password` | Bearer JWT | Change account password | `{ currentPassword, newPassword }` | `{ success, message }` | `authController.js` |
| `POST`| `/api/auth/forgot-password` | Rate Limited | Request reset link/token | `{ email }` | `{ success, message }` | `authController.js` |
| `POST`| `/api/auth/reset-password` | Rate Limited | Reset password via token | `{ token, newPassword }` | `{ success, message }` | `authController.js` |
| `DELETE`| `/api/auth/account` | Bearer JWT | Delete account & all data | `{ password }` (optional) | `{ success, message }` | `authController.js` |
| `GET` | `/api/users/profile`| Bearer JWT | Get student academic profile| None | `{ profile }` | `userController.js` |
| `PUT` | `/api/users/profile`| Bearer JWT | Update student academic profile | `{ college, course, year, ... }` | `{ profile }` | `userController.js` |
| `GET` | `/api/users/preferences`| Bearer JWT | Get preferences (voice, theme) | None | `{ preferences }` | `userController.js` |
| `PUT` | `/api/users/preferences`| Bearer JWT | Update preferences | `{ voice, memoryEnabled, ... }` | `{ preferences }` | `userController.js` |
| `GET` | `/api/conversations`| Bearer JWT | List student conversations | None | `[{ id, title, lastMessage }]` | `conversationController.js` |
| `POST`| `/api/conversations`| Bearer JWT | Create new conversation | `{ title }` | `{ conversation }` | `conversationController.js` |
| `DELETE`| `/api/conversations`| Bearer JWT | Clear all conversations | None | `{ success, count }` | `conversationController.js` |
| `GET` | `/api/conversations/:id/messages` | Bearer JWT | List messages in thread | None | `[{ role, content, createdAt }]` | `conversationController.js` |
| `GET` | `/api/memories` | Bearer JWT | List student long-term memories | `?category=<category>` | `{ memories: [...] }` | `memoryRoutes.js` |
| `POST`| `/api/memories` | Bearer JWT | Add custom memory entry | `{ category, content, importance }` | `{ memory }` | `memoryRoutes.js` |
| `DELETE`| `/api/memories` | Bearer JWT | Clear all memories | None | `{ success, deletedCount }` | `memoryRoutes.js` |
| `DELETE`| `/api/memories/:id` | Bearer JWT | Delete single memory | None | `{ success, memoryId }` | `memoryRoutes.js` |
| `POST`| `/api/voice/live/session` | Bearer JWT | Provision Gemini Live session | `{ voice, incognito }` | `{ sessionToken, conversationId }`| `liveVoiceController.js`|
| `GET` | `/api/voice/live/health` | None | Gemini Live proxy health | None | `{ liveReady: true }` | `liveVoiceController.js`|
| `WS`  | `/ws/live` | Query Token | Live bidirectional audio socket | `?token=<sessionToken>` | Streaming PCM Audio / Events | `liveVoiceSocket.js` |

---

## 19. Google Cloud & Production Infrastructure

- **Compute Platform:** Google Cloud Run (Fully managed serverless container platform)
- **Production Service Name:** `fellowgrad-backend`
- **Production URL:** `https://fellowgrad-backend-hlihip5lvq-uc.a.run.app`
- **Region:** `us-central1`
- **Service Account:** `fellowgrad-backend@fellowgrad-ai.iam.gserviceaccount.com`
- **Cloud Database:** Google Cloud Firestore (Native Mode)
- **AI Platform:** Google Cloud Vertex AI (Gemini Live API)
- **Container Port:** `5000` (or `PORT` specified by Cloud Run environment)
- **Scaling:** Automatically scales container instances based on concurrent WebSocket connections.

---

## 20. Environment Variables Specification

| Variable | Description | Required? | Default / Example | Classified as Secret? |
| :--- | :--- | :--- | :--- | :--- |
| `PORT` | HTTP/WS server listening port | No | `5000` | No |
| `NODE_ENV` | Environment mode (`development`, `production`, `test`) | No | `development` | No |
| `CORS_ORIGIN` | Comma-separated allowed HTTP origins | No | `http://localhost:3000,http://localhost:8081` | No |
| `JWT_SECRET` | Secret key for access token signing (HS256) | **Yes** | 64-character hex string | **YES (Secret)** |
| `JWT_REFRESH_SECRET` | Secret key for refresh token signing (HS256) | No | `${JWT_SECRET}_refresh` | **YES (Secret)** |
| `JWT_EXPIRATION` | Access token lifespan in milliseconds | No | `86400000` (24 hours) | No |
| `GOOGLE_CLOUD_PROJECT`| Google Cloud project identifier | **Yes** | `fellowgrad-ai` | No |
| `GOOGLE_CLOUD_LOCATION`| Google Cloud / Vertex AI region | No | `global` | No |
| `GOOGLE_GENAI_USE_ENTERPRISE` | Vertex AI enterprise auth flag | No | `true` | No |
| `GEMINI_LIVE_MODEL` | Native audio Live model name | No | `gemini-live-2.5-flash-native-audio` | No |
| `GEMINI_VOICE_NAME` | Default fallback voice for assistant | No | `Aoede` | No |
| `GEMINI_API_KEY` | Optional key for REST Gemini fallback | No | Empty in production ADC | **YES (Secret)** |
| `DATABASE_URL` | Optional PostgreSQL connection string | No | `postgres://localhost:5432/...` | **YES (Secret)** |
| `MONGODB_URI` | Optional MongoDB connection string | No | `mongodb://localhost:27017/...` | **YES (Secret)** |

---

## 21. Android Build & Standalone Release APK Pipeline

- **Android Gradle Plugin (AGP):** `8.2.0`
- **Gradle Version:** `8.13`
- **Compile SDK:** `36`
- **Target SDK:** `36`
- **Min SDK:** `24` (Android 7.0 Nougat+)
- **Build Tools Version:** `36.0.0`
- **NDK Version:** `27.1.12297006`
- **Kotlin Version:** `2.1.20`

### Standalone Release Build Commands
```bash
# 1. Clean previous build artifacts
cd frontend/android
./gradlew clean

# 2. Assemble production release APK with bundled JS assets
./gradlew assembleRelease

# Output APK Location:
# frontend/android/app/build/outputs/apk/release/app-release.apk (Size: ~76.9 MB)

# 3. Streamed installation onto connected device via ADB
adb -s <device_id> install -r app-release.apk
```

### Standalone Execution Properties
- **Zero Metro Dependency:** The release APK contains the precompiled JavaScript bundle in `assets/index.android.bundle`. It does not connect to port 8081 or require a development machine.
- **Direct Cloud Connectivity:** Connects directly over cellular or Wi-Fi to Google Cloud Run (`https://fellowgrad-backend-hlihip5lvq-uc.a.run.app`) and Cloud WebSockets (`wss://.../ws/live`).

---

## 22. Automated Verification & Test Benchmark Results

### Backend Automated Test Suites (`npm test`)

```text
=============================================================
🏁 Backend Test Execution Summary (Node.js Test Runner)
=============================================================
• api.test.js:                          18 Passed, 0 Failed
• firestore_personal_assistant.test.js:  68 Passed, 0 Failed
• auth_account_system.test.js:          35 Passed, 0 Failed
• test_maya_phone_call.js:              32 Passed, 0 Failed
• education_companion.test.js:          19 Passed, 0 Failed
-------------------------------------------------------------
TOTAL AUTOMATED TESTS:                 172 Passed, 0 Failed (100% Pass Rate)
=============================================================
```

### Phone-Call Latency Benchmark (`test_maya_phone_call.js`)
- **Utterances Evaluated:** 20-Turn Realistic Telephone Dialogue
- **Average Turnaround Latency:** `737 ms`
- **P90 Turnaround Latency:** `799 ms`
- **Clipped Speech Count:** `0 (0%)`
- **False Interruption Count:** `0 (0%)`
- **Barge-In Success Rate:** `100% (2/2 interruptions tested)`

### Frontend Static Analysis
```bash
cd frontend
npx tsc --noEmit
# Result: 0 errors (Exit Code: 0)
```

---

## 23. Complete Repository Directory Map

```
D:\FellowGrad-AI/
├── FELLOWGRAD_TECH_STACK_AND_ARCHITECTURE.md   # This comprehensive specification document
├── .gitignore
│
├── backend/                                    # Google Cloud Run Express Backend
│   ├── .env.example                            # Template for environment configuration
│   ├── package.json                            # Backend dependencies & npm scripts
│   ├── package-lock.json                       # Exact dependency lockfile
│   ├── src/
│   │   ├── app.js                              # Express app, CORS, error handling
│   │   ├── server.js                           # HTTP & WebSocket server bootstrap
│   │   ├── config/
│   │   │   ├── database.js                     # PostgreSQL & MongoDB connection handlers
│   │   │   ├── firestore.js                    # Cloud Firestore & Firebase Admin ADC setup
│   │   │   ├── gemini.js                       # Gemini REST fallback configuration
│   │   │   └── geminiLive.js                   # Gemini Live 2.5 native audio configuration
│   │   ├── controllers/
│   │   │   ├── authController.js               # Register, login, refresh, profile, account deletion
│   │   │   ├── conversationController.js       # Conversation threads and message endpoints
│   │   │   ├── liveVoiceController.js          # Live voice session provisioning & tokens
│   │   │   ├── userController.js               # Academic profile & preferences
│   │   │   ├── aiController.js                 # REST chat controller
│   │   │   ├── voiceController.js              # REST audio STT/TTS controller
│   │   │   └── notificationController.js       # Real-time alert emitter
│   │   ├── middleware/
│   │   │   ├── authMiddleware.js               # JWT Bearer token authentication
│   │   │   ├── rateLimitMiddleware.js          # In-memory sliding-window brute force limiter
│   │   │   ├── validationMiddleware.js         # Request parameter validation
│   │   │   └── errorMiddleware.js              # Global JSON error response handler
│   │   ├── models/
│   │   │   ├── User.js                         # Firestore user model with email indexing
│   │   │   ├── UserProfile.js                  # User profile schema definition
│   │   │   ├── Conversation.js                 # Conversation document model
│   │   │   └── Message.js                      # Message document model
│   │   ├── routes/
│   │   │   ├── authRoutes.js                   # /api/auth/* endpoints
│   │   │   ├── userRoutes.js                   # /api/users/* endpoints
│   │   │   ├── conversationRoutes.js           # /api/conversations/* endpoints
│   │   │   ├── memoryRoutes.js                 # /api/memories/* endpoints
│   │   │   ├── liveVoiceRoutes.js              # /api/voice/live/* endpoints
│   │   │   ├── aiRoutes.js                     # /api/ai/* endpoints
│   │   │   ├── voiceRoutes.js                  # /api/voice/* endpoints
│   │   │   ├── notificationRoutes.js           # /api/notifications/* endpoints
│   │   │   └── index.js                        # Central API router aggregator
│   │   ├── services/
│   │   │   ├── authService.js                  # Password hashing, JWT token generation
│   │   │   ├── conversationService.js          # Thread management in Firestore
│   │   │   ├── conversationSearchService.js    # Date & topic historical query search
│   │   │   ├── geminiLiveService.js            # Vertex AI Live bidirectional audio session
│   │   │   ├── geminiService.js                # REST Gemini AI with Google Search
│   │   │   ├── memoryService.js                # Long-term memory extraction & injection
│   │   │   ├── userService.js                  # Profile persistence
│   │   │   ├── voiceService.js                 # REST audio helpers
│   │   │   ├── notificationService.js          # WebSocket event emitter
│   │   │   └── education/                      # Dedicated Education Domain Engine
│   │   │       ├── coimbatoreData.js           # 16 verified Coimbatore colleges
│   │   │       ├── educationSourceService.js   # Official source hierarchy & citations
│   │   │       ├── educationIntentService.js   # 26+ intent classes, Tanglish detection
│   │   │       ├── collegeService.js           # Search, course filtering, comparison
│   │   │       ├── courseService.js            # Course offering verification
│   │   │       ├── admissionService.js         # 2026 admission, fees & cutoffs
│   │   │       └── educationSearchService.js   # Grounded retrieval coordinator
│   │   └── sockets/
│   │       ├── liveVoiceSocket.js              # Dedicated /ws/live WebSocket server
│   │       └── socketHandler.js                # Socket.io notification server
│   └── test/
│       ├── api.test.js                         # Core REST API endpoint tests
│       ├── auth_account_system.test.js         # Authentication & security test suite
│       ├── firestore_personal_assistant.test.js# Firestore isolation & memory tests
│       ├── test_maya_phone_call.js             # 20-turn phone call benchmark
│       └── education_companion.test.js         # Section 32 Education scenarios test suite
│
└── frontend/                                   # Android React Native Client
    ├── App.tsx                                 # Root component with AuthProvider & GestureHandler
    ├── package.json                            # React Native dependencies & scripts
    ├── tsconfig.json                           # TypeScript configuration
    ├── android/                                # Native Android Gradle project
    │   ├── build.gradle                        # Root Gradle configuration
    │   ├── gradle.properties                   # JVM & Android memory settings
    │   ├── app/
    │   │   ├── build.gradle                    # Application build config & SDK targets
    │   │   └── src/main/
    │   │       ├── AndroidManifest.xml         # Permissions & activity declarations
    │   │       └── java/com/fellowgrad/
    │   │           ├── AudioStreamModule.kt    # Native 16kHz capture & 24kHz playback
    │   │           ├── AudioStreamPackage.kt   # React Native package export
    │   │           ├── SpeechRecognizerModule.kt# Offline speech fallback
    │   │           ├── SpeechRecognizerPackage.kt
    │   │           ├── MainActivity.kt         # Android main activity entrypoint
    │   │           └── MainApplication.kt      # Application initialization
    └── src/
        ├── components/
        │   ├── VoiceOrb/                       # Animated conversational voice orb
        │   └── VoiceSelectorModal/             # Voice persona selection modal
        ├── config/
        │   └── apiConfig.ts                    # Production Cloud Run & WSS endpoints
        ├── constants/
        │   └── voices.ts                       # Supported voice personas (Aoede, Puck, etc.)
        ├── context/
        │   └── AuthContext.tsx                 # Authentication state & session recovery
        ├── hooks/
        │   └── useVoiceAssistant.ts            # State machine hook for voice call UI
        ├── navigation/
        │   └── AppNavigator.tsx                # Conditional Auth & Main navigation stacks
        ├── screens/
        │   ├── Account/AccountScreen.tsx       # Profile edit & account deletion
        │   ├── Auth/Welcome/WelcomeScreen.tsx  # Unauthenticated landing screen
        │   ├── Auth/Login/LoginScreen.tsx      # Sign in screen
        │   ├── Auth/Register/RegisterScreen.tsx# Account creation screen
        │   ├── Home/HomeScreen.tsx             # Voice call UI, Maya orb, voice selector
        │   └── Settings/SettingsScreen.tsx     # App preferences, theme, voice options
        └── services/
            ├── audioInputService.ts            # Microphone permission & native capture
            ├── audioOutputService.ts           # Streaming 24kHz playback & barge-in flush
            ├── geminiLiveService.ts            # Frontend WebSocket coordinator & latency tracking
            └── api/
                ├── apiClient.ts                # Configured Axios instance with Bearer interceptor
                ├── authApi.ts                  # Auth endpoint calls
                ├── userApi.ts                  # Profile & preferences API
                ├── conversationApi.ts          # Conversations API
                ├── voiceApi.ts                 # Live session provisioning API
                └── aiApi.ts                    # Text chat fallback API
```

---

## 24. Security & Isolation Architecture

1. **Strict User-Data Partitioning:**
   Every conversation, message, and long-term memory is nested under `users/{userId}` in Firestore. Any API call requesting access to another student's data is rejected with `403 Forbidden`.
2. **Ephemeral Incognito Mode:**
   Strictly enforced on the server. When the `incognito: true` flag is detected on `/ws/live`, conversation saving, message persisting, memory extraction, and context loading are completely disabled at runtime.
3. **Cryptographic Defense:**
   - Passwords hashed with `bcryptjs` (salt factor 10). Plain-text passwords never touch Firestore.
   - User entity representations (`toSafeJSON()`) strip password hashes before transmitting over the network.
   - JWT signatures use 64-character cryptographic secrets.
4. **Brute-Force & Flooding Protection:**
   In-memory sliding-window rate limiters reject rapid registration attempts (`30 req / 15 min`) and password cracking attacks (`5 req / 15 min`).
5. **Acoustic & Hardware Isolation:**
   By configuring `AudioRecord` with `VOICE_COMMUNICATION` and `AudioTrack` with `USAGE_VOICE_COMMUNICATION`, Android's internal hardware DSP echo canceller actively isolates the microphone stream from the speaker output, preventing Maya from hearing or interrupting herself.
