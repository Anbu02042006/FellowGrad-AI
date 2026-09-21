/**
 * Simple field validator middleware generator
 */
const requireFields = (fields) => {
  return (req, res, next) => {
    const missing = [];
    for (const field of fields) {
      if (req.body[field] === undefined || req.body[field] === null || req.body[field] === '') {
        missing.push(field);
      }
    }

    if (missing.length > 0) {
      const errorObj = {};
      missing.forEach((f) => {
        errorObj[f] = `${f} is required`;
      });
      return res.status(400).json(errorObj);
    }

    next();
  };
};

module.exports = {
  requireFields,
};
