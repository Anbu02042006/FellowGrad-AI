const http = require('http');
const jwt = require('jsonwebtoken');
const { app } = require('../src/app');
const ConversationService = require('../src/services/conversationService');
const MemoryService = require('../src/services/memoryService');
const ConversationSearchService = require('../src/services/conversationSearchService');
const { getFirestore } = require('../src/config/firestore');
const geminiLiveConfig = require('../src/config/geminiLive');

const JWT_SECRET = process.env.JWT_SECRET || '404E635266556A586E3272357538782F413F4428472B4B6250645367566B5970';

const request = (server, method, path, body = null, headers = {}) => {
  return new Promise((resolve, reject) => {
    const port = server.address().port;
    const reqOptions = {
      hostname: '127.0.0.1',
      port,
      path,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
    };

    const req = http.request(reqOptions, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        const buffer = Buffer.concat(chunks);
        const contentType = res.headers['content-type'] || '';
        let data = buffer;
        if (contentType.includes('application/json')) {
          try {
            data = JSON.parse(buffer.toString('utf-8'));
          } catch (e) {
            data = buffer.toString('utf-8');
          }
        }
        resolve({
          status: res.statusCode,
          headers: res.headers,
          data,
        });
      });
    });

    req.on('error', reject);

    if (body) {
      if (typeof body === 'object') {
        req.write(JSON.stringify(body));
      } else {
        req.write(body);
      }
    }
    req.end();
  });
};

