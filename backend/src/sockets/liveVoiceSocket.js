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
      conversationId = decoded.conversationId;
      sessionId = decoded.sessionId;

      console.log(`[VoiceSession] Live client connected: user=${userId}, session=${sessionId}, conversation=${conversationId || 'new'}`);

      // 2. Load personalized companion memory & system instruction
      const systemInstruction = await MemoryService.buildLiveSystemInstruction(userId, conversationId);

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
        onAudioChunk: (base64Audio) => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({
              type: 'audio',
              data: base64Audio,
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

          // Asynchronously persist completed assistant message without blocking real-time audio
          if (isComplete && content && conversationId) {
            ConversationService.saveMessage(conversationId, {
              role: 'ASSISTANT',
              content,
              messageType: 'VOICE',
            }).catch((err) => {
              console.warn(`[Conversation] Could not persist assistant message: ${err.message}`);
            });
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
                // Asynchronously persist user message
                if (conversationId) {
                  ConversationService.saveMessage(conversationId, {
                    role: 'USER',
                    content: parsed.text,
                    messageType: 'VOICE',
                  }).catch(() => {});
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
