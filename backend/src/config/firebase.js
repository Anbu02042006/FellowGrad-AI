/**
 * Firebase Admin configuration (Optional)
 */

let firebaseApp = null;

const initFirebase = () => {
  if (
    process.env.FIREBASE_PROJECT_ID &&
    process.env.FIREBASE_CLIENT_EMAIL &&
    process.env.FIREBASE_PRIVATE_KEY
  ) {
    try {
      // Lazy load to avoid hard dependency if not used
      const admin = require('firebase-admin');
      firebaseApp = admin.initializeApp({
        credential: admin.credential.cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
        }),
      });
      console.log('[Firebase] Admin initialized successfully');
    } catch (err) {
      console.warn(`[Firebase] Failed to initialize Firebase: ${err.message}`);
    }
  }
};

initFirebase();

module.exports = {
  getFirebaseApp: () => firebaseApp,
};
