const catchAsyncError = require("../../utils/catchAsyncError");
const { createStripeToken, addBankDetails } = require("../../utils/stripe");
const secret_key = process.env.STRIPE_SECRET_KEY;
const stripe = require('stripe')(secret_key);

exports.addBankAccount = catchAsyncError(async (req, res, next) => {
    const { country, currency, account_holder_name, account_holder_type, routing_number, account_number } = req.body;

    // Create Stripe token for bank account
    const token = await createStripeToken(country, currency, account_holder_name, account_holder_type, routing_number, account_number);

    // You can now send this token back to the client
    res.status(200).json({ token });
});

exports.addBankDetail = catchAsyncError(async (req, res, next) => {
    const { cust_Id, token } = req.body;

    // Create Stripe token for bank account
    const bank = await addBankDetails(cust_Id, token);

    // You can now send this token back to the client
    res.status(200).json({ bank });
});

exports.getBankDetail = catchAsyncError(async (req, res, next) => {
    const { stripe_Id } = req.params;

    // Create Stripe token for bank account
    const bankAccounts = await stripe.customers.listSources(stripe_Id, {
        object: 'bank_account',
        limit: 10, // Adjust as needed
    });

    // You can now send this token back to the client
    res.status(200).json({ bankAccounts });
});