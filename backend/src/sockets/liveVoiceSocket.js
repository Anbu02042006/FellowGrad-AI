/**
 * Dedicated WebSocket Server for Gemini Live Real-Time Audio Streaming
 * Path: /ws/live
 *
 * Keeps real-time audio transport completely separate from application Socket.IO.
 */

const { WebSocketServer, WebSocket } = require('ws');
const jwt = require('jsonwebtoken');
const { URL } = require('url');
const { GeminiLiveService } = require('../services/geminiLiveService');
const MemoryService = require('../services/memoryService');
const ConversationService = require('../services/conversationService');
const ConversationSearchService = require('../services/conversationSearchService');
const EducationSearchService = require('../services/education/educationSearchService');
const geminiLiveConfig = require('../config/geminiLive');

const JWT_SECRET = process.env.JWT_SECRET || '404E635266556A586E3272357538782F413F4428472B4B6250645367566B5970';

/**
 * Attach the Gemini Live WebSocket server to the existing HTTP server
 * @param {import('http').Server} httpServer
 */
const setupLiveVoiceSocket = (httpServer) => {
  const wss = new WebSocketServer({
    server: httpServer,
    path: '/ws/live',
    maxPayload: 10 * 1024 * 1024, // 10MB
  });

  console.log('[GeminiLive] WebSocket proxy listening on path /ws/live');

  wss.on('connection', async (ws, req) => {
    let liveSession = null;
    let userId = null;
    let conversationId = null;
    let sessionId = null;

    try {
      // 1. Authenticate connection via query parameter ?token=<liveSessionToken>
      const parsedUrl = new URL(req.url, 'http://localhost');
      const token = parsedUrl.searchParams.get('token');

      if (!token) {
        console.warn('[LiveToken] Connection rejected: No session token provided');
        ws.send(JSON.stringify({ type: 'error', message: 'Authentication failed: Missing token' }));
        ws.close(4401, 'Unauthorized');
        return;
      }

      let decoded;
      try {
        decoded = jwt.verify(token, JWT_SECRET);
      } catch (tokenErr) {
        console.warn(`[LiveToken] Invalid session token: ${tokenErr.message}`);
        ws.send(JSON.stringify({ type: 'error', message: 'Authentication failed: Invalid or expired token' }));
        ws.close(4401, 'Unauthorized');
        return;
      }

      userId = decoded.userId;
      sessionId = decoded.sessionId;
      const isIncognito = Boolean(decoded.incognito);
      conversationId = isIncognito ? null : decoded.conversationId;

      const voice = (decoded.voice && geminiLiveConfig.ALLOWED_VOICES.includes(decoded.voice))
        ? decoded.voice
        : geminiLiveConfig.DEFAULT_VOICE;

      if (!isIncognito && !conversationId && userId) {
        try {
          const autoConv = await ConversationService.createConversation({ userId, title: 'Voice Session' });
          conversationId = autoConv.id;
        } catch (convErr) {
          console.warn(`[VoiceSession] Note creating initial conversation: ${convErr.message}`);
        }
      }

      console.log(`[VoiceSession] Live client connected: user=${userId}, session=${sessionId}, voice=${voice}, conversation=${conversationId || (isIncognito ? 'INCOGNITO' : 'new')}, incognito=${isIncognito}`);

      // 2. Load personalized companion memory & system instruction (or base instruction if incognito)
      const systemInstruction = isIncognito
        ? MemoryService.buildIncognitoSystemInstruction
          ? MemoryService.buildIncognitoSystemInstruction(voice)
          : (typeof geminiLiveConfig.getSystemPromptForVoice === 'function'
              ? geminiLiveConfig.getSystemPromptForVoice(voice)
              : geminiLiveConfig.systemPrompt)
        : await MemoryService.buildLiveSystemInstruction(userId, conversationId, voice);

      // Notify mobile client that session setup is starting
      ws.send(JSON.stringify({
        type: 'status',
        status: 'CONNECTING',
        sessionId,
      }));

      // 3. Establish Live session with Google Gemini via Vertex AI
      liveSession = await GeminiLiveService.createSession({
        userId,
        conversationId,
        systemInstruction,
        voice,
        onAudioChunk: (base64Audio) => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({
              type: 'audio',
              data: base64Audio,
              tServer: Date.now(),
            }));
          }
        },
        onInterrupted: () => {
          console.log(`[VoiceSession] Forwarding interruption signal to client for session ${sessionId}`);
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({
              type: 'interrupted',
            }));
          }
        },
        onTranscript: ({ role, content, isComplete }) => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({
              type: 'transcript',
              role,
              content,
              isComplete,
            }));
          }

          // Asynchronously persist completed user and assistant messages without blocking real-time audio
          if (isComplete && content) {
            if (role === 'USER') {
              // 1. Live Education Intent & Grounding Layer
              EducationSearchService.retrieveContext(content)
                .then((eduResult) => {
                  if (eduResult && eduResult.groundedContext && liveSession && liveSession.isConnected) {
                    console.log(`[VoiceSession] Injecting grounded education context (${eduResult.intent}) into live session`);
                    liveSession.sendTextMessage(eduResult.groundedContext);
                  }
                })
                .catch((eduErr) => {
                  console.warn(`[VoiceSession] Education retrieval note: ${eduErr.message}`);
                });

              // 2. Persist user message & historical recall (Strictly bypassed in Incognito mode)
              if (!isIncognito && conversationId && userId) {
                ConversationService.saveUserMessage(userId, conversationId, content, 'voice').catch((err) => {
                  console.warn(`[Conversation] Could not persist user message: ${err.message}`);
                });

                // Query-time historical conversation recall
                const detection = ConversationSearchService.detectHistoricalQuery(content);
                if (detection.isHistorical) {
                  ConversationSearchService.getRelevantConversationContext(userId, content)
                    .then((historicalContext) => {
                      if (historicalContext && liveSession && liveSession.isConnected) {
                        console.log(`[VoiceSession] Injecting recalled historical conversation context into live session for ${userId}`);
                        liveSession.sendTextMessage(`[SYSTEM MEMORY RECALL CONTEXT]\n${historicalContext}`);
                      }
                    })
                    .catch((searchErr) => {
                      console.warn(`[VoiceSession] Note during historical recall: ${searchErr.message}`);
                    });
                }
              }
            } else if (role === 'ASSISTANT') {
              if (!isIncognito && conversationId && userId) {
                ConversationService.saveAssistantMessage(userId, conversationId, content, 'voice').catch((err) => {
                  console.warn(`[Conversation] Could not persist assistant message: ${err.message}`);
                });

                // Asynchronously extract candidate long-term memories in background
                MemoryService.extractMemoriesFromTurn(userId, conversationId, content).catch((err) => {
                  console.warn(`[MemoryService] Background extraction note: ${err.message}`);
                });
              }
            }
          }
        },
        onTurnComplete: () => {
          console.log(`[VoiceSession] Assistant turn complete for session ${sessionId}, switching client to LISTENING`);
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({
              type: 'status',
              status: 'LISTENING',
            }));
          }
        },
        onError: (err) => {
          console.error(`[VoiceSession] Live error for session ${sessionId}:`, err?.message || err);
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({
              type: 'error',
              message: 'Gemini Live encountered an issue. Reconnecting...',
            }));
          }
        },
        onClose: (event) => {
          console.log(`[VoiceSession] Gemini session closed for ${sessionId}`);
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({
              type: 'closed',
              reason: event?.reason || 'Session ended',
            }));
          }
        },
      });

      // Notify mobile client that Live session is active and listening
      ws.send(JSON.stringify({
        type: 'status',
        status: 'LISTENING',
        sessionId,
      }));

      // 4. Handle incoming messages from mobile client
      ws.on('message', async (rawMessage, isBinary) => {
        try {
          // Check if message is binary audio buffer or JSON command
          if (isBinary) {
            // Raw binary PCM chunk from mobile client (16kHz 16-bit mono)
            console.log(`[LiveVoiceSocket] BINARY AUDIO -> bytes: ${rawMessage.length}`);
            const base64Audio = rawMessage.toString('base64');
            liveSession?.sendAudioChunk(base64Audio);
            return;
          }

          const parsed = JSON.parse(rawMessage.toString());

          switch (parsed.type) {
            case 'audio':
              // Base64-encoded PCM audio chunk
              if (parsed.data && liveSession) {
                console.log(`[LiveVoiceSocket] TEXT AUDIO -> base64 length: ${parsed.data.length}`);
                liveSession.sendAudioChunk(parsed.data);
              }
              break;

            case 'text':
              // Text fallback or supplemental user message
              if (parsed.text && liveSession) {
                liveSession.sendTextMessage(parsed.text);
                // Asynchronously persist user message (only if not incognito)
                if (!isIncognito && conversationId && userId) {
                  ConversationService.saveUserMessage(userId, conversationId, parsed.text, 'text')
                    .catch(() => {});
                }
              }
              break;

            case 'interrupt':
              console.log(`[VoiceSession] Client initiated explicit interruption`);
              break;

            case 'ping':
              ws.send(JSON.stringify({ type: 'pong' }));
              break;

            default:
              console.warn(`[VoiceSession] Unknown message type: ${parsed.type}`);
          }
        } catch (msgErr) {
          console.error('[VoiceSession] Error processing client message:', msgErr.message);
        }
      });

      // 5. Handle client disconnect and clean up
      ws.on('close', async (code, reason) => {
        console.log(`[VoiceSession] Client disconnected: session=${sessionId} (code=${code}, reason=${reason?.toString() || 'none'})`);
        if (liveSession) {
          await liveSession.close();
          liveSession = null;
        }
      });

      ws.on('error', async (err) => {
        console.error(`[VoiceSession] WebSocket error for session ${sessionId}:`, err.message);
        if (liveSession) {
          await liveSession.close();
          liveSession = null;
        }
      });
    } catch (err) {
      console.error('[VoiceSession] Fatal error during WebSocket connection:', err);
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'error', message: 'Internal server error establishing voice session' }));
        ws.close(1011, 'Internal Error');
      }
      if (liveSession) {
        await liveSession.close();
      }
    }
  });

  return wss;
};

module.exports = {
  setupLiveVoiceSocket,
};
