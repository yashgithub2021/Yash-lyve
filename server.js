const app = require("./app");
const { connectDatabase } = require("./config/database");
// const http = require("http");
const http = require("http");
const server = http.createServer(app);
const { Server } = require("socket.io");

process.on("uncaughtException", (err) => {
  console.log(err);
  // process.exit(0);
});

// connecting database
console.log("Connecting database");
connectDatabase();

// creating server
const port = process.env.PORT || 5000;

// ========== socekt start here ==============

// Store event data with their IDs and user counts
const events = {};

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
  maxHttpBufferSize: 1e8,
});

io.on("connection", (socket) => {
  console.log("A user is Connected");

  // When a user joins an event room
  socket.on("joinEvent", ({ eventId, users }) => {
    // Create the event room if it doesn't exist
    console.log(eventId, users);
    if (!events[eventId]) {
      events[eventId] = {
        users: new Map(),
        userCount: 0,
      };
    }

    // Add users to the event room
    users.forEach((user) => {
      events[eventId].users.set(user.id, user);
    });

    events[eventId].userCount = events[eventId].users.size;

    // Emit updated user count to all users in the event room
    io.emit("userCountUpdated", events[eventId].userCount);

    console.log(`${events[eventId].userCount} Users joined event ${eventId}`);

    // Join the event room
    socket.join(eventId);
  });
});

server.listen(port, () => {
  console.log("app is listening on ", port);
});
// ============== socket end here ===============

app.listen(port, () => {
  console.log("app is listening on ", port);
});

process.on("unhandledRejection", (err) => {
  console.log(err);
  // server.close(() => process.exit(0));
});
