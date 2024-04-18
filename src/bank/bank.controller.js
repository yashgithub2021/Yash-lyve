const catchAsyncError = require("../../utils/catchAsyncError");
const { createStripeToken, addBankDetails } = require("../../utils/stripe");
const secret_key = process.env.STRIPE_SECRET_KEY;
const stripe = require("stripe")(secret_key);

// create customer
exports.createCustomer = catchAsyncError(async (req, res, next) => {
  const { name, email } = req.body;

  const customer = await stripe.customers.create({
    name,
    email,
  });

  console.log(customer);

  res.status(200).json({ customer });
});

// attach card with customer
exports.attachPaymentMethod = catchAsyncError(async (req, res, next) => {
  const { paymentMethodId, customerId } = req.body;

  const paymentMethod = await stripe.paymentMethods.attach(paymentMethodId, {
    customer: customerId,
  });

  console.log(paymentMethod);

  res.status(200).json({ success: true, paymentMethod });
});

// Retrieve payment method
exports.retrievePaymentMethod = catchAsyncError(async (req, res, next) => {
  const { paymentMethodId } = req.body;

  const paymentMethod = await stripe.paymentMethods.retrieve(paymentMethodId);

  console.log(paymentMethod);

  res.status(200).json({ success: true, paymentMethod });
});

// Add bank details
exports.addBankAccountDetails = catchAsyncError(async (req, res, next) => {
  const {
    customerId,
    country,
    currency,
    account_holder_name,
    account_holder_type,
    routing_number,
    account_number,
  } = req.body;

  const paymentMethod = await stripe.customers.createSource(customerId, {
    bank_account: {
      object: "bank_account",
      account_holder_name: account_holder_name,
      account_holder_type: account_holder_type,
      account_number: account_number,
      routing_number: routing_number,
      country: country,
      currency: currency,
    },
  });

  // Create Stripe token for bank account
  // const token = await createStripeToken(
  //   country,
  //   currency,
  //   account_holder_name,
  //   account_holder_type,
  //   routing_number,
  //   account_number
  // );

  // You can now send this token back to the client
  res.status(200).json({ success: true, paymentMethod });
});

// This routes are not working
exports.createToken = catchAsyncError(async (req, res, next) => {
  const { customerId, token } = req.params;

  const customer = await stripe.customers.createSource(customerId, {
    source: token,
  });

  console.log(customer);

  res.status(200).json({ customer });
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
    object: "bank_account",
    limit: 10, // Adjust as needed
  });

  // You can now send this token back to the client
  res.status(200).json({ bankAccounts });
});
