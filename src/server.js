const app = require("./app");
const sequelize = require("./models/index");
const logger = require("./utils/logger");

const http = require("http").createServer(app);
const { Server } = require("socket.io");
require("dotenv").config();

const corsOrigins = (process.env.CORS_ORIGINS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const io = new Server(http, {
  cors: {
    origin:
      corsOrigins.length === 0
        ? process.env.NODE_ENV === "production"
          ? false
          : "*"
        : corsOrigins,
    methods: ["GET", "POST"],
  },
});

// Injection de io dans app
app.set("io", io);

// Chargement de la logique socket
require("./socket")(io);

const PORT = process.env.PORT || 3010;

sequelize.authenticate().then(() => {
  logger.info("DB connected");
  http.listen(PORT, () =>
    logger.info({ port: PORT }, "Server running with WebSocket")
  );
});
