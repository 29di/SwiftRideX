const getStatus = () => ({
  status: "ok",
  service: "SwiftrideX Backend",
  timestamp: new Date().toISOString(),
});

module.exports = {
  getStatus,
};
