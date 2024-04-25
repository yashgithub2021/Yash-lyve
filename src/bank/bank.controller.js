const catchAsyncError = require("../../utils/catchAsyncError");
const { StatusCodes } = require("http-status-codes");
const { eventModel } = require("../events/event.model");
const { userModel } = require("../user");
const Transaction = require("../transactions/transaction.model");
const ErrorHandler = require("../../utils/errorHandler");
// const secret_key = process.env.STRIPE_SECRET_KEY;
// const stripe = require("stripe")(secret_key);
const {
  createPaymentIntent,
  addBankDetails,
  deleteBankDetails,
  updateBankAccount,
  addCardDetails,
  deleteCardDetails,
  updateCardDetails,
  payCommission,
} = require("../../utils/stripe");

// Create payment intent for generating client secret "Checked"
exports.createSession = catchAsyncError(async (req, res, next) => {
  const { userId } = req;
  const { eventId } = req.params;

  const user = await userModel.findByPk(userId);
  const event = await eventModel.findByPk(eventId, {
    include: {
      model: userModel,
      as: "creator",
      attributes: ["id", "username", "bank_account_id"],
    },
  });

  if (!event)
    return next(new ErrorHandler("Event not found", StatusCodes.NOT_FOUND));

  //Getting stripe session
  const stripe = await createPaymentIntent(event, user);

  if (!stripe) {
    return next(new ErrorHandler("Session not found", StatusCodes.NOT_FOUND));
  }

  res.status(StatusCodes.CREATED).json({ success: true, stripe });
});

// ================== Add Card methods ======================

// Update payment Id and add card details on stripe "Checked"
exports.addCard = catchAsyncError(async (req, res, next) => {
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

  if (payment_methodId) updateData.payment_method_id = payment_methodId;

  await user.update(updateData);

  const payment_method_id = await addCardDetails(
    user.payment_method_id,
    user.customerId
  );

  res.status(StatusCodes.OK).json({
    success: true,
    message: "Card added Successfully",
    payment_method_id,
  });
});

// Update payment Id and update card details on stripe "checked"
exports.updateCard = catchAsyncError(async (req, res, next) => {
  const { userId } = req;
  const {
    name,
    email,
    address_line1,
    address_line2,
    address_city,
    address_state,
    address_postal_code,
    address_country,
    exp_month,
    exp_year,
  } = req.body;

  const user = await userModel.findByPk(userId);

  if (!user) {
    return next(new ErrorHandler("User not found", StatusCodes.NOT_FOUND));
  }

  const payment_method_id = await updateCardDetails(
    user.payment_method_id,
    name,
    email,
    address_line1,
    address_line2,
    address_city,
    address_state,
    address_postal_code,
    address_country,
    exp_month,
    exp_year
  );

  let updateData = {};

  if (payment_method_id) updateData.payment_method_id = payment_method_id;

  await user.update(updateData);

  res.status(StatusCodes.OK).json({
    success: true,
    message: "Card updated Successfully",
    payment_method_id,
  });
});

// Update payment Id and delete card details on stripe "Checked"
exports.deleteCard = catchAsyncError(async (req, res, next) => {
  const { userId } = req;

  const user = await userModel.findByPk(userId);

  if (!user) {
    return next(new ErrorHandler("User not found", StatusCodes.NOT_FOUND));
  }

  const { payment_method_id } = user;

  const card = await deleteCardDetails(payment_method_id);

  let updateData = {};

  if (card.id) updateData.payment_method_id = null;

  await user.update(updateData);

  res.status(StatusCodes.OK).json({
    success: true,
    message: "Card deleted Successfully",
    deleted: card.id,
  });
});

// ================== Add Bank methods ======================

// Add bank details and verifying account if not verified then bank account will be deleted "Checked"
exports.addBankAccountDetails = catchAsyncError(async (req, res, next) => {
  const { userId } = req;

  const user = await userModel.findByPk(userId);

  if (!user) {
    return next(new ErrorHandler("User not found", StatusCodes.NOT_FOUND));
  }

  const { email } = user;

  const {
    country,
    currency,
    account_holder_name,
    account_holder_type,
    routing_number,
    account_number,
  } = req.body;

  const accountId = await addBankDetails(
    country,
    currency,
    account_holder_name,
    account_holder_type,
    routing_number,
    account_number,
    email
  );

  let updateData = {};

  if (accountId) updateData.bank_account_id = accountId;

  await user.update(updateData);

  res.status(200).json({ success: true, accountId });
});

// Update bank details
exports.updateBankAccountDetails = catchAsyncError(async (req, res, next) => {
  const { userId } = req;

  const user = await userModel.findByPk(userId);

  if (!user) {
    return next(new ErrorHandler("User not found", StatusCodes.NOT_FOUND));
  }

  const { customerId, bank_account_id } = user;

  const updatedAccount = await updateBankAccount(customerId, bank_account_id);

  res.status(200).json({ success: true, updatedAccount });
});

// delete bank details "Checked"
exports.deleteBankAccountDetails = catchAsyncError(async (req, res, next) => {
  const { userId } = req;

  const user = await userModel.findByPk(userId);

  if (!user) {
    return next(new ErrorHandler("User not found", StatusCodes.NOT_FOUND));
  }

  const { customerId, bank_account_id } = user;

  const deleteAccount = await deleteBankDetails(customerId, bank_account_id);

  // let updatedData = {};

  // if (deleteAccount.deleted) {
  //   updatedData.bank_account_id = null;
  // }
  // await user.update(updatedData);

  res.status(200).json({ success: true, deleteAccount: deleteAccount });
});

// Pay commission 60% of the total amount
exports.totalCharges = catchAsyncError(async (req, res, next) => {
  // const { eventId } = req.params;

  // const transactions = await Transaction.findAll({
  //   where: { payment_status: "paid" },
  //   include: [
  //     {
  //       model: userModel,
  //       as: "user",
  //       attributes: ["id", "username", "avatar", "bank_account_id"],
  //     },
  //     {
  //       model: eventModel,
  //       as: "event",
  //       attributes: ["id", "title", "thumbnail"],
  //     },
  //   ],
  // });

  // if (!transactions) {
  //   return next(
  //     new ErrorHandler("Transaction not found", StatusCodes.NOT_FOUND)
  //   );
  // }

  // let totalAmount = 0;

  // transactions.forEach((transaction) => {
  //   totalAmount += transaction.payment_amount;
  // });

  // const calculatedPercentage = calculate60Percent(totalAmount);
  const amount = await payCommission();
  // calculatedPercentage,
  // transactions[0].bank_account_id

  res.status(200).json({ success: true, amount });
});

// Function for calculating 60% of the total amount
function calculate60Percent(totalAmount) {
  // Ensure totalAmount is a valid number
  if (typeof totalAmount !== "number" || isNaN(totalAmount)) {
    throw new Error("Total amount must be a valid number.");
  }

  // Calculate 60% of the total amount
  const sixtyPercent = totalAmount * 0.6;

  // Round to 2 decimal places (optional)
  const roundedSixtyPercent = Math.round(sixtyPercent * 100) / 100;

  return roundedSixtyPercent;
}
