const express = require("express");
const router = express.Router();
const { auth } = require("../../middlewares/auth");
const { getAllNotification, getNotification, updateNotification, marKAllRead, deleteNotification, deleteAllNotifications } = require("./notification.controller");

router.get("/", auth, getAllNotification);
router.put("/mark-all-as-read", auth, marKAllRead);
router.delete("/delete/:id", auth, deleteNotification);
router.delete("/delete/", auth, deleteAllNotifications);
router.route("/:id")
  .get(auth, getNotification)
  .put(auth, updateNotification);

module.exports = router;
