const express = require("express");
const router = express.Router();
const { auth } = require("../../middlewares/auth");
const { getAllNotification, getNotification, updateNotification, marKAllRead } = require("./notification.controller");

router.get("/", auth, getAllNotification);
router.put("/mark-all-as-read", auth, marKAllRead);
router.route("/:id")
  .get(auth, getNotification)
  .put(auth, updateNotification);

module.exports = router;
