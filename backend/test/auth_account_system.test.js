const http = require('http');
const jwt = require('jsonwebtoken');
const { app } = require('../src/app');
const User = require('../src/models/User');
const MemoryService = require('../src/services/memoryService');
const ConversationService = require('../src/services/conversationService');

// Test HTTP request helper
const request = (server, method, path, body = null, headers = {}) => {
  return new Promise((resolve, reject) => {
    const port = server.address().port;
    const reqHeaders = {
      'Content-Type': 'application/json',
      ...headers,
    };

    let payload = null;
    if (body) {
      payload = typeof body === 'object' ? JSON.stringify(body) : String(body);
      reqHeaders['Content-Length'] = Buffer.byteLength(payload);
    }

    const reqOptions = {
      hostname: '127.0.0.1',
      port,
      path,
      method,
      headers: reqHeaders,
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

    if (payload) {
      req.write(payload);
    }
    req.end();
  });
};

const runAuthAccountTests = async () => {
  console.log('\n=============================================================');
  console.log('🧪 FellowGrad AI Auth, Account & Privacy Test Suite');
  console.log('=============================================================\n');

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  console.log(`[Test Server] Running on http://127.0.0.1:${port}\n`);

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

  const ts = Date.now();
  const userAEmail = `anbu_${ts}@fellowgrad.edu`;
  const userBEmail = `bob_${ts}@fellowgrad.edu`;
  const validPassword = 'SecurePassword123!';

  let userAToken = null;
  let userARefreshToken = null;
  let userAId = null;

  let userBToken = null;
  let userBId = null;

  try {
    // ==========================================
    // 1. REGISTER TESTS
    // ==========================================
    console.log('--- Phase 1: Registration Validation & Security ---');

    // 1. Valid registration
    const regResA = await request(server, 'POST', '/api/auth/register', {
      fullName: 'Anbu Selvan',
      email: userAEmail,
      password: validPassword,
      confirmPassword: validPassword,
    });
    assert('1. Valid registration returns 200 and tokens', regResA.status === 200);
    assert('1b. Registration returns safe user profile without password/hash', !regResA.data?.user?.password && !regResA.data?.user?.passwordHash);
    assert('1c. Default preferences initialized', regResA.data?.user?.preferences?.theme === 'dark' && regResA.data?.user?.preferences?.memoryEnabled === true);
    userAToken = regResA.data?.token;
    userARefreshToken = regResA.data?.refreshToken;
    userAId = regResA.data?.userId || regResA.data?.user?.id;

    // 2. Duplicate email rejected
    const dupRes = await request(server, 'POST', '/api/auth/register', {
      fullName: 'Duplicate Anbu',
      email: userAEmail,
      password: validPassword,
      confirmPassword: validPassword,
    });
    assert('2. Duplicate registration rejected', dupRes.status === 400 || dupRes.status === 409);

    // 3. Invalid email rejected
    const badEmailRes = await request(server, 'POST', '/api/auth/register', {
      fullName: 'Bad Email',
      email: 'not-a-valid-email',
      password: validPassword,
      confirmPassword: validPassword,
    });
    assert('3. Invalid email format rejected', badEmailRes.status === 400);

    // 4. Weak password rejected
    const weakPassRes = await request(server, 'POST', '/api/auth/register', {
      fullName: 'Weak Password',
      email: `weak_${ts}@fellowgrad.edu`,
      password: 'weak',
      confirmPassword: 'weak',
    });
    assert('4. Weak password (<8 chars / missing upper/number) rejected', weakPassRes.status === 400);

    // 5. Password mismatch rejected
    const mismatchRes = await request(server, 'POST', '/api/auth/register', {
      fullName: 'Mismatch User',
      email: `mismatch_${ts}@fellowgrad.edu`,
      password: validPassword,
      confirmPassword: 'DifferentPassword123!',
    });
    assert('5. Password confirmation mismatch rejected', mismatchRes.status === 400);

    // 6. Missing fields rejected
    const missingRes = await request(server, 'POST', '/api/auth/register', {
      email: `missing_${ts}@fellowgrad.edu`,
    });
    assert('6. Missing required fields rejected', missingRes.status === 400);

    // Register User B for data isolation tests
    const regResB = await request(server, 'POST', '/api/auth/register', {
      fullName: 'Bob Roberts',
      email: userBEmail,
      password: validPassword,
      confirmPassword: validPassword,
    });
    userBToken = regResB.data?.token;
    userBId = regResB.data?.userId || regResB.data?.user?.id;

    // ==========================================
    // 2. LOGIN & TOKEN TESTS
    // ==========================================
    console.log('\n--- Phase 2: Login, Session & Token Validation ---');

    // 7. Valid login
    const loginRes = await request(server, 'POST', '/api/auth/login', {
      email: userAEmail.toUpperCase(), // Test case insensitivity / normalization
      password: validPassword,
    });
    assert('7. Valid login returns 200 with tokens', loginRes.status === 200 && !!loginRes.data?.token && !!loginRes.data?.refreshToken);
    assert('7b. Login does not return password hash', !loginRes.data?.user?.passwordHash);

    // 8. Invalid password rejected with generic error
    const badPassRes = await request(server, 'POST', '/api/auth/login', {
      email: userAEmail,
      password: 'WrongPassword123!',
    });
    assert('8. Invalid password rejected with generic error', badPassRes.status === 400 && badPassRes.data?.message === 'Invalid email or password');

    // 9. Non-existent email rejected with generic error
    const nonExistentRes = await request(server, 'POST', '/api/auth/login', {
      email: `doesnotexist_${ts}@fellowgrad.edu`,
      password: validPassword,
    });
    assert('9. Non-existent email rejected with generic error (no enumeration)', nonExistentRes.status === 400 && nonExistentRes.data?.message === 'Invalid email or password');

    // 10. Malformed token rejected
    const malformedRes = await request(server, 'GET', '/api/auth/me', null, {
      Authorization: 'Bearer invalid.jwt.token',
    });
    assert('10. Malformed JWT rejected with 401', malformedRes.status === 401);

    // 11. Refresh token mechanism
    const refreshRes = await request(server, 'POST', '/api/auth/refresh', {
      refreshToken: userARefreshToken,
    });
    assert('11. Refresh token exchange succeeds', refreshRes.status === 200 && !!refreshRes.data?.token);

    // ==========================================
    // 3. AUTH / ME TESTS
    // ==========================================
    console.log('\n--- Phase 3: Identity & /me Endpoints ---');

    // 12. /me authenticated
    const meRes = await request(server, 'GET', '/api/auth/me', null, {
      Authorization: `Bearer ${userAToken}`,
    });
    assert('12. GET /api/auth/me returns current user profile', meRes.status === 200 && meRes.data?.user?.email === userAEmail);

    // 13. /me unauthenticated
    const unauthMe = await request(server, 'GET', '/api/auth/me');
    assert('13. GET /api/auth/me without token returns 401', unauthMe.status === 401);

    // ==========================================
    // 4. USER DATA ISOLATION TESTS
    // ==========================================
    console.log('\n--- Phase 4: Strict User Data Isolation ---');

    // 14. User A cannot access User B profile
    const crossProfileRes = await request(server, 'GET', `/api/users/${userBId}/profile`, null, {
      Authorization: `Bearer ${userAToken}`,
    });
    assert('14. User A accessing User B profile is rejected (403)', crossProfileRes.status === 403);

    // Create a conversation for User B
    const bConv = await ConversationService.createConversation({ userId: userBId, title: 'Secret Research' });

    // 15. User A cannot access User B conversations
    const crossConvRes = await request(server, 'GET', `/api/conversations/user/${userBId}`, null, {
      Authorization: `Bearer ${userAToken}`,
    });
    assert('15. User A cannot list User B conversations (403)', crossConvRes.status === 403);

    // Save a memory for User B
    await MemoryService.saveMemory(userBId, { category: 'academic', content: 'User B confidential project' });

    // 16. User A cannot see User B memories
    const userAMemoriesRes = await request(server, 'GET', '/api/memories', null, {
      Authorization: `Bearer ${userAToken}`,
    });
    const containsBMem = (userAMemoriesRes.data?.memories || []).some((m) => m.content.includes('User B confidential'));
    assert('16. User A memories list strictly excludes User B memories', userAMemoriesRes.status === 200 && !containsBMem);

    // ==========================================
    // 5. ACCOUNT & PROFILE SETTINGS
    // ==========================================
    console.log('\n--- Phase 5: Account, Profile & Password Settings ---');

    // Update profile & academic profile
    const updateProfileRes = await request(server, 'PUT', '/api/users/profile', {
      academicProfile: {
        college: 'Anna University',
        course: 'Computer Science',
        year: 'Final Year',
        goals: ['Placement preparation', 'Machine Learning research'],
      },
    }, {
      Authorization: `Bearer ${userAToken}`,
    });
    assert('17a. Update user academic profile succeeds', updateProfileRes.status === 200 && updateProfileRes.data?.academicProfile?.college === 'Anna University');

    // Update preferences (voice, language, theme)
    const updatePrefRes = await request(server, 'PUT', '/api/users/preferences', {
      voice: 'Charon',
      language: 'Tamil',
      theme: 'dark',
    }, {
      Authorization: `Bearer ${userAToken}`,
    });
    assert('17b. Update user preferences succeeds', updatePrefRes.status === 200 && updatePrefRes.data?.preferences?.voice === 'Charon');

    // 17. Change password
    const newPassword = 'NewSecurePassword456!';
    const changePassRes = await request(server, 'POST', '/api/auth/change-password', {
      currentPassword: validPassword,
      newPassword,
      confirmNewPassword: newPassword,
    }, {
      Authorization: `Bearer ${userAToken}`,
    });
    assert('17c. Change password succeeds', changePassRes.status === 200 && changePassRes.data?.success === true);

    // Verify new password can log in
    const loginWithNewPass = await request(server, 'POST', '/api/auth/login', {
      email: userAEmail,
      password: newPassword,
    });
    assert('17d. Login with new password succeeds', loginWithNewPass.status === 200);

    // 18. Logout
    const logoutRes = await request(server, 'POST', '/api/auth/logout', null, {
      Authorization: `Bearer ${userAToken}`,
    });
    assert('18. POST /api/auth/logout returns 200', logoutRes.status === 200 && logoutRes.data?.success === true);

    // ==========================================
    // 6. PRIVACY & MEMORY CONTROLS
    // ==========================================
    console.log('\n--- Phase 6: Privacy, Incognito & Memory Controls ---');

    // 20. Disable memory preference
    await request(server, 'PUT', '/api/users/preferences', {
      memoryEnabled: false,
    }, {
      Authorization: `Bearer ${userAToken}`,
    });

    // Attempt to save memory while disabled
    const saveDisabledMem = await MemoryService.saveMemory(userAId, {
      category: 'academic',
      content: 'Should not be saved because memory is disabled',
    });
    assert('20. Memory persistence blocked when memoryEnabled is false', saveDisabledMem === null);

    // Re-enable memory for subsequent tests
    await request(server, 'PUT', '/api/users/preferences', {
      memoryEnabled: true,
    }, {
      Authorization: `Bearer ${userAToken}`,
    });

    // Save a test memory and test conversation
    await MemoryService.saveMemory(userAId, { category: 'preference', content: 'Prefers audio explanations' });
    const userAConv = await ConversationService.createConversation({ userId: userAId, title: 'Temporary Conv' });

    // Test clear all conversations
    const clearConvRes = await request(server, 'DELETE', '/api/conversations', null, {
      Authorization: `Bearer ${userAToken}`,
    });
    assert('20b. Clear all conversations succeeds', clearConvRes.status === 200 && clearConvRes.data?.success === true);

    // Test clear all memories
    const clearMemRes = await request(server, 'DELETE', '/api/memories', null, {
      Authorization: `Bearer ${userAToken}`,
    });
    assert('20c. Clear all memories succeeds', clearMemRes.status === 200 && clearMemRes.data?.success === true);

    // 21 & 22. Incognito session and conversation not persisted
    const incognitoSessionRes = await request(server, 'POST', '/api/voice/live/session', {
      incognito: true,
    }, {
      Authorization: `Bearer ${userAToken}`,
    });
    assert('21. Incognito voice session returns conversationId null', incognitoSessionRes.status === 200 && incognitoSessionRes.data?.conversationId === null);
    assert('22. Incognito session flag set in session token', incognitoSessionRes.data?.incognito === true);

    // ==========================================
    // 7. VOICE & AUTH INTEGRATION
    // ==========================================
    console.log('\n--- Phase 7: Authenticated Voice Session Provisioning ---');

    // 23. Authenticated voice session
    const voiceSessionRes = await request(server, 'POST', '/api/voice/live/session', {}, {
      Authorization: `Bearer ${userAToken}`,
    });
    assert('23. Authenticated voice session returns valid token', voiceSessionRes.status === 200 && typeof voiceSessionRes.data?.sessionToken === 'string');

    // 24. Unauthenticated voice session rejected
    const unauthVoice = await request(server, 'POST', '/api/voice/live/session');
    assert('24. Unauthenticated voice session rejected with 401', unauthVoice.status === 401);

    // 25. Incognito voice session works normally
    assert('25. Incognito voice session has active sessionToken', typeof incognitoSessionRes.data?.sessionToken === 'string');

    // 26. Selected voice preserved (we set voice to Charon earlier in preferences)
    assert('26. User preference voice (Charon) preserved in live session', voiceSessionRes.data?.voice === 'Charon');

    // ==========================================
    // 8. ACCOUNT DELETION
    // ==========================================
    console.log('\n--- Phase 8: Complete Account Deletion ---');

    // 19. Delete account
    const deleteAccountRes = await request(server, 'DELETE', '/api/auth/account', {
      password: newPassword,
    }, {
      Authorization: `Bearer ${userAToken}`,
    });
    assert('19. DELETE /api/auth/account succeeds', deleteAccountRes.status === 200 && deleteAccountRes.data?.success === true);

    // Verify user no longer exists
    const checkDeletedUser = await User.findById(userAId);
    assert('19b. User document purged from database', checkDeletedUser === null);

  } catch (err) {
    console.error('💥 Unexpected Test Suite Error:', err);
    failed++;
  } finally {
    server.close();
  }

  console.log('\n=============================================================');
  console.log(`📊 Test Results: ${passed} Passed, ${failed} Failed`);
  console.log('=============================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
};

if (require.main === module) {
  runAuthAccountTests();
}

module.exports = { runAuthAccountTests };
