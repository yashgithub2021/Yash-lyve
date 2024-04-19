const express = require("express");
const router = express.Router();
const { auth } = require("../../middlewares/auth");

const {
  createSubscription,
  getSubscription,
} = require("./subscription.controller");

router.post("/:eventId/:sessionId", auth, createSubscription);
router.get("/:subscriptionId", auth, getSubscription);

module.exports = router;
