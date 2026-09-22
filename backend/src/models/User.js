const { v4: uuidv4 } = require('uuid');
const { getPgPool, isPgConnected, inMemoryStore } = require('../config/database');
const { getFirestore, isFirestoreConnected } = require('../config/firestore');

class User {
  constructor(data = {}) {
    this.id = data.id || uuidv4();
    this.fullName = data.fullName || data.name || '';
    this.name = this.fullName; // Backward compatibility alias
    this.email = (data.email || '').toLowerCase().trim();
    this.password = data.password || data.passwordHash || '';
    this.passwordHash = this.password;
    this.profileImageUrl = data.profileImageUrl || null;
    this.createdAt = data.createdAt || new Date().toISOString();
    this.updatedAt = data.updatedAt || new Date().toISOString();
    this.lastLoginAt = data.lastLoginAt || new Date().toISOString();

    // Default preferences inspired by modern AI assistant apps
    this.preferences = {
      theme: 'dark',
      language: 'en',
      voice: 'Aoede',
      memoryEnabled: true,
      notificationsEnabled: true,
      ...(data.preferences || {}),
    };

    // Default academic profile for personalization
    this.academicProfile = {
      college: '',
      course: '',
      year: '',
      interests: [],
      goals: [],
      ...(data.academicProfile || {}),
    };
  }

  /**
   * Return safe user representation (strictly omitting passwords and hashes)
   */
  toSafeJSON() {
    return {
      id: this.id,
      userId: this.id,
      fullName: this.fullName,
      name: this.fullName,
      email: this.email,
      profileImageUrl: this.profileImageUrl,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      lastLoginAt: this.lastLoginAt,
      preferences: { ...this.preferences },
      academicProfile: { ...this.academicProfile },
    };
  }

  toJSON() {
    return this.toSafeJSON();
  }

  static _normalizeEmail(email) {
    return (email || '').toLowerCase().trim();
  }

  /**
   * Find user by email
   */
  static async findByEmail(email) {
    if (!email) return null;
    const normalizedEmail = this._normalizeEmail(email);

    // 1. Try Firestore
    try {
      const db = getFirestore();
      if (db) {
        // First check email index document
        const emailDoc = await db.collection('userEmails').doc(normalizedEmail).get();
        if (emailDoc.exists) {
          const emailData = emailDoc.data();
          if (emailData?.userId) {
            const userDoc = await db.collection('users').doc(emailData.userId).get();
            if (userDoc.exists) {
              return new User(userDoc.data());
            }
          }
        }

        // Direct lookup by email in users collection
        const snapshot = await db.collection('users').where('email', '==', normalizedEmail).limit(1).get();
        if (!snapshot.empty) {
          const doc = snapshot.docs[0];
          return new User(doc.data());
        }
      }
    } catch (err) {
      console.warn(`[User] Firestore findByEmail note: ${err.message}`);
    }

    // 2. Try PostgreSQL if connected
    if (isPgConnected()) {
      try {
        const pool = getPgPool();
        const res = await pool.query('SELECT * FROM _user WHERE LOWER(email) = $1 LIMIT 1', [normalizedEmail]);
        if (res.rows.length > 0) {
          return new User(res.rows[0]);
        }
      } catch (err) {
        console.warn(`[User] Postgres findByEmail note: ${err.message}`);
      }
    }

    // 3. Fallback to in-memory store
    for (const user of inMemoryStore.users.values()) {
      if ((user.email || '').toLowerCase() === normalizedEmail) {
        return new User(user);
      }
    }

    return null;
  }

  /**
   * Find user by ID
   */
  static async findById(id) {
    if (!id) return null;

    // 1. Try Firestore
    try {
      const db = getFirestore();
      if (db) {
        const doc = await db.collection('users').doc(id).get();
        if (doc.exists) {
          return new User(doc.data());
        }
      }
    } catch (err) {
      console.warn(`[User] Firestore findById note: ${err.message}`);
    }

    // 2. Try PostgreSQL if connected
    if (isPgConnected()) {
      try {
        const pool = getPgPool();
        const res = await pool.query('SELECT * FROM _user WHERE id = $1 LIMIT 1', [id]);
        if (res.rows.length > 0) {
          return new User(res.rows[0]);
        }
      } catch (err) {
        console.warn(`[User] Postgres findById note: ${err.message}`);
      }
    }

    // 3. Fallback to in-memory store
    const user = inMemoryStore.users.get(id);
    return user ? new User(user) : null;
  }

