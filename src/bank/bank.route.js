const express = require("express");
const router = express.Router();
const { auth, authRole } = require("../../middlewares/auth");

const {
  addBankDetail,
  getBankDetail,
  createCustomer,
  addBankAccountDetails,
  attachPaymentMethod,
  retrievePaymentMethod,
} = require("./bank.controller");

router.post("/create_customer", createCustomer);
router.post("/payment_method", attachPaymentMethod);
router.get("/get_payment_method", retrievePaymentMethod);
router.post("/create", addBankAccountDetails);

// Not working
router.post("/add-bank-details", addBankDetail);
router.get("/get-bank-details/:stripe_Id", getBankDetail);

module.exports = router;
