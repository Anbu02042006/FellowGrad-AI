/**
 * Google Cloud Firestore & Firebase Admin Initialization
 * Project: fellowgrad-ai (or GOOGLE_CLOUD_PROJECT / FIREBASE_PROJECT_ID)
 *
 * Configured for GCP Cloud Run service account via Application Default Credentials (ADC).
 * Provides graceful in-memory storage fallback for offline local tests/development.
 */

const admin = require('firebase-admin');

let firestoreInstance = null;
let isFirestoreConnected = false;

const GCP_PROJECT_ID =
  process.env.GOOGLE_CLOUD_PROJECT ||
  process.env.GCP_PROJECT_ID ||
  process.env.FIREBASE_PROJECT_ID ||
  'fellowgrad-ai';

/**
 * Initialize Firebase Admin SDK
 */
const initFirestore = () => {
  if (firestoreInstance) {
    return firestoreInstance;
  }

  try {
    const hasApps = Array.isArray(admin?.apps) && admin.apps.length > 0;
    if (!hasApps) {
      if (
        process.env.FIREBASE_CLIENT_EMAIL &&
        process.env.FIREBASE_PRIVATE_KEY
      ) {
        console.log(`[Firestore] Initializing Firebase Admin with service account credentials for project: ${GCP_PROJECT_ID}`);
        admin.initializeApp({
          credential: admin.credential.cert({
            projectId: GCP_PROJECT_ID,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
          }),
          projectId: GCP_PROJECT_ID,
        });
      } else {
        console.log(`[Firestore] Initializing Firebase Admin via Application Default Credentials (ADC) for project: ${GCP_PROJECT_ID}`);
        if (admin.credential && typeof admin.credential.applicationDefault === 'function') {
          admin.initializeApp({
            credential: admin.credential.applicationDefault(),
            projectId: GCP_PROJECT_ID,
          });
        } else {
          admin.initializeApp({
            projectId: GCP_PROJECT_ID,
          });
        }
      }
    }

    firestoreInstance = admin.firestore();
    // Configure settings for timestamp handling
    try {
      firestoreInstance.settings({ ignoreUndefinedProperties: true });
    } catch (_) {
      // settings can only be called once
    }

    isFirestoreConnected = true;
    console.log(`[Firestore] Google Cloud Firestore initialized successfully for project: ${GCP_PROJECT_ID}`);
  } catch (err) {
    console.warn(`[Firestore] Cloud Firestore initialization note (${err.message}). Using resilient local in-memory store for development/tests.`);
    isFirestoreConnected = false;
    firestoreInstance = createInMemoryFirestore();
  }

  return firestoreInstance;
};

/**
 * Lightweight in-memory Firestore-compatible mock for seamless offline local development and test runs
 */
function createInMemoryFirestore() {
  const store = new Map(); // path -> document data

  const getDocData = (path) => store.get(path) || null;
  const setDocData = (path, data, options = {}) => {
    const existing = store.get(path) || {};
    const merged = options.merge ? { ...existing, ...data } : { ...data };
    store.set(path, merged);
    return merged;
  };

  const deleteDocData = (path) => {
    store.delete(path);
  };

  const createDocRef = (path) => ({
    id: path.split('/').pop(),
    path,
    get: async () => {
      const data = getDocData(path);
      return {
        id: path.split('/').pop(),
        exists: !!data,
        data: () => (data ? { ...data } : undefined),
      };
    },
    set: async (data, options) => {
      const saved = setDocData(path, data, options);
      return saved;
    },
    update: async (data) => {
      return setDocData(path, data, { merge: true });
    },
    delete: async () => {
      deleteDocData(path);
      return true;
    },
    collection: (subCollName) => createCollectionRef(`${path}/${subCollName}`),
  });

  const createCollectionRef = (collPath) => {
    return {
      id: collPath.split('/').pop(),
      path: collPath,
      doc: (docId) => {
        const id = docId || `doc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        return createDocRef(`${collPath}/${id}`);
      },
      add: async (data) => {
        const id = `doc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const docRef = createDocRef(`${collPath}/${id}`);
        await docRef.set({ ...data, id });
        return docRef;
      },
      where: function (field, op, val) {
        return this; // Basic chaining for queries
      },
      orderBy: function (field, direction = 'asc') {
        return this;
      },
      limit: function (num) {
        return this;
      },
      get: async () => {
        const docs = [];
        const prefix = collPath.endsWith('/') ? collPath : `${collPath}/`;
        for (const [key, val] of store.entries()) {
          if (key.startsWith(prefix)) {
            const remainder = key.slice(prefix.length);
            // Must be immediate child
            if (!remainder.includes('/')) {
              docs.push({
                id: remainder,
                exists: true,
                data: () => ({ ...val }),
              });
            }
          }
        }
        return {
          empty: docs.length === 0,
          size: docs.length,
          docs,
          forEach: (cb) => docs.forEach(cb),
        };
      },
    };
  };

  const createCollectionGroupRef = (groupName) => {
    return {
      where: function (field, op, val) {
        return {
          limit: function (n = 10) {
            return {
              get: async () => {
                const docs = [];
                for (const [key, docData] of store.entries()) {
                  const parts = key.split('/');
                  if (parts.length >= 2 && parts[parts.length - 2] === groupName) {
                    if (docData && (docData[field] === val || field === 'id')) {
                      docs.push({
                        id: parts[parts.length - 1],
                        exists: true,
                        data: () => ({ ...docData }),
                        ref: createDocRef(key),
                      });
                      if (docs.length >= n) break;
                    }
                  }
                }
                return {
                  empty: docs.length === 0,
                  size: docs.length,
                  docs,
                  forEach: (cb) => docs.forEach(cb),
                };
              },
            };
          },
        };
      },
    };
  };

  return {
    collection: (name) => createCollectionRef(name),
    doc: (path) => createDocRef(path),
    collectionGroup: (name) => createCollectionGroupRef(name),
    batch: () => ({
      delete: (ref) => ref.delete(),
      set: (ref, data, opts) => ref.set(data, opts),
      commit: async () => true,
    }),
    _store: store,
  };
}

/**
 * Helper to get Firestore instance
 */
const getFirestore = () => {
  if (!firestoreInstance) {
    return initFirestore();
  }
  return firestoreInstance;
};

// Safe FieldValue helper
const FieldValue = {
  serverTimestamp: () => {
    try {
      return admin.firestore.FieldValue.serverTimestamp();
    } catch (_) {
      return new Date().toISOString();
    }
  },
  increment: (n) => {
    try {
      return admin.firestore.FieldValue.increment(n);
    } catch (_) {
      return n;
    }
  },
};

module.exports = {
  getFirestore,
  initFirestore,
  isFirestoreConnected: () => isFirestoreConnected,
  FieldValue,
  admin,
  GCP_PROJECT_ID,
};
