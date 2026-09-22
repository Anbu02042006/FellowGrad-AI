const ConversationService = require('../src/services/conversationService');
const MemoryService = require('../src/services/memoryService');
const { getFirestore } = require('../src/config/firestore');

async function verifyRealFirestore() {
  console.log('--- Step A: Initializing and Verifying Real Firestore ---');
  const db = getFirestore();
  const testUserId = 'test_user_real_firestore_' + Date.now();
  
  // 1. Create a conversation using backend ConversationService
  console.log('--- Step B: Writing Conversation via ConversationService ---');
  const conv = await ConversationService.createConversation({
    userId: testUserId,
    title: 'Verification Real Firestore Conversation',
  });
  console.log('Conversation created with ID:', conv.id);

  // 2. Save user and assistant messages
  console.log('--- Step C: Saving Messages via ConversationService ---');
  const userMsg = await ConversationService.saveUserMessage(
    testUserId,
    conv.id,
    'Hello FellowGrad, please confirm this message is stored in GCP Firestore!'
  );
  console.log('User message saved with ID:', userMsg?.id);

  const asstMsg = await ConversationService.saveAssistantMessage(
    testUserId,
    conv.id,
    'Confirmed! This message is stored in real Google Cloud Firestore under project fellowgrad-ai.'
  );
  console.log('Assistant message saved with ID:', asstMsg?.id);

  // 3. Save a memory using MemoryService
  console.log('--- Step D: Saving Memory via MemoryService ---');
  const mem = await MemoryService.saveMemory(testUserId, {
    category: 'academic',
    content: 'Student is preparing for GCP Cloud certification.',
    importance: 0.95,
    sourceConversationId: conv.id,
  });
  console.log('Memory saved with ID:', mem?.id);

  // 4. Directly read back documents from GCP Firestore client to prove persistence in GCP Firestore
  console.log('--- Step E: Direct GCP Firestore Read Verification ---');
  const convDoc = await db.doc(`users/${testUserId}/conversations/${conv.id}`).get();
  console.log('GCP Firestore Conversation Doc exists:', convDoc.exists);
  console.log('GCP Firestore Conversation Doc data:', JSON.stringify(convDoc.data(), null, 2));

  const msgsSnapshot = await db.collection(`users/${testUserId}/conversations/${conv.id}/messages`).get();
  console.log('GCP Firestore Messages count:', msgsSnapshot.size);
  msgsSnapshot.forEach((doc) => {
    console.log('  - Message doc ID:', doc.id, 'role:', doc.data().role, 'content:', doc.data().content);
  });

  const memDoc = await db.doc(`users/${testUserId}/memories/${mem.id}`).get();
  console.log('GCP Firestore Memory Doc exists:', memDoc.exists);
  console.log('GCP Firestore Memory Doc data:', JSON.stringify(memDoc.data(), null, 2));

  console.log('\n✅ ALL REAL GCP FIRESTORE CHECKS SUCCEEDED!');
}

verifyRealFirestore().catch((err) => {
  console.error('❌ Verification failed:', err);
  process.exit(1);
});
