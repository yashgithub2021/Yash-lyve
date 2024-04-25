const express = require("express");
const router = express.Router();
const { auth } = require("../../middlewares/auth");

const {
  createSession,
  addCard,
  addBankAccountDetails,
  updateBankAccountDetails,
  deleteBankAccountDetails,
  deleteCard,
  updateCard,
  totalCharges,
} = require("./bank.controller");

router.put("/add-card", auth, addCard);
router.put("/update-card", auth, updateCard);
router.put("/delete-card", auth, deleteCard);
router.post("/create-session/:eventId", auth, createSession);
router.put("/add-bank-details", auth, addBankAccountDetails);
router.put("/update-bank-details", auth, updateBankAccountDetails);
router.put("/delete-bank-details", auth, deleteBankAccountDetails);
router.get("/get-charge", totalCharges);

module.exports = router;
