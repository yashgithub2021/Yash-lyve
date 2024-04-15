const app = require("./app");
const { connectDatabase } = require("./config/database");
// const http = require("http");

process.on("uncaughtException", (err) => {
  console.log(err);
  // process.exit(0);
});

// connecting database
console.log("Connecting database");
connectDatabase();

// creating server
const port = process.env.PORT || 5000;

app.listen(port, () => {
  console.log("app is listening on ", port);
});

process.on("unhandledRejection", (err) => {
  console.log(err);
  // server.close(() => process.exit(0));
});

// const http = require("http").Server(app);
// // const server = http.createServer();
// const io = require("socket.io")(http, {
//   cors: {
//     origin: "*",
//     credentials: true,
//   },
// });

// io.on("connect", (socket) => {
//   console.log("A client connected");

//   socket.on("join", async (data) => {
//     console.log("Client joined room:", data.auctionId);
//     socket.join(data.auctionId);
//   });

//   socket.on("disconnect", async () => {
//     console.log("A client disconnected");
//   });
// });
