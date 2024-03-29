const express = require("express");
const router = express.Router();
const { auth } = require("../../middlewares/auth");
const {
  register,
  login,
  forgotPassword,
  verifyOtp,
  updatePassword,
  getProfile,
  verifyRegisterOTP,
  updateProfile,
  followCreator,
  unfollowCreator,
  getCreatorFollowers,
  deleteUser,
  resendOTP,
  getCreatorFollowing,
  getSuggestedUsers
} = require("./user.controller");
const { user } = require("../../middlewares/validate");
const { upload } = require("../../utils/s3");

router.post("/register", upload.single("image"), user.post, register);
router.post("/verify-registerOtp", verifyRegisterOTP);
router.post("/login", user.login, login);
router.put("/resend-otp", resendOTP);
router.post("/forgot-password", forgotPassword);
router.post("/verify-otp", verifyOtp);
router.put("/change-password", user.updatePassword, auth, updatePassword);
router.put("/reset-password", user.updatePassword, updatePassword);
router.route("/profile").get(auth, getProfile).put(upload.single("image"), auth, updateProfile);
router.delete("/delete", auth, deleteUser);

//=================================Follow Stuff =====================================================
router.post("/follow/:creatorId", auth, followCreator);
router.delete("/unfollow/:creatorId", auth, unfollowCreator);
router.get("/followers", auth, getCreatorFollowers);
router.get("/following", auth, getCreatorFollowing);
router.get("/suggested-users", auth, getSuggestedUsers);

module.exports = router;
