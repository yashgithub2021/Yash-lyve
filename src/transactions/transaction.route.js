const express = require("express");
const router = express.Router();
const { auth } = require("../../middlewares/auth");

const {
  // getAllTransaction,
  getSingleTransaction,
  payoutSettlements,
  payoutTransactions,
} = require("./transaction.controller");

// router.get("/all_transactions", auth, getAllTransaction);
router.get("/payout-settlements", auth, payoutSettlements);
router.get("/payout-transactions", auth, payoutTransactions);
router.get("/:eventId", auth, getSingleTransaction);

module.exports = router;
