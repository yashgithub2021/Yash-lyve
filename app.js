const express = require("express");
const cors = require("cors");
const errorMiddleware = require("./middlewares/error");
const dotenv = require("dotenv");
const app = express();

const path = "./config/config.env";
// const path = "./config/live.env";
dotenv.config({ path });

const { router } = require("./utils/stripe");

app.use(router);
app.use(express.json());
app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "DELETE", "UPDATE", "PUT", "PATCH"],
    credentials: true,
  })
);

app.get("/", (req, res, next) => res.json({ message: "Server is running" }));

//use all router here
const {
  userRoute,
  eventRouter,
  adminRouter,
  wishlistRoute,
  contentRoute,
  notificationRoute,
  subscriptionRoute,
  transactionRoute,
  bankRoute,
  contactRoute,
} = require("./src");
const { croneJob } = require("./src/bank/bank.controller");
const { cronJobs } = require("./utils/cronjobs");

app.use("/api/users", userRoute);
app.use("/api/events", eventRouter);
app.use("/api/admin", adminRouter);
app.use("/api/post", wishlistRoute);
app.use("/api/content", contentRoute);
app.use("/api/notification", notificationRoute);
app.use("/api/bank", bankRoute);
app.use("/api/subscription", subscriptionRoute);
app.use("/api/transaction", transactionRoute);
app.use("/api/contact", contactRoute);

app.all("*", async (req, res) => {
  res.status(404).json({
    error: {
      message: "Not Found. Kindly Check the API path as well as request type",
    },
  });
});

croneJob();
cronJobs();

app.use(errorMiddleware);

module.exports = app;
