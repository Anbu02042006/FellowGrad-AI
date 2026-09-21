# FellowGrad AI — Backend (Node.js + Express)

Production-ready, high-performance Node.js and Express.js backend for **FellowGrad AI — Voice-Driven Personal Academic & Emotional Companion**.

This service replaces the Java Spring Boot microservice stack (Eureka, Gateway, Auth, User, Conversation, AI, Voice, Notification) with a unified, lightweight, modular architecture while maintaining 100% backward-compatible API contracts.

---

## 🏗️ Architecture

```
fellowgrad-backend/
├── src/
│   ├── config/
│   │   ├── database.js          # PostgreSQL & MongoDB connection pools + auto-migrations
│   │   ├── gemini.js            # Gemini AI model & system mentor persona
│   │   └── firebase.js          # Firebase Admin SDK (optional)
│   ├── controllers/
│   │   ├── authController.js    # Register, login, token validation
│   │   ├── userController.js    # User profiles
│   │   ├── conversationController.js # Conversations & messages
│   │   ├── aiController.js      # Gemini Chat & ElevenLabs TTS
│   │   ├── voiceController.js   # Voice STT/TTS & real-time pipeline
│   │   └── notificationController.js # Real-time user notifications
│   ├── routes/
│   │   ├── authRoutes.js        # /api/auth/*
│   │   ├── userRoutes.js        # /api/users/*
│   │   ├── conversationRoutes.js # /api/conversations/*
│   │   ├── aiRoutes.js          # /api/ai/*
│   │   ├── voiceRoutes.js       # /api/voice/*
│   │   ├── notificationRoutes.js# /api/notifications/*
│   │   └── index.js             # Central router
│   ├── services/
│   │   ├── authService.js       # BCrypt password hashing & JWT handling
│   │   ├── userService.js       # User profile persistence
│   │   ├── conversationService.js# Threaded conversations & history
│   │   ├── geminiService.js     # Google Gemini AI with Google Search grounding
│   │   ├── voiceService.js      # ElevenLabs TTS & Google Cloud STT
│   │   └── notificationService.js# Real-time WebSocket emitter
│   ├── models/
│   │   ├── User.js              # PostgreSQL _user model
│   │   ├── UserProfile.js       # PostgreSQL user_profiles model
│   │   ├── Conversation.js      # MongoDB conversations schema
│   │   └── Message.js           # MongoDB messages schema
│   ├── middleware/
│   │   ├── authMiddleware.js    # JWT Bearer token verification
│   │   ├── errorMiddleware.js   # Centralized JSON error formatting
│   │   └── validationMiddleware.js# Field validations
│   ├── sockets/
│   │   └── socketHandler.js     # Socket.IO & WebSocket real-time audio / events
│   ├── app.js                   # Express application configuration & CORS
│   └── server.js                # Server initialization & DB startup
├── test/
│   └── api.test.js              # Complete automated API test suite
├── .env.example
├── .env
├── package.json
└── README.md
```

---

## 🚀 Quick Start

### 1. Install Dependencies
```bash
cd fellowgrad-backend
npm install
```

### 2. Environment Configuration
Copy `.env.example` to `.env` and fill in any custom credentials:
```bash
cp .env.example .env
```

### 3. Run Development Server
```bash
npm run dev
```

The server starts on `http://localhost:5000` (or the port specified in `.env`).

### 4. Run Automated API Tests
```bash
npm test
```

---

## 📡 API Endpoints

### Health Check
- `GET /health` — Check server status

### Authentication (`/api/auth`)
- `POST /api/auth/register` — Register new student `{ name, email, password }`
- `POST /api/auth/login` — Authenticate student `{ email, password }`
- `GET /api/auth/validate?token=...` — Validate JWT token

### User Profiles (`/api/users`)
- `GET /api/users/:userId/profile` — Fetch student profile
- `PUT /api/users/:userId/profile` — Update student profile
- `GET /api/users/:userId` — Fetch profile
- `PUT /api/users/:userId` — Update profile

### Conversations (`/api/conversations`)
- `POST /api/conversations` — Create conversation `{ userId, title }`
- `GET /api/conversations/user/:userId` — List conversations for user
- `GET /api/conversations/:id` — Get single conversation
- `POST /api/conversations/:id/messages` — Send message `{ role, content, messageType }`
- `GET /api/conversations/:id/messages` — Get message history
- `GET /api/conversations/:id/recent?limit=10` — Get recent messages

### AI & Companion (`/api/ai`)
- `POST /api/ai/chat` — Chat with FellowGrad AI `{ userId, conversationId, message }`
- `POST /api/ai/tts` — Generate speech audio `{ text }` (returns `audio/mpeg`)

### Voice (`/api/voice`)
- `POST /api/voice/speech-to-text` — Convert speech audio to text
- `POST /api/voice/text-to-speech` — Convert text to speech audio
- `POST /api/voice/process?userId=...&conversationId=...` — Full end-to-end voice loop

### Notifications (`/api/notifications`)
- `POST /api/notifications` — Send notification `{ userId, message }` (returns 202 Accepted)

---

## ⚡ WebSocket Support
Connect to the server via Socket.IO:
```javascript
import io from 'socket.io-client';

const socket = io('http://localhost:5000', {
  auth: { token: 'YOUR_JWT_TOKEN' }
});

// Join personal notification channel
socket.emit('join_user_room', userId);

// Listen for notifications
socket.on('notification', (data) => {
  console.log('Notification received:', data);
});
```
