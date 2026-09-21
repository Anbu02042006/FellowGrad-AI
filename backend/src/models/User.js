const { v4: uuidv4 } = require('uuid');
const { getPgPool, isPgConnected, inMemoryStore } = require('../config/database');

class User {
  constructor({ id, name, email, password }) {
    this.id = id || uuidv4();
    this.name = name;
    this.email = email;
    this.password = password;
  }

  static async findByEmail(email) {
    if (isPgConnected()) {
      const pool = getPgPool();
      const res = await pool.query('SELECT * FROM _user WHERE email = $1 LIMIT 1', [email]);
      if (res.rows.length > 0) {
        return new User(res.rows[0]);
      }
      return null;
    }

    // Resilient in-memory fallback
    for (const user of inMemoryStore.users.values()) {
      if (user.email.toLowerCase() === email.toLowerCase()) {
        return new User(user);
      }
    }
    return null;
  }

  static async findById(id) {
    if (isPgConnected()) {
      const pool = getPgPool();
      const res = await pool.query('SELECT * FROM _user WHERE id = $1 LIMIT 1', [id]);
      if (res.rows.length > 0) {
        return new User(res.rows[0]);
      }
      return null;
    }

    const user = inMemoryStore.users.get(id);
    return user ? new User(user) : null;
  }

  static async create({ name, email, password }) {
    const user = new User({ id: uuidv4(), name, email, password });

    if (isPgConnected()) {
      const pool = getPgPool();
      await pool.query(
        'INSERT INTO _user (id, name, email, password) VALUES ($1, $2, $3, $4)',
        [user.id, user.name, user.email, user.password]
      );
    } else {
      inMemoryStore.users.set(user.id, { ...user });
    }

    return user;
  }
}

module.exports = User;