const runAssistantTests = async () => {
  console.log('\n=============================================================');
  console.log('🧪 FellowGrad AI 1-to-1 Personal Assistant Test Suite (Firestore)');
  console.log('=============================================================\n');

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  console.log(`[Test Server] Listening on port ${port}\n`);

  let passed = 0;
  let failed = 0;

  const assert = (name, condition, details = '') => {
    if (condition) {
      console.log(`  ✅ [PASS] ${name}`);
      passed++;
    } else {
      console.error(`  ❌ [FAIL] ${name} ${details}`);
      failed++;
    }
  };

  try {
    // -------------------------------------------------------------
    // Setup: Create two test users to verify data isolation
    // -------------------------------------------------------------
    console.log('--- Step 1: Create Test Users (User A and User B) ---');
    const userARes = await request(server, 'POST', '/api/auth/register', {
      name: 'Student Alice',
      email: `alice_${Date.now()}@fellowgrad.edu`,
      password: 'AlicePassword123!',
    });
    const tokenA = userARes.data?.token;
    const userAId = userARes.data?.userId;
    assert('Register User A (Alice)', userARes.status === 200 && !!tokenA);

    const userBRes = await request(server, 'POST', '/api/auth/register', {
      name: 'Student Bob',
      email: `bob_${Date.now()}@fellowgrad.edu`,
      password: 'BobPassword123!',
    });
    const tokenB = userBRes.data?.token;
    const userBId = userBRes.data?.userId;
    assert('Register User B (Bob)', userBRes.status === 200 && !!tokenB);

    // -------------------------------------------------------------
    // Phase 4 & 5: Conversation Creation & Firestore Scoping
    // -------------------------------------------------------------
    console.log('\n--- Step 2: Conversation Creation in Firestore ---');
    const convARes = await request(
      server,
      'POST',
      '/api/conversations',
      { title: 'New Conversation' },
      { Authorization: `Bearer ${tokenA}` }
    );
    assert('POST /api/conversations returns 200 for User A', convARes.status === 200);
    assert('Conversation has ID and userId', !!convARes.data?.id && convARes.data?.userId === userAId);
    const convAId = convARes.data?.id;

    // -------------------------------------------------------------
    // Phase 6 & 7: Message Storage & Auto-Title
    // -------------------------------------------------------------
    console.log('\n--- Step 3: Message Persistence & Auto-Title ---');
    const userMsg = await ConversationService.saveUserMessage(
      userAId,
      convAId,
      'I am preparing for HCL placement interview next week',
      'voice'
    );
    assert('User message persisted to Firestore', !!userMsg?.id && userMsg.role === 'USER');
    assert('Message type is voice', userMsg.type === 'voice');

    const asstMsg = await ConversationService.saveAssistantMessage(
      userAId,
      convAId,
      'That is great Alice! Let us practice aptitude and technical questions step by step.',
      'voice'
    );
    assert('Assistant message persisted to Firestore', !!asstMsg?.id && asstMsg.role === 'ASSISTANT');

    // Retrieve messages and verify chronological order
    const msgsRes = await request(
      server,
      'GET',
      `/api/conversations/${convAId}/messages`,
      null,
      { Authorization: `Bearer ${tokenA}` }
    );
    assert('GET /api/conversations/:id/messages returns 200', msgsRes.status === 200);
    assert('2 messages returned in conversation', Array.isArray(msgsRes.data) && msgsRes.data.length === 2);
    assert('First message is from USER', msgsRes.data[0]?.role === 'USER');
    assert('Second message is from ASSISTANT', msgsRes.data[1]?.role === 'ASSISTANT');

    // Check auto-title generation
    const updatedConv = await ConversationService.getConversation(userAId, convAId);
    assert('Conversation title auto-updated from initial turn', updatedConv.title !== 'New Conversation');

    // -------------------------------------------------------------
    // Phase 8 & 9: Long-Term Memory Storage & Deduplication
    // -------------------------------------------------------------
    console.log('\n--- Step 4: Long-Term Memory Storage & Deduplication ---');
    const mem1 = await MemoryService.saveMemory(userAId, {
      category: 'academic',
      content: 'Preparing for HCL placement interview',
      importance: 0.9,
      sourceConversationId: convAId,
    });
    assert('Save long-term memory 1 (academic)', !!mem1?.id && mem1.category === 'academic');

    const mem2 = await MemoryService.saveMemory(userAId, {
      category: 'preference',
      content: 'Prefers concise step-by-step coding explanations',
      importance: 0.8,
      sourceConversationId: convAId,
    });
    assert('Save long-term memory 2 (preference)', !!mem2?.id && mem2.category === 'preference');

    // Test Deduplication: saving identical/overlapping fact in same category
    const memDuplicate = await MemoryService.saveMemory(userAId, {
      category: 'academic',
      content: 'Preparing for HCL placement interview next week',
      importance: 0.95,
      sourceConversationId: convAId,
    });
    assert('Deduplication updates existing memory without creating duplicate', memDuplicate.id === mem1.id);
    assert('Updated memory has updated importance', memDuplicate.importance === 0.95);

    const allAliceMemories = await MemoryService.getMemories(userAId);
    assert('User A has exactly 2 distinct memories (no duplicates)', allAliceMemories.length === 2);

    // -------------------------------------------------------------
    // Phase 10 & 11: Memory Context Building & Live System Instruction
    // -------------------------------------------------------------
    console.log('\n--- Step 5: Memory Context Building for Gemini Live ---');
    const userContext = await MemoryService.getUserContext(userAId, convAId);
    assert('User context includes memories array', userContext.memories.length >= 2);
    assert('User context includes recent conversation messages', userContext.recentConversation.length >= 2);
    assert('Compact context contains memory bullets', userContext.compactContext.includes('HCL placement'));
    assert('Compact context contains recent dialogue snippet', userContext.compactContext.includes('practice aptitude'));

    const liveInstruction = await MemoryService.buildLiveSystemInstruction(userAId, convAId);
    assert('Live system instruction contains base prompt persona', liveInstruction.includes('FellowGrad'));
    assert('Live system instruction personalizes with student memory', liveInstruction.includes('HCL placement'));

    // -------------------------------------------------------------
    // Phase 12: Strict 1-to-1 Private User Data Isolation
    // -------------------------------------------------------------
    console.log('\n--- Step 6: 1-to-1 Private Data Isolation Checks ---');
    // User B attempts to access User A's conversation
    const breachConvRes = await request(
      server,
      'GET',
      `/api/conversations/${convAId}`,
      null,
      { Authorization: `Bearer ${tokenB}` }
    );
    assert('User B cannot access User A conversation (404/Forbidden)', breachConvRes.status === 404 || breachConvRes.status === 403);

    // User B attempts to access User A's messages
    const breachMsgRes = await request(
      server,
      'GET',
      `/api/conversations/${convAId}/messages`,
      null,
      { Authorization: `Bearer ${tokenB}` }
    );
    assert('User B cannot read User A messages (empty or not found)', breachMsgRes.status === 404 || (Array.isArray(breachMsgRes.data) && breachMsgRes.data.length === 0));

    // User B attempts to request User A's conversation list via /api/conversations/user/:userId
    const breachListRes = await request(
      server,
      'GET',
      `/api/conversations/user/${userAId}`,
      null,
      { Authorization: `Bearer ${tokenB}` }
    );
    assert('User B cannot list User A conversations (403 Forbidden)', breachListRes.status === 403);

    // User B memories are isolated from User A
    const bobMemories = await MemoryService.getMemories(userBId);
    assert('User B starts with 0 memories (isolated from Alice)', bobMemories.length === 0);

    // -------------------------------------------------------------
    // Phase 13: Live Voice Session Provisioning & Voice Whitelist
    // -------------------------------------------------------------
    console.log('\n--- Step 7: Live Voice Session Provisioning ---');
    const sessionRes = await request(
      server,
      'POST',
      '/api/voice/live/session',
      { voice: 'Charon', conversationId: convAId },
      { Authorization: `Bearer ${tokenA}` }
    );
    assert('POST /api/voice/live/session returns 200', sessionRes.status === 200);
    assert('Session response contains sessionToken', typeof sessionRes.data?.sessionToken === 'string');
    assert('Session response contains conversationId', sessionRes.data?.conversationId === convAId);
    assert('Requested voice Charon is set in session', sessionRes.data?.voice === 'Charon');

    // Verify token contains decoded parameters
    const decodedLiveToken = jwt.verify(sessionRes.data.sessionToken, JWT_SECRET);
    assert('Live session token decodes verified userId', decodedLiveToken.userId === userAId);
    assert('Live session token contains conversationId', decodedLiveToken.conversationId === convAId);
    assert('Live session token contains voice Charon', decodedLiveToken.voice === 'Charon');

    // Test Voice Whitelist fallback
    const invalidVoiceRes = await request(
      server,
      'POST',
      '/api/voice/live/session',
      { voice: 'NonExistentVoice' },
      { Authorization: `Bearer ${tokenA}` }
    );
    assert('Invalid voice falls back to default voice Aoede', invalidVoiceRes.data?.voice === geminiLiveConfig.DEFAULT_VOICE);

    // -------------------------------------------------------------
    // Phase 14: Memory API Endpoints
    // -------------------------------------------------------------
    console.log('\n--- Step 8: Memory REST Endpoints ---');
    const getMemoriesRes = await request(
      server,
      'GET',
      '/api/memories',
      null,
      { Authorization: `Bearer ${tokenA}` }
    );
    assert('GET /api/memories returns 200', getMemoriesRes.status === 200);
    assert('Returns user memories list', Array.isArray(getMemoriesRes.data?.memories) && getMemoriesRes.data.memories.length >= 2);

    // Delete a memory
    const delMemRes = await request(
      server,
      'DELETE',
      `/api/memories/${mem2.id}`,
      null,
      { Authorization: `Bearer ${tokenA}` }
    );
    assert('DELETE /api/memories/:id returns 200', delMemRes.status === 200 && delMemRes.data?.success === true);

    const afterDelMemories = await MemoryService.getMemories(userAId);
    assert('Memory count reduced to 1 after deletion', afterDelMemories.length === 1);

    // -------------------------------------------------------------
    // Phase 15: Conversation Deletion
    // -------------------------------------------------------------
    console.log('\n--- Step 9: Conversation Deletion ---');
    const delConvRes = await request(
      server,
      'DELETE',
      `/api/conversations/${convAId}`,
      null,
      { Authorization: `Bearer ${tokenA}` }
    );
    assert('DELETE /api/conversations/:id returns 200', delConvRes.status === 200);

    const convsAfterDelete = await ConversationService.getConversationsByUser(userAId);
    assert('Deleted conversation is no longer listed', !convsAfterDelete.some((c) => c.id === convAId));

    // -------------------------------------------------------------
    // Step 10: Historical Conversation Retrieval & Date-Aware Memory
    // -------------------------------------------------------------
    console.log('\n--- Step 10: Date-Aware & Topic-Based Historical Memory Retrieval ---');

    // Create a historical conversation from 2 days ago for User A
    const twoDaysAgoTime = new Date(Date.now() - 2 * 86400000);
    const pastConv1 = await ConversationService.createConversation({
      userId: userAId,
      title: 'HCL Preparation Session',
    });
    // Set timestamp to 2 days ago
    const db = getFirestore();
    await db.doc(`users/${userAId}/conversations/${pastConv1.id}`).set({
      createdAt: twoDaysAgoTime.toISOString(),
      updatedAt: twoDaysAgoTime.toISOString(),
    }, { merge: true });

    await ConversationService.saveUserMessage(
      userAId,
      pastConv1.id,
      "I am preparing for my HCL interview and I'm struggling with seating arrangement questions.",
      'voice'
    );
    await ConversationService.saveAssistantMessage(
      userAId,
      pastConv1.id,
      "Let's practice seating arrangement step by step.",
      'voice'
    );
    // Backdate the messages
    const pastMsgs1 = await ConversationService.getMessages(userAId, pastConv1.id);
    for (const m of pastMsgs1) {
      await db.doc(`users/${userAId}/conversations/${pastConv1.id}/messages/${m.id}`).set({
        timestamp: twoDaysAgoTime.toISOString(),
      }, { merge: true });
    }

    // Create another historical conversation from earlier discussing Spring Boot
    const earlierTime = new Date(Date.now() - 4 * 86400000);
    const pastConv2 = await ConversationService.createConversation({
      userId: userAId,
      title: 'Spring Boot Discussion',
    });
    await db.doc(`users/${userAId}/conversations/${pastConv2.id}`).set({
      createdAt: earlierTime.toISOString(),
      updatedAt: earlierTime.toISOString(),
    }, { merge: true });

    await ConversationService.saveUserMessage(
      userAId,
      pastConv2.id,
      "I'm having trouble with Spring Boot authentication tokens.",
      'voice'
    );
    await ConversationService.saveAssistantMessage(
      userAId,
      pastConv2.id,
      "We can configure JWT filter in SecurityFilterChain.",
      'voice'
    );

    // Create a third historical conversation discussing FellowGrad AI project
    const pastConv3 = await ConversationService.createConversation({
      userId: userAId,
      title: 'Project Discussion',
    });
    await ConversationService.saveUserMessage(
      userAId,
      pastConv3.id,
      "I am building a project called FellowGrad AI personal assistant.",
      'voice'
    );

    // Test 1: Historical query detection
    const detection1 = ConversationSearchService.detectHistoricalQuery("Maya, two days ago I told you something about my HCL preparation. What was it?");
    assert('Detect historical query 1 (isHistorical: true)', detection1.isHistorical === true);
    assert('Extract relative date: "two days ago"', detection1.dateReference === 'two days ago');
    assert('Extract topic keywords including hcl', detection1.topicKeywords.includes('hcl'));

    const detectionNonHistorical = ConversationSearchService.detectHistoricalQuery("Hello Maya, what is the time right now?");
    assert('Normal non-historical query returns isHistorical: false', detectionNonHistorical.isHistorical === false);

    // Test 2: Date parsing for "two days ago", "yesterday", "last week"
    const parsedTwoDays = ConversationSearchService.parseDateReference('two days ago');
    assert('parseDateReference returns valid range for "two days ago"', !!parsedTwoDays?.startDate && !!parsedTwoDays?.endDate);
    assert('two days ago start is before end', parsedTwoDays.startDate.getTime() < parsedTwoDays.endDate.getTime());

    const parsedYesterday = ConversationSearchService.parseDateReference('yesterday');
    assert('parseDateReference works for "yesterday"', parsedYesterday?.label === 'yesterday');

    const parsedLastWeek = ConversationSearchService.parseDateReference('last week');
    assert('parseDateReference works for "last week"', parsedLastWeek?.label === 'last week');

    // Test 3: Scenario 1 - "What did I tell you two days ago about my HCL preparation?"
    const context1 = await ConversationSearchService.getRelevantConversationContext(
      userAId,
      "Maya, two days ago I told you something about my HCL preparation. What was it?"
    );
    assert('Scenario 1: Context recalled for "two days ago"', typeof context1 === 'string');
    assert('Scenario 1: Context contains seating arrangement fact', context1.includes('seating arrangement'));
    assert('Scenario 1: Context contains HCL interview mention', context1.includes('HCL'));

    // Test 4: Scenario 2 - "What was the project I told you about earlier?"
    const context2 = await ConversationSearchService.getRelevantConversationContext(
      userAId,
      "What was the project I told you about earlier?"
    );
    assert('Scenario 2: Context recalled for project inquiry', typeof context2 === 'string');
    assert('Scenario 2: Context contains "FellowGrad AI"', context2.includes('FellowGrad AI'));

    // Test 5: Scenario 3 - "Do you remember the Spring Boot problem I mentioned?"
    const context3 = await ConversationSearchService.getRelevantConversationContext(
      userAId,
      "Do you remember the Spring Boot problem I mentioned?"
    );
    assert('Scenario 3: Context recalled for Spring Boot problem', typeof context3 === 'string');
    assert('Scenario 3: Context contains Spring Boot authentication', context3.includes('Spring Boot authentication'));

    // Test 6: Scenario 4 - Unmatched past inquiry ("What did I tell you about my trip three weeks ago?")
    const context4 = await ConversationSearchService.getRelevantConversationContext(
      userAId,
      "What did I tell you about my trip three weeks ago?"
    );
    assert('Scenario 4: Handles missing conversation gracefully', typeof context4 === 'string');
    assert('Scenario 4: Instructs assistant NOT to fabricate', context4.includes('Do NOT fabricate') || context4.includes('No matching'));

    // Test 7: Privacy Isolation in Historical Search - User B cannot find User A's past conversations
    const breachSearch = await ConversationSearchService.searchHistoricalConversations(
      userBId,
      "What did I tell you two days ago about HCL?"
    );
    assert('User B cannot retrieve User A historical conversation (returns empty)', breachSearch.length === 0);

    const breachContext = await ConversationSearchService.getRelevantConversationContext(
      userBId,
      "Do you remember the Spring Boot problem I mentioned?"
    );
    // --- Step 11: Incognito Mode Tests ---
    console.log('\n--- Step 11: Server-Enforced Incognito Mode Tests ---');
    const incognitoRes = await request(
      server,
      'POST',
      '/api/voice/live/session',
      { voice: 'Puck', incognito: true },
      { Authorization: `Bearer ${tokenA}` }
    );

    assert('POST /api/voice/live/session with incognito=true returns 200', incognitoRes.status === 200);
    assert('Incognito session response has incognito=true', incognitoRes.data.incognito === true);
    assert('Incognito session response has conversationId=null', incognitoRes.data.conversationId === null);
    assert('Incognito session profileLoaded is false', incognitoRes.data.profileLoaded === false);

    const decodedIncognito = jwt.verify(incognitoRes.data.sessionToken, JWT_SECRET);
    assert('Incognito JWT contains incognito=true flag', decodedIncognito.incognito === true);
    assert('Incognito JWT contains conversationId=null', decodedIncognito.conversationId === null);
    assert('Incognito JWT contains userId', decodedIncognito.userId === userAId);

    const incognitoPrompt = MemoryService.buildIncognitoSystemInstruction();
    assert('Incognito system instruction contains ephemeral notice', incognitoPrompt.includes('INCOGNITO SESSION ACTIVE'));
    assert('Incognito system instruction contains personal assistant persona', incognitoPrompt.includes('personal assistant') && incognitoPrompt.includes('Nila'));

    console.log('\n=============================================================');
    console.log(`📊 Assistant Test Suite Results: ${passed} Passed, ${failed} Failed`);
    console.log('=============================================================\n');

    server.close();
    process.exit(failed > 0 ? 1 : 0);
  } catch (err) {
    console.error('❌ Assistant test execution error:', err);
    server.close();
    process.exit(1);
  }
};

runAssistantTests();
