const UserService = require('../services/userService');

const getProfile = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const profile = await UserService.getProfile(userId);
    return res.status(200).json(profile);
  } catch (err) {
    next(err);
  }
};

const updateProfile = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const profile = await UserService.updateProfile(userId, req.body);
    return res.status(200).json(profile);
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getProfile,
  updateProfile,
};
