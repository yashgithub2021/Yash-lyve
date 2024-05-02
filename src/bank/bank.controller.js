const catchAsyncError = require("../../utils/catchAsyncError");
const { StatusCodes } = require("http-status-codes");
const { eventModel } = require("../events/event.model");
const { userModel } = require("../user");
const Transaction = require("../transactions/transaction.model");
const ErrorHandler = require("../../utils/errorHandler");
const cron = require("node-cron");

const {
  createPaymentIntent,
  addBankDetails,
  deleteBankDetails,
  updateBankAccount,
  payCommission,
  getPaymentIntentsByCustomer,
  payRefund,
} = require("../../utils/stripe");

// ================= Create payment intent ==================
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

  // console.log("eventrer", event.creator);

  //Getting stripe session
  const stripe = await createPaymentIntent(event, user);

  if (!stripe) {
    return next(new ErrorHandler("Session not found", StatusCodes.NOT_FOUND));
  }

  res.status(StatusCodes.CREATED).json({ success: true, stripe });
});

// ================== Add Bank methods ======================

// Add bank details and verifying account if not verified then bank account will be deleted "Checked"
exports.addBankAccountDetails = catchAsyncError(async (req, res, next) => {
  const { userId } = req;

  const user = await userModel.findByPk(userId);

  if (!user) {
    return next(new ErrorHandler("User not found", StatusCodes.NOT_FOUND));
  }

  const { email, username, dob } = user;

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
    email,
    username,
    dob
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
const task = cron.schedule("*/10 * * * * *", async () => {
  const arr = {};
  try {
    const transactions = await Transaction.findAll({
      where: { payment_status: "paid" },
      include: [
        {
          model: userModel,
          as: "user",
          attributes: ["id", "username", "avatar", "bank_account_id"],
        },
        {
          model: eventModel,
          as: "event",
          attributes: ["id", "title", "thumbnail"],
        },
      ],
    });

    if (!transactions) {
      return next(
        new ErrorHandler("Transaction not found", StatusCodes.NOT_FOUND)
      );
    }

    for (let transaction of transactions) {
      if (!transaction.charge) {
        if (arr[transaction.eventId]) {
          arr[transaction.eventId]["amount"] += transaction.payment_amount;
        } else {
          arr[transaction.eventId] = {};
          arr[transaction.eventId]["amount"] = transaction.payment_amount;
          arr[transaction.eventId]["bank_account_id"] =
            transaction.bank_account_id;
        }
      }
    }

    // calculating 60% of the total amount and making transfer to the bank
    for (let obj in arr) {
      const calculatedPercentage = calculate60Percent(arr[obj].amount);

      const amount = await payCommission(
        calculatedPercentage,
        arr[obj].bank_account_id
      );
      console.log("ammtttt", amount);
      // updating the charge field
      if (amount.id) {
        await Transaction.update(
          {
            charge: "success",
          },
          { where: { eventId: obj } }
        );
      }
    }
  } catch (error) {
    console.log(error);
    throw new Error(error.message);
  }
});

// task.start();
task.stop();

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

// Added cancel event route
exports.cancelEvent = catchAsyncError(async (req, res, next) => {
  const { eventId } = req.params;
  const { userId } = req;

  const event = await eventModel.findByPk(eventId);

  if (!event) {
    return res
      .status(StatusCodes.NOT_FOUND)
      .json({ message: "Event not found" });
  }

  // Check if the current user is the creator of the event
  if (event.userId !== userId) {
    return res
      .status(StatusCodes.FORBIDDEN)
      .json({ message: "You are not authorized to cancel this event" });
  }

  // Check if the event start time is more than 24 hours in the future
  const eventStartTime = new Date(event.event_date).getTime();
  const currentTime = new Date().getTime();
  const twentyFourHoursInMilliseconds = 24 * 60 * 60 * 1000;

  if (eventStartTime - currentTime <= twentyFourHoursInMilliseconds) {
    return res.status(StatusCodes.BAD_REQUEST).json({
      message: "Event cannot be canceled within 24 hours of start time",
    });
  }

  // Update event fields
  let updateData = {};

  // Example: Update other fields
  const { status } = req.body;

  if (status) updateData.status = status;

  // Update the event
  await event.update(updateData);

  res
    .status(StatusCodes.OK)
    .json({ success: true, message: "Event cancelled successfully", event });

  // refundAmount(event.id, next);
});

const refundAmount = async (eventId, next) => {
  const transactions = await Transaction.findAll({
    where: { eventId: eventId },
  });

  if (!transactions) {
    return next(new ErrorHandler("Event not found", StatusCodes.NOT_FOUND));
  }

  console.log(transactions);

  const arr = {};

  for (let transaction of transactions) {
    if (transaction.charge === "succeeded") {
      if (arr[transaction.eventId]) {
        arr[transaction.eventId]["customers"] = [];
        arr[transaction.eventId]["customers"].push(transactions.customerId);
      }
    }
  }

  for (let obj in arr) {
    const paymentIntents = await getPaymentIntentsByCustomer(
      arr[obj].customers
    );

    if (amount.id) {
      await Transaction.update(
        {
          charge: "success",
        },
        { where: { eventId: obj } }
      );
    }
  }

  console.log(arr);
};
