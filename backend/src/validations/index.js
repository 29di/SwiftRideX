const authValidation = require("./authValidation");
const driverValidation = require("./driverValidation");
const rideValidation = require("./rideValidation");

module.exports = {
  ...authValidation,
  ...driverValidation,
  ...rideValidation,
};
