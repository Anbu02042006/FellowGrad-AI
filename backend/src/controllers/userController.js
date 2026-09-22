const UserService = require('../services/userService');

const getProfile = async (req, res, next) => {
  try {
    const userId = req.params.userId || req.user?.userId || req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized: User not identified' });
    }

    // Strict user isolation check if user is authenticated and accessing another user's path
    if (req.user && req.params.userId && req.params.userId !== req.user.id && req.params.userId !== req.user.userId) {
      return res.status(403).json({ error: 'Forbidden: Access denied to other user profile' });
    }

    const profile = await UserService.getProfile(userId);
    return res.status(200).json(profile);
  } catch (err) {
    next(err);
  }
};

const updateProfile = async (req, res, next) => {
  try {
    const userId = req.params.userId || req.user?.userId || req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized: User not identified' });
    }

    // Strict user isolation check
    if (req.user && req.params.userId && req.params.userId !== req.user.id && req.params.userId !== req.user.userId) {
      return res.status(403).json({ error: 'Forbidden: Access denied to update other user profile' });
    }

    const profile = await UserService.updateProfile(userId, req.body);
    return res.status(200).json(profile);
  } catch (err) {
    next(err);
  }
};

const getPreferences = async (req, res, next) => {
  try {
    const userId = req.user?.userId || req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const preferences = await UserService.getPreferences(userId);
    return res.status(200).json({ success: true, preferences });
  } catch (err) {
    next(err);
  }
};

const updatePreferences = async (req, res, next) => {
  try {
    const userId = req.user?.userId || req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const result = await UserService.updatePreferences(userId, req.body);
    return res.status(200).json(result);
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getProfile,
  updateProfile,
  getPreferences,
  updatePreferences,
};
