const catchAsyncError = require("../../utils/catchAsyncError");
const { createStripeToken, addBankDetails } = require("../../utils/stripe");
const secret_key = process.env.STRIPE_SECRET_KEY;
const stripe = require("stripe")(secret_key);

exports.createCustomer = catchAsyncError(async (req, res, next) => {
  const { name, email } = req.body;

  const customer = await stripe.customers.create({
    name,
    email,
  });

  console.log(customer);

  res.status(200).json({ customer });
});

exports.createCardToken = catchAsyncError(async (req, res, next) => {
  const { cardNumber, expMonth, expYear, cvc } = req.body;

  const card = {
    number: cardNumber,
    exp_month: expMonth,
    exp_year: expYear,
    cvc: cvc,
  };

  const token = await stripe.tokens.create({
    card,
  });

  res.status(200).json({ token });
});

exports.createCard = catchAsyncError(async (req, res, next) => {
  //   const { card_number, exp_month, exp_year, cvc } = req.body;

  const paymentMethod = await stripe.paymentMethods.create({
    type: "card",
    card: {
      number: "4242424242424242",
      exp_month: 8,
      exp_year: 2026,
      cvc: "314",
    },
  });

  //   const {customerId} = req.params
  //   await stripe.paymentMethods.attach()

  console.log(paymentMethod);

  res.status(200).json({ paymentMethod });
});

//generate token
exports.addBankAccount = catchAsyncError(async (req, res, next) => {
  const {
    // country,
    // currency,
    // account_holder_name,
    // account_holder_type,
    // routing_number,
    // account_number,
    number,
    exp_month,
    exp_year,
    cvc,
  } = req.body;

  // Create Stripe token for bank account
  const token = await createStripeToken(number, exp_month, exp_year, cvc);
  // country,
  // currency,
  // account_holder_name,
  // account_holder_type,
  // routing_number,
  // account_number

  // You can now send this token back to the client
  res.status(200).json({ token });
});

// for identify whos card with custmer id and source token
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
