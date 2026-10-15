const AuthService = require('../services/authService');

const register = async (req, res, next) => {
  try {
    const { fullName, name, email, password, confirmPassword } = req.body;
    const result = await AuthService.register({
      fullName: fullName || name,
      name: fullName || name,
      email,
      password,
      confirmPassword,
    });
    return res.status(200).json(result);
  } catch (err) {
    next(err);
  }
};

const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const result = await AuthService.login({ email, password });
    return res.status(200).json(result);
  } catch (err) {
    next(err);
  }
};

const logout = async (req, res, next) => {
  try {
    // In JWT stateless architecture, logout succeeds immediately on client clearing state;
    // can also invalidate server-side session if session ID is provided.
    return res.status(200).json({
      success: true,
      message: 'Logged out successfully',
    });
  } catch (err) {
    next(err);
  }
};

const refresh = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    const result = await AuthService.refreshSession(refreshToken);
    return res.status(200).json(result);
  } catch (err) {
    next(err);
  }
};

const getMe = async (req, res, next) => {
  try {
    const userId = req.user.userId || req.user.id;
    const user = await AuthService.getMe(userId);
    return res.status(200).json({
      success: true,
      user,
    });
  } catch (err) {
    next(err);
  }
};

const changePassword = async (req, res, next) => {
  try {
    const userId = req.user.userId || req.user.id;
    const { currentPassword, newPassword, confirmNewPassword } = req.body;
    const result = await AuthService.changePassword(userId, {
      currentPassword,
      newPassword,
      confirmNewPassword,
    });
    return res.status(200).json(result);
  } catch (err) {
    next(err);
  }
};

const deleteAccount = async (req, res, next) => {
  try {
    const userId = req.user.userId || req.user.id;
    const { password } = req.body || {};
    const result = await AuthService.deleteAccount(userId, password);
    return res.status(200).json(result);
  } catch (err) {
    next(err);
  }
};

const forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }
    const result = await AuthService.forgotPassword(email);
    return res.status(200).json(result);
  } catch (err) {
    next(err);
  }
};

const resetPassword = async (req, res, next) => {
  try {
    const { email, token, newPassword, confirmPassword } = req.body;
    const result = await AuthService.resetPassword({
      email,
      token,
      newPassword,
      confirmPassword,
    });
    return res.status(200).json(result);
  } catch (err) {
    next(err);
  }
};

const googleSignIn = async (req, res, next) => {
  try {
    const result = await AuthService.googleSignIn(req.body);
    return res.status(200).json(result);
  } catch (err) {
    next(err);
  }
};

const validateToken = async (req, res, next) => {
  try {
    const token = req.query.token;
    const isValid = await AuthService.validateToken(token);
    return res.status(200).json(isValid);
  } catch (err) {
    next(err);
  }
};

module.exports = {
  register,
  login,
  googleSignIn,
  logout,
  refresh,
  getMe,
  changePassword,
  deleteAccount,
  forgotPassword,
  resetPassword,
  validateToken,
};
