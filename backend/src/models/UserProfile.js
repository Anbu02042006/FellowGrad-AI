const { v4: uuidv4 } = require('uuid');
const { getPgPool, isPgConnected, inMemoryStore } = require('../config/database');

class UserProfile {
  constructor(data = {}) {
    this.id = data.id || uuidv4();
    this.userId = data.userId || data.user_id;
    this.name = data.name || null;
    this.educationLevel = data.educationLevel || data.education_level || null;
    this.college = data.college || null;
    this.course = data.course || null;
    this.interests = data.interests || null;
    this.careerGoals = data.careerGoals || data.career_goals || null;
    this.skills = data.skills || null;
    this.createdAt = data.createdAt || data.created_at || new Date().toISOString();
    this.updatedAt = data.updatedAt || data.updated_at || new Date().toISOString();
  }

  toJSON() {
    return {
      id: this.id,
      userId: this.userId,
      name: this.name,
      educationLevel: this.educationLevel,
      college: this.college,
      course: this.course,
      interests: this.interests,
      careerGoals: this.careerGoals,
      skills: this.skills,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }

  static async findByUserId(userId) {
    if (isPgConnected()) {
      const pool = getPgPool();
      const res = await pool.query('SELECT * FROM user_profiles WHERE user_id = $1 LIMIT 1', [userId]);
      if (res.rows.length > 0) {
        return new UserProfile(res.rows[0]);
      }
      return null;
    }

    // In-memory fallback
    const profile = inMemoryStore.userProfiles.get(userId);
    return profile ? new UserProfile(profile) : null;
  }

  static async upsert(userId, data) {
    const now = new Date().toISOString();
    let existing = await UserProfile.findByUserId(userId);

    if (existing) {
      existing.name = data.name !== undefined ? data.name : existing.name;
      existing.educationLevel = data.educationLevel !== undefined ? data.educationLevel : existing.educationLevel;
      existing.college = data.college !== undefined ? data.college : existing.college;
      existing.course = data.course !== undefined ? data.course : existing.course;
      existing.interests = data.interests !== undefined ? data.interests : existing.interests;
      existing.careerGoals = data.careerGoals !== undefined ? data.careerGoals : existing.careerGoals;
      existing.skills = data.skills !== undefined ? data.skills : existing.skills;
      existing.updatedAt = now;

      if (isPgConnected()) {
        const pool = getPgPool();
        await pool.query(
          `UPDATE user_profiles SET
            name = $1, education_level = $2, college = $3, course = $4,
            interests = $5, career_goals = $6, skills = $7, updated_at = $8
           WHERE user_id = $9`,
          [
            existing.name,
            existing.educationLevel,
            existing.college,
            existing.course,
            existing.interests,
            existing.careerGoals,
            existing.skills,
            now,
            userId,
          ]
        );
      } else {
        inMemoryStore.userProfiles.set(userId, existing.toJSON());
      }
      return existing;
    } else {
      const newProfile = new UserProfile({
        id: uuidv4(),
        userId,
        name: data.name,
        educationLevel: data.educationLevel,
        college: data.college,
        course: data.course,
        interests: data.interests,
        careerGoals: data.careerGoals,
        skills: data.skills,
        createdAt: now,
        updatedAt: now,
      });

      if (isPgConnected()) {
        const pool = getPgPool();
        await pool.query(
          `INSERT INTO user_profiles
            (id, user_id, name, education_level, college, course, interests, career_goals, skills, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
          [
            newProfile.id,
            newProfile.userId,
            newProfile.name,
            newProfile.educationLevel,
            newProfile.college,
            newProfile.course,
            newProfile.interests,
            newProfile.careerGoals,
            newProfile.skills,
            newProfile.createdAt,
            newProfile.updatedAt,
          ]
        );
      } else {
        inMemoryStore.userProfiles.set(userId, newProfile.toJSON());
      }
      return newProfile;
    }
  }
}

module.exports = UserProfile;
