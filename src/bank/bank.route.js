const express = require("express");
const router = express.Router();
const { auth, authRole } = require("../../middlewares/auth");

const {
  addBankAccount,
  addBankDetail,
  getBankDetail,
  createCustomer,
  createCard,
  createCardToken,
} = require("./bank.controller");

router.post("/create_customer", createCustomer);

router.post("/create_token", createCardToken);

router.post("/create_card", createCard);

router.post("/create", addBankAccount);
router.post("/add-bank-details", addBankDetail);
router.get("/get-bank-details/:stripe_Id", getBankDetail);

module.exports = router;
