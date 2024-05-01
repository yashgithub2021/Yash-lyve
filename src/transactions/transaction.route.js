const express = require("express");
const router = express.Router();
const { auth } = require("../../middlewares/auth");

const {
  getAllTransaction,
  getSingleTransaction,
} = require("./transaction.controller");

router.get("/all_transactions", auth, getAllTransaction);
router.get("/:eventId", auth, getSingleTransaction);

module.exports = router;
