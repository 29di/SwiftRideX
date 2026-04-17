const authValidation = require("./authValidation");
const driverValidation = require("./driverValidation");
const rideValidation = require("./rideValidation");
const rideChatValidation = require("./rideChatValidation");

module.exports = {
  ...authValidation,
  ...driverValidation,
  ...rideValidation,
  ...rideChatValidation,
};
