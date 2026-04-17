const healthService = require("../services/healthService");

const getHealth = (req, res) => {
  const payload = healthService.getStatus();
  res.status(200).json(payload);
};

module.exports = {
  getHealth,
};
