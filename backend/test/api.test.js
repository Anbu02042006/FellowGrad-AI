const http = require('http');
const { app } = require('../src/app');

// Helper to make test requests
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
          rawBuffer: buffer,
        });
      });
    });

    req.on('error', reject);

    if (body) {
      if (Buffer.isBuffer(body)) {
        req.write(body);
      } else if (typeof body === 'object') {
        req.write(JSON.stringify(body));
      } else {
        req.write(body);
      }
    }
    req.end();
  });
};

const runTests = async () => {
  console.log('🧪 Starting FellowGrad Backend API Test Suite...\n');

  // Start test server on random available port
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
    // 1. Health Check
    console.log('--- Step 1: Health Check ---');
    const health = await request(server, 'GET', '/health');
    assert('GET /health returns 200', health.status === 200);
    assert('GET /health success is true', health.data.success === true);

    // 2. Auth - Register
    console.log('\n--- Step 2: Authentication ---');
    const email = `test_${Date.now()}@fellowgrad.edu`;
    const regRes = await request(server, 'POST', '/api/auth/register', {
      name: 'Test Student',
      email,
      password: 'SecurePassword123!',
    });
    assert('POST /api/auth/register returns 200', regRes.status === 200, JSON.stringify(regRes.data));
    assert('Registration returns valid JWT token', typeof regRes.data?.token === 'string');
    assert('Registration returns userId', !!regRes.data?.userId);
    const token = regRes.data?.token;
    const userId = regRes.data?.userId;

    // 3. Auth - Login
    const loginRes = await request(server, 'POST', '/api/auth/login', {
      email,
      password: 'SecurePassword123!',
    });
    assert('POST /api/auth/login returns 200', loginRes.status === 200);
    assert('Login returns JWT token', typeof loginRes.data?.token === 'string');

    // 4. Auth - Validate Token
    const valRes = await request(server, 'GET', `/api/auth/validate?token=${token}`);
    assert('GET /api/auth/validate returns 200', valRes.status === 200);
    assert('Token validation returns true', valRes.data === true);

    // 5. User Profile
    console.log('\n--- Step 3: User Profile ---');
    const updateProfileRes = await request(server, 'PUT', `/api/users/${userId}/profile`, {
      name: 'Test Student',
      educationLevel: 'Undergraduate',
      college: 'MIT',
      course: 'Computer Science',
      interests: 'AI, Machine Learning',
      careerGoals: 'AI Research Scientist',
      skills: 'Python, Node.js',
    });
    assert('PUT /api/users/:userId/profile returns 200', updateProfileRes.status === 200);
    assert('Profile college updated', updateProfileRes.data?.college === 'MIT');

    const getProfileRes = await request(server, 'GET', `/api/users/${userId}/profile`);
    assert('GET /api/users/:userId/profile returns 200', getProfileRes.status === 200);
    assert('Profile retrieved correctly', getProfileRes.data?.careerGoals === 'AI Research Scientist');

    // 6. Conversations
    console.log('\n--- Step 4: Conversations & Messages ---');
    const convRes = await request(server, 'POST', '/api/conversations', {
      userId,
      title: 'Academic Career Planning',
    });
    assert('POST /api/conversations returns 200', convRes.status === 200);
    assert('Conversation created with ID', !!convRes.data?.id);
    const conversationId = convRes.data?.id;

    const listConvRes = await request(server, 'GET', `/api/conversations/user/${userId}`);
    assert('GET /api/conversations/user/:userId returns 200', listConvRes.status === 200);
    assert('Conversations list contains created conversation', Array.isArray(listConvRes.data) && listConvRes.data.length >= 1);

    // Messages
    const sendMsgRes = await request(server, 'POST', `/api/conversations/${conversationId}/messages`, {
      role: 'USER',
      content: 'Can you help me plan my semester courses?',
      messageType: 'TEXT',
    });
    assert('POST /api/conversations/:id/messages returns 200', sendMsgRes.status === 200);
    assert('Message content matches', sendMsgRes.data?.content === 'Can you help me plan my semester courses?');

    const getMsgsRes = await request(server, 'GET', `/api/conversations/${conversationId}/messages`);
    assert('GET /api/conversations/:id/messages returns 200', getMsgsRes.status === 200);
    assert('Messages list has at least 1 message', Array.isArray(getMsgsRes.data) && getMsgsRes.data.length >= 1);

    const getRecentRes = await request(server, 'GET', `/api/conversations/${conversationId}/recent?limit=5`);
    assert('GET /api/conversations/:id/recent returns 200', getRecentRes.status === 200);
    assert('Recent messages returns array', Array.isArray(getRecentRes.data));

    // 7. AI Service
    console.log('\n--- Step 5: AI & Gemini Companion ---');
    const chatRes = await request(server, 'POST', '/api/ai/chat', {
      userId,
      conversationId,
      message: 'Hello, how can I prepare for coding interviews?',
    });
    assert('POST /api/ai/chat returns 200', chatRes.status === 200);
    assert('AI returns reply text', typeof chatRes.data?.reply === 'string' && chatRes.data.reply.length > 0);

    // 8. Voice Service
    console.log('\n--- Step 6: Voice Services (TTS / STT / Process) ---');
    const ttsRes = await request(server, 'POST', '/api/voice/text-to-speech', {
      text: 'Hello from FellowGrad AI',
    });
    assert('POST /api/voice/text-to-speech returns 200', ttsRes.status === 200);
    assert('TTS returns audio/mpeg', ttsRes.headers['content-type']?.includes('audio/mpeg'));
    assert('TTS returned binary audio buffer', ttsRes.rawBuffer.length > 0);

    const sttRes = await request(
      server,
      'POST',
      '/api/voice/speech-to-text',
      Buffer.from([0x00, 0x01, 0x02, 0x03]),
      { 'Content-Type': 'application/octet-stream' }
    );
    assert('POST /api/voice/speech-to-text returns 200', sttRes.status === 200);
    assert('STT returns transcribed text', typeof sttRes.data?.text === 'string');

    const voiceProcessRes = await request(
      server,
      'POST',
      `/api/voice/process?userId=${userId}&conversationId=${conversationId}`,
      Buffer.from([0x00, 0x01, 0x02, 0x03]),
      { 'Content-Type': 'application/octet-stream' }
    );
    assert('POST /api/voice/process returns 200', voiceProcessRes.status === 200);
    assert('Voice process returns audio/mpeg', voiceProcessRes.headers['content-type']?.includes('audio/mpeg'));

    // 9. Notification Service
    console.log('\n--- Step 7: Notifications ---');
    const notifRes = await request(server, 'POST', '/api/notifications', {
      userId,
      message: 'Your upcoming study session starts in 15 minutes!',
    });
    assert('POST /api/notifications returns 202 Accepted', notifRes.status === 202);

    // 10. Error Handling
    console.log('\n--- Step 8: Error Handling (400, 404) ---');
    const notFoundRes = await request(server, 'GET', '/api/non-existent-endpoint');
    assert('Unknown endpoint returns 404', notFoundRes.status === 404);

    const badLoginRes = await request(server, 'POST', '/api/auth/login', {
      email: 'nonexistent@fellowgrad.edu',
      password: 'WrongPassword',
    });
    assert('Bad credentials return 400', badLoginRes.status === 400);

    console.log(`\n=============================================`);
    console.log(`📊 Test Results: ${passed} Passed, ${failed} Failed`);
    console.log(`=============================================\n`);

    server.close();
    process.exit(failed > 0 ? 1 : 0);
  } catch (err) {
    console.error('❌ Test execution error:', err);
    server.close();
    process.exit(1);
  }
};

runTests();
