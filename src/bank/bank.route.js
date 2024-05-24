const express = require("express");
const router = express.Router();
const { auth } = require("../../middlewares/auth");

const {
  createSession,
  getBankAccountDetails,
  addBankAccountDetails,
  deleteBankAccountDetails,
  loginLink,
  addPrimaryBank,
} = require("./bank.controller");

const { cancelEvent } = require("../events/event.controller");

router.post("/create-session/:eventId", auth, createSession);
router.get("/get-bank-details", auth, getBankAccountDetails);
router.put("/add-bank-details", auth, addBankAccountDetails);
router.put("/add-primary-bank", auth, addPrimaryBank);
router.put("/delete-bank-details", auth, deleteBankAccountDetails);
router.post("/login-link", auth, loginLink);
router.put("/cancel-event/:eventId", auth, cancelEvent);

module.exports = router;
