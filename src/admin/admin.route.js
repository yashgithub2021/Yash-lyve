const express = require("express");
const { auth, authRole } = require("../../middlewares/auth");
const {
  getAllUsers,
  createUser,
  getSingleUser,
  deleteUser,
  updateUser,
  register,
} = require("./admin.controller");
const {
  createGenre,
  updateGenre,
  deleteGenre,
  getAllEvents,
  getEventsWithStatus,
} = require("../events/event.controller");

const {
  createUpdateContent,
  getContent,
  deleteContent,
} = require("../content/content.controller");
const { upload } = require("../../utils/s3");

const adminRouter = express.Router();
const authAdmin = authRole(["Admin"]);

adminRouter
  .route("/content")
  .get(auth, authAdmin, getContent)
  .delete(auth, authAdmin, deleteContent)
  .post(auth, authAdmin, createUpdateContent);

adminRouter
  .route("/users")
  .get(auth, authAdmin, getAllUsers)
  .post(upload.single("image"), auth, authAdmin, createUser);

adminRouter
  .route("/users/:id")
  .get(auth, authAdmin, getSingleUser)
  .delete(auth, authAdmin, deleteUser)
  .put(auth, authAdmin, updateUser);

adminRouter.post("/register", register);

adminRouter
  .route("/genre")
  .post(upload.single("thumbnail"), auth, authAdmin, createGenre);

adminRouter
  .route("/genre/:id")
  .put(upload.single("thumbnail"), auth, authAdmin, updateGenre);

adminRouter.route("/genre/:id").delete(auth, authAdmin, deleteGenre);

adminRouter.route("/get-events").get(auth, authAdmin, getAllEvents);

adminRouter
  .route("/get-event-status")
  .get(auth, authAdmin, getEventsWithStatus);

module.exports = adminRouter;