  /**
   * Create a new user atomically
   */
  static async create({ fullName, name, email, password, passwordHash, preferences = {}, academicProfile = {} }) {
    const normalizedEmail = this._normalizeEmail(email);
    const resolvedName = (fullName || name || '').trim();
    const resolvedPassword = passwordHash || password;
    const now = new Date().toISOString();

    const user = new User({
      id: uuidv4(),
      fullName: resolvedName,
      name: resolvedName,
      email: normalizedEmail,
      password: resolvedPassword,
      createdAt: now,
      updatedAt: now,
      lastLoginAt: now,
      preferences,
      academicProfile,
    });

    // 1. Firestore persistence with transaction check for duplicate email
    try {
      const db = getFirestore();
      if (db) {
        const emailRef = db.collection('userEmails').doc(normalizedEmail);
        const userRef = db.collection('users').doc(user.id);

        if (typeof db.runTransaction === 'function') {
          await db.runTransaction(async (t) => {
            const emailDoc = await t.get(emailRef);
            if (emailDoc.exists) {
              const err = new Error('Email already registered');
              err.status = 409;
              throw err;
            }
            t.set(emailRef, {
              userId: user.id,
              email: normalizedEmail,
              createdAt: now,
            });
            t.set(userRef, {
              id: user.id,
              fullName: user.fullName,
              name: user.fullName,
              email: user.email,
              passwordHash: resolvedPassword,
              profileImageUrl: user.profileImageUrl,
              createdAt: now,
              updatedAt: now,
              lastLoginAt: now,
              preferences: user.preferences,
              academicProfile: user.academicProfile,
            });
          });
        } else {
          // Fallback if transaction not supported
          const emailDoc = await emailRef.get();
          if (emailDoc.exists) {
            const err = new Error('Email already registered');
            err.status = 409;
            throw err;
          }
          await emailRef.set({ userId: user.id, email: normalizedEmail, createdAt: now });
          await userRef.set({
            id: user.id,
            fullName: user.fullName,
            name: user.fullName,
            email: user.email,
            passwordHash: resolvedPassword,
            profileImageUrl: user.profileImageUrl,
            createdAt: now,
            updatedAt: now,
            lastLoginAt: now,
            preferences: user.preferences,
            academicProfile: user.academicProfile,
          });
        }
      }
    } catch (err) {
      if (err.status === 409) throw err;
      console.warn(`[User] Firestore create note: ${err.message}`);
    }

    // 2. Also keep Postgres in sync if connected
    if (isPgConnected()) {
      try {
        const pool = getPgPool();
        await pool.query(
          'INSERT INTO _user (id, name, email, password) VALUES ($1, $2, $3, $4)',
          [user.id, user.fullName, user.email, resolvedPassword]
        );
      } catch (err) {
        console.warn(`[User] Postgres create note: ${err.message}`);
      }
    }

    // 3. Keep in-memory store in sync for instant test availability
    inMemoryStore.users.set(user.id, {
      id: user.id,
      fullName: user.fullName,
      name: user.fullName,
      email: user.email,
      password: resolvedPassword,
      passwordHash: resolvedPassword,
      profileImageUrl: user.profileImageUrl,
      createdAt: now,
      updatedAt: now,
      lastLoginAt: now,
      preferences: { ...user.preferences },
      academicProfile: { ...user.academicProfile },
    });

    return user;
  }

  /**
   * Update user document
   */
  static async update(id, updates = {}) {
    const existing = await this.findById(id);
    if (!existing) {
      const err = new Error(`User not found: ${id}`);
      err.status = 404;
      throw err;
    }

    const now = new Date().toISOString();
    const updatedData = {
      ...existing,
      ...updates,
      updatedAt: now,
    };
    if (updates.fullName || updates.name) {
      updatedData.fullName = updates.fullName || updates.name;
      updatedData.name = updatedData.fullName;
    }
    if (updates.preferences) {
      updatedData.preferences = { ...existing.preferences, ...updates.preferences };
    }
    if (updates.academicProfile) {
      updatedData.academicProfile = { ...existing.academicProfile, ...updates.academicProfile };
    }

    // 1. Update in Firestore
    try {
      const db = getFirestore();
      if (db) {
        const userRef = db.collection('users').doc(id);
        const firestoreData = { ...updatedData };
        delete firestoreData.password; // Do not overwrite with raw password
        await userRef.set(firestoreData, { merge: true });
      }
    } catch (err) {
      console.warn(`[User] Firestore update note: ${err.message}`);
    }

    // 2. Update Postgres if connected
    if (isPgConnected()) {
      try {
        const pool = getPgPool();
        await pool.query(
          'UPDATE _user SET name = $1, password = $2 WHERE id = $3',
          [updatedData.fullName, updatedData.passwordHash || updatedData.password, id]
        );
      } catch (err) {
        console.warn(`[User] Postgres update note: ${err.message}`);
      }
    }

    // 3. Update in-memory store
    inMemoryStore.users.set(id, updatedData);

    return new User(updatedData);
  }

  /**
   * Delete user and their associated data completely
   */
  static async delete(id) {
    const existing = await this.findById(id);
    if (!existing) return false;

    // 1. Delete from Firestore
    try {
      const db = getFirestore();
      if (db) {
        // Delete email index
        if (existing.email) {
          await db.collection('userEmails').doc(existing.email).delete();
        }
        // Delete user doc
        await db.collection('users').doc(id).delete();
      }
    } catch (err) {
      console.warn(`[User] Firestore delete note: ${err.message}`);
    }

    // 2. Delete from Postgres if connected
    if (isPgConnected()) {
      try {
        const pool = getPgPool();
        await pool.query('DELETE FROM _user WHERE id = $1', [id]);
      } catch (err) {
        console.warn(`[User] Postgres delete note: ${err.message}`);
      }
    }

    // 3. Delete from in-memory store
    inMemoryStore.users.delete(id);

    return true;
  }
}

module.exports = User;
