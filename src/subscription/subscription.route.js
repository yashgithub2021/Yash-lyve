const express = require("express");
const router = express.Router();
const { auth } = require("../../middlewares/auth");

const {
  createSession,
  createSubscription,
  getSubscription,
} = require("./subscription.controller");

router.post("/:eventId/create", auth, createSession);
router.post("/:eventId/:wishlistId/:sessionId", auth, createSubscription);
router.get("/:subscriptionId", auth, getSubscription);

module.exports = router;
