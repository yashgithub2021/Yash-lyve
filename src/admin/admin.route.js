const express = require("express");
const { auth, authRole } = require("../../middlewares/auth");
const {
  getAllUsers,
  createUser,
  getSingleUser,
  deleteUser,
  updateUser,
  register,
  updateAdminProfile,
  getDashboardData,
  deleteAdmin,
} = require("./admin.controller");
const {
  createGenre,
  updateGenre,
  deleteGenre,
  getEvents,
  getAllEvents,
  getEventsWithStatus,
  getSingleEvent,
  adminUpdateEvent,
} = require("../events/event.controller");

const {
  createUpdateTNC,
  getContent,
  deleteContent,
} = require("../content/content.controller");
const { upload } = require("../../utils/s3");

const adminRouter = express.Router();
const authAdmin = authRole(["Admin"]);

// Admin dashboard
adminRouter.get("/dashboard", auth, authAdmin, getDashboardData);

// Admin content routes
adminRouter
  .route("/content")
  .get(getContent)
  .delete(auth, authAdmin, deleteContent)
  .post(auth, authAdmin, createUpdateTNC);

// Admin User routes
adminRouter
  .route("/users")
  .get(auth, authAdmin, getAllUsers)
  .post(upload.single("image"), auth, authAdmin, createUser);
adminRouter
  .route("/users/:id")
  .get(auth, authAdmin, getSingleUser)
  .delete(auth, authAdmin, deleteUser)
  .put(upload.single("image"), auth, authAdmin, updateUser);

// Admin routes
adminRouter.post("/register", register);
adminRouter.put(
  "/updateAdmin",
  upload.single("image"),
  auth,
  authAdmin,
  updateAdminProfile
);
adminRouter.post("/delete", deleteAdmin);

// Admin Genre routes
adminRouter
  .route("/genre")
  .post(upload.single("thumbnail"), auth, authAdmin, createGenre);
adminRouter
  .route("/genre/:id")
  .put(upload.single("thumbnail"), auth, authAdmin, updateGenre);
adminRouter.route("/genre/:genreId").delete(auth, authAdmin, deleteGenre);

// Admin Event routes
adminRouter.route("/get-events").get(auth, authAdmin, getAllEvents);
adminRouter.route("/get_event").get(auth, authAdmin, getSingleEvent);
adminRouter
  .route("/update/:eventId")
  .put(upload.single("thumbnail"), auth, authAdmin, adminUpdateEvent);
adminRouter
  .route("/get-event-status")
  .get(auth, authAdmin, getEventsWithStatus);

module.exports = adminRouter;
