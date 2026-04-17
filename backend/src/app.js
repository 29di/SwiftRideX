const express = require("express");
const cors = require("cors");

const routes = require("./routes");
const notFound = require("./middlewares/notFound");
const errorHandler = require("./middlewares/errorHandler");
const requestLogger = require("./middlewares/requestLogger");

const app = express();

app.use(cors());
app.use(express.json());
app.use(requestLogger);

app.get("/", (req, res) => {
  res.send("SwiftrideX Backend Running");
});

app.use("/api", routes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
