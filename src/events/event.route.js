const express = require("express");
const router = express.Router();
const { auth } = require("../../middlewares/auth");
const { upload } = require("../../utils/s3");
const {
  createEvent,
  deleteEvent,
  getUpcomingEvents,
  getRecommendedEvents,
  getEvents,
  getFollowingEvents,
  getGenres,
  getSingleGenre,
  getMyUpcomingEvents,
  globalSearch,
  getUserEvents,
  getStreamedDetails,
  updateEvent,
  getSingleEvent,
  goLiveEvent,
} = require("./event.controller");

router.post("/create", upload.single("thumbnail"), auth, createEvent);

router.delete("/delete/:eventId", auth, deleteEvent);

router.put("/update/:eventId", upload.single("thumbnail"), auth, updateEvent);

router.get("/get-events", auth, getEvents);

router.get("/get-event/:eventId", auth, getSingleEvent);

router.get("/get-genre", auth, getGenres);

router.get("/:genreId/get-genre", auth, getSingleGenre);

router.get("/get-following-events", auth, getFollowingEvents);

router.get("/global-search", auth, globalSearch);

router.get("/my-upcoming-events", auth, getMyUpcomingEvents);

router.get("/user-events/:userId", auth, getUserEvents);

router.get("/stream-details/:eventId", auth, getStreamedDetails);

router.route("/recommended-events").get(auth, getRecommendedEvents);

router.get("/get-upcoming-events", auth, getUpcomingEvents);

router.get("/go-live-event/:eventId", auth, goLiveEvent);

module.exports = router;
