const express = require("express");
const router = express.Router();
const { auth, authRole } = require("../../middlewares/auth");

const {
  // getBankDetail,
  addBankAccountDetails,
  // attachPaymentMethod,
  retrievePaymentMethod,
  createSession,
  addCardDetails,
} = require("./bank.controller");

router.put("/create/payment-id", auth, addCardDetails);
router.post("/create-session/:eventId", auth, createSession);
router.post("/add-bank-details", auth, addBankAccountDetails);
router.get("/get_payment_method", auth, retrievePaymentMethod);

// router.post("/payment_method", auth, attachPaymentMethod);

// Not working
// router.get("/get-bank-details/:stripe_Id", getBankDetail);

module.exports = router;
