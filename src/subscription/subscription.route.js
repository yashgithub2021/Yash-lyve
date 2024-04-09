const express = require("express");
const router = express.Router();
const { auth, authRole } = require("../../middlewares/auth");

const { createSubscription } = require("./subscription.controller");

router.post("/:eventId/create", auth, createSubscription);

module.exports = router;
