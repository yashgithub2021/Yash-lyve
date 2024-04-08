const express = require("express");
const router = express.Router();
const { auth, authRole } = require("../../middlewares/auth");

const { addBankAccount, addBankDetail, getBankDetail } = require("./bank.controller")

router.post("/create", addBankAccount)
router.post("/add-bank-details", addBankDetail)
router.get("/get-bank-details/:stripe_Id", getBankDetail)

module.exports = router;
