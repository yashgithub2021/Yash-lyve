const express = require("express");
const router = express.Router();
const { auth } = require("../../middlewares/auth");

const {
  createTransaction,
  getAllTransaction,
  getSingleTransaction,
  updateTransaction,
  deleteTransaction,
} = require("./transaction.controller");

router.post("/create", auth, createTransaction);
router.get("/transaction", auth, getAllTransaction);
router.get("/single_transaction", auth, getSingleTransaction);
router.put("/update_transaction", auth, updateTransaction);
router.delete("/delete_transaction", auth, deleteTransaction);

module.exports = router;
