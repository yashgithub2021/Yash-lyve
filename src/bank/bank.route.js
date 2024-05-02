const express = require("express");
const router = express.Router();
const { auth } = require("../../middlewares/auth");

const {
  createSession,
  addBankAccountDetails,
  updateBankAccountDetails,
  deleteBankAccountDetails,
  cancelEvent,
} = require("./bank.controller");

router.post("/create-session/:eventId", auth, createSession);
router.put("/add-bank-details", auth, addBankAccountDetails);
router.put("/update-bank-details", auth, updateBankAccountDetails);
router.put("/delete-bank-details", auth, deleteBankAccountDetails);
router.put("/cancel-event/:eventId", auth, cancelEvent);

module.exports = router;
