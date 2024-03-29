const { likeEvent, wishlistEvent, dislikeEvent } = require("./wishlist.controller");
const { auth } = require("../../middlewares/auth");
const express = require("express");
const router = express.Router();

router.post("/:eventId/like", auth, likeEvent)
router.post("/:eventId/dislike", auth, dislikeEvent)
router.post("/:eventId/wishlist", auth, wishlistEvent)

module.exports = router;
