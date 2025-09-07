const app = require("./app");
const sequelize = require("./models/index");

const http = require("http").createServer(app);
const { Server } = require("socket.io");
const io = new Server(http, {
  cors: {
    origin: "*", // à restreindre en prod
    methods: ["GET", "POST"],
  },
});

// Injection de io dans app
app.set("io", io);

// Chargement de la logique socket
require("./socket")(io);

const PORT = process.env.PORT || 3010;

sequelize.authenticate().then(() => {
  console.log("✅ DB connected");
  http.listen(PORT, () =>
    console.log(`🚀 Server running with WebSocket on port ${PORT}`)
  );
});
