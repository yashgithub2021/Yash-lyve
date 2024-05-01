const express = require("express");
const router = express.Router();
const { auth } = require("../../middlewares/auth");

const {
  getAllTransaction,
  getSingleTransaction,
  updateTransaction,
  deleteTransaction,
} = require("./transaction.controller");

router.get("/all_transactions", auth, getAllTransaction);
router.get("/transaction/:eventId", auth, getSingleTransaction);
router.put("/update-transaction/:transacctionId", auth, updateTransaction);
router.delete("/delete-transaction/:transactionId", auth, deleteTransaction);

module.exports = router;
