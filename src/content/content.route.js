const express = require("express");
const router = express.Router();
const { auth, authRole } = require("../../middlewares/auth");
const { getTT, getPP } = require("./content.controller");

router.get("/terms_and_conditions", getTT);
router.get("/privacy_policy", getPP);
// router.get("/about_us", getAboutUs);
// router.get("/contact_us", getContactUs);

module.exports = router;
