const AuthService = require('../services/authService');

const register = async (req, res, next) => {
  try {
    const { name, email, password } = req.body;
    const result = await AuthService.register({ name, email, password });
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
  validateToken,
};
