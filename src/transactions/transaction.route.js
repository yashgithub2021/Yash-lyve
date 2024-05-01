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
router.get("/:eventId", auth, getSingleTransaction);
router.put("/update/:transactionId", auth, updateTransaction);
router.delete("/delete/:transactionId", auth, deleteTransaction);

module.exports = router;
