const UserProfile = require('../models/UserProfile');

class UserService {
  /**
   * Get user profile by userId
   */
  static async getProfile(userId) {
    const profile = await UserProfile.findByUserId(userId);
    if (!profile) {
      const err = new Error(`Profile not found for user: ${userId}`);
      err.status = 404;
      throw err;
    }
    return profile.toJSON();
  }

  /**
   * Update or create user profile
   */
  static async updateProfile(userId, request) {
    const updated = await UserProfile.upsert(userId, request);
    return updated.toJSON();
  }
}

module.exports = UserService;
