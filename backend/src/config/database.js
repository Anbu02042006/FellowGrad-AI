const { Pool } = require('pg');
const mongoose = require('mongoose');

let pgPool = null;
let isPgConnected = false;
let isMongoConnected = false;

// In-memory fallback stores when databases are offline (for seamless local development & testing)
const inMemoryStore = {
  users: new Map(),
  userProfiles: new Map(),
  conversations: new Map(),
  messages: new Map(),
};

/**
 * Initialize PostgreSQL connection and run migrations
 */
const initPostgres = async () => {
  try {
    const connectionString = process.env.DATABASE_URL ||
      `postgres://${process.env.PGUSER || 'postgres'}:${process.env.PGPASSWORD || 'admin'}@${process.env.PGHOST || 'localhost'}:${process.env.PGPORT || 5432}/${process.env.PGDATABASE || 'fellowgrad_auth'}`;

    pgPool = new Pool({
      connectionString,
      connectionTimeoutMillis: 3000,
    });

    const client = await pgPool.connect();
    isPgConnected = true;
    console.log('[PostgreSQL] Connected successfully to database');

    // Run automatic table initialization matching Spring Boot JPA entities
    await client.query(`
      CREATE TABLE IF NOT EXISTS _user (
        id VARCHAR(64) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS user_profiles (
        id VARCHAR(64) PRIMARY KEY,
        user_id VARCHAR(64) UNIQUE NOT NULL,
        name VARCHAR(255),
        education_level VARCHAR(255),
        college VARCHAR(255),
        course VARCHAR(255),
        interests TEXT,
        career_goals TEXT,
        skills TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    client.release();
    console.log('[PostgreSQL] Schema initialized (_user, user_profiles tables ready)');
  } catch (err) {
    isPgConnected = false;
    console.warn(`[PostgreSQL] Could not connect to PostgreSQL (${err.message}). Using resilient in-memory store for development.`);
  }
};

/**
 * Initialize MongoDB connection via Mongoose
 */
const initMongo = async () => {
  const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/fellowgrad_conversations';
  try {
    mongoose.set('strictQuery', false);
    await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 3000,
    });
    isMongoConnected = true;
    console.log('[MongoDB] Connected successfully to MongoDB');
  } catch (err) {
    isMongoConnected = false;
    console.warn(`[MongoDB] Could not connect to MongoDB (${err.message}). Using resilient in-memory store for conversations/messages.`);
  }
};

/**
 * Initialize all database connections
 */
const connectDatabases = async () => {
  await Promise.allSettled([initPostgres(), initMongo()]);
};

module.exports = {
  connectDatabases,
  getPgPool: () => pgPool,
  isPgConnected: () => isPgConnected,
  isMongoConnected: () => isMongoConnected,
  inMemoryStore,
};
