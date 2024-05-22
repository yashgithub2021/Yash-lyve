const express = require("express");
const router = express.Router();
const { getTT, getPP } = require("./content.controller");

router.get("/terms_and_conditions", getTT);
router.get("/privacy_policy", getPP);

module.exports = router;
