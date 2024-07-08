const express = require("express");
const router = express.Router();
const { auth } = require("../../middlewares/auth");

const {
  getSingleTransaction,
  payoutSettlements,
  payoutTransactions,
} = require("./transaction.controller");

router.get("/payout-settlements", auth, payoutSettlements);
router.get("/payout-transactions", auth, payoutTransactions);
router.get("/:eventId", auth, getSingleTransaction);

module.exports = router;
