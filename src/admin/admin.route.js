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
} = require("../events/event.controller");
const { upload } = require("../../utils/s3");

const adminRouter = express.Router();
const authAdmin = authRole(["Admin"]);

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

adminRouter.route("/genre").post(upload.single("thumbnail"), auth, authAdmin, createGenre);


module.exports = adminRouter;
