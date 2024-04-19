const catchAsyncError = require("../../utils/catchAsyncError");
const { StatusCodes } = require("http-status-codes");
const { eventModel } = require("../events/event.model");
const { userModel } = require("../user");
const { createStripeToken, addBankDetails } = require("../../utils/stripe");
const ErrorHandler = require("../../utils/errorHandler");
const secret_key = process.env.STRIPE_SECRET_KEY;
const stripe = require("stripe")(secret_key);

const { createCheckout, captureStripePayment } = require("../../utils/stripe");

// Create session for generating session id and url for payment
exports.createSession = catchAsyncError(async (req, res, next) => {
  const { userId } = req;
  const { eventId } = req.params;

  const user = await userModel.findByPk(userId);
  const event = await eventModel.findByPk(eventId);

  if (!event)
    return next(new ErrorHandler("Event not found", StatusCodes.NOT_FOUND));

  //Getting stipe session
  const stripe = await createCheckout(event, user);

  if (!stripe) {
    return next(new ErrorHandler("Session not found", StatusCodes.NOT_FOUND));
  }

  res.status(StatusCodes.CREATED).json({ sessionURL: stripe });
});

// Update payment Id and add card details on stripe
exports.addCardDetails = catchAsyncError(async (req, res, next) => {
  const { userId } = req;
  const { payment_methodId } = req.body;

  if (!payment_methodId) {
    return next(
      new ErrorHandler("Payment method Id not found", StatusCodes.NOT_FOUND)
    );
  }

  const user = await userModel.findByPk(userId);

  if (!user) {
    return next(new ErrorHandler("User not found", StatusCodes.NOT_FOUND));
  }

  let updateData = {};

  if (payment_methodId) updateData.payment_methodId = payment_methodId;

  await user.update(updateData);

  const payment_method_id = await createPaymentMethod(
    user.payment_methodId,
    user.customerId
  );

  res.status(StatusCodes.OK).json({
    success: true,
    message: "Payment method added Successfully",
    payment_method_id,
  });
});

// Add bank details
exports.addBankAccountDetails = catchAsyncError(async (req, res, next) => {
  const { userId } = req;

  const user = await userModel.findByPk(userId);

  if (!user) {
    return next(new ErrorHandler("User not found", StatusCodes.NOT_FOUND));
  }

  const { customerId } = user;

  const {
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

  res.status(200).json({ success: true, paymentMethod });
});

// Retrieve payment method
exports.retrievePaymentMethod = catchAsyncError(async (req, res, next) => {
  const { paymentMethodId } = req.body;

  const paymentMethod = await stripe.paymentMethods.retrieve(paymentMethodId);

  console.log(paymentMethod);

  res.status(200).json({ success: true, paymentMethod });
});

// attach card with customer
// exports.attachPaymentMethod = catchAsyncError(async (req, res, next) => {
//   const { paymentMethodId, customerId } = req.body;

//   const paymentMethod = await stripe.paymentMethods.attach(paymentMethodId, {
//     customer: customerId,
//   });

//   console.log(paymentMethod);

//   res.status(200).json({ success: true, paymentMethod });
// });

// exports.addBankDetail = catchAsyncError(async (req, res, next) => {
//   const { cust_Id, token } = req.body;

//   // Create Stripe token for bank account
//   const bank = await addBankDetails(cust_Id, token);

//   // You can now send this token back to the client
//   res.status(200).json({ bank });
// });

// exports.getBankDetail = catchAsyncError(async (req, res, next) => {
//   const { stripe_Id } = req.params;

//   // Create Stripe token for bank account
//   const bankAccounts = await stripe.customers.listSources(stripe_Id, {
//     object: "bank_account",
//     limit: 10, // Adjust as needed
//   });

//   // You can now send this token back to the client
//   res.status(200).json({ bankAccounts });
// });
