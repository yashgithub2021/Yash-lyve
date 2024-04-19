const express = require("express");
const router = express.Router();
const { auth, authRole } = require("../../middlewares/auth");

const {
  // addBankDetail,
  // getBankDetail,
  // createCustomer,
  addBankAccountDetails,
  // attachPaymentMethod,
  retrievePaymentMethod,
  createSession,
  addCardDetails,
} = require("./bank.controller");

// router.post("/create_customer", createCustomer);
router.put("/create/payment-id", auth, addCardDetails);
router.post("/create-session/:eventId", auth, createSession);

router.get("/get_payment_method", retrievePaymentMethod);
router.post("/create", addBankAccountDetails);

// router.post("/payment_method", auth, attachPaymentMethod);

// Not working
// router.post("/add-bank-details", addBankDetail);
// router.get("/get-bank-details/:stripe_Id", getBankDetail);

module.exports = router;
