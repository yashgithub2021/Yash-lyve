const express = require("express");
const router = express.Router();
const { auth } = require("../../middlewares/auth");

const {
  createSession,
  getBankAccountDetails,
  addBankAccountDetails,
  updateBankAccountDetails,
  deleteBankAccountDetails,
  cancelEvent,
  payCommissions,
} = require("./bank.controller");

router.put("/pay-commission", auth, payCommissions);

router.post("/create-session/:eventId", auth, createSession);
router.get("/get-bank-details", auth, getBankAccountDetails);
router.put("/add-bank-details", auth, addBankAccountDetails);
router.put("/update-bank-details", auth, updateBankAccountDetails);
router.put("/delete-bank-details", auth, deleteBankAccountDetails);
router.put("/cancel-event/:eventId", cancelEvent);

module.exports = router;
