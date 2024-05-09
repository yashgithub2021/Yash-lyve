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
  getBankDetails,
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

// Add bank details
exports.addBankAccountDetails = catchAsyncError(async (req, res, next) => {
  const { userId } = req;

  const user = await userModel.findByPk(userId);

  if (!user) {
    return next(new ErrorHandler("User not found", StatusCodes.NOT_FOUND));
  }

  const { email, username, dob, customerId, bank_account_id } = user;

  const {
    country,
    currency,
    account_holder_name,
    account_holder_type,
    routing_number,
    account_number,
  } = req.body;

  const account = await addBankDetails(
    country,
    currency,
    account_holder_name,
    account_holder_type,
    routing_number,
    account_number,
    email,
    customerId,
    username,
    dob
  );

  let updateData = {};

  if (account) updateData.bank_account_id = account.accountId;

  await user.update(updateData);

  res.status(200).json({ success: true, account });
});

// Add bank details
exports.getBankAccountDetails = catchAsyncError(async (req, res, next) => {
  const { userId } = req;

  const user = await userModel.findByPk(userId);

  if (!user) {
    return next(new ErrorHandler("User not found", StatusCodes.NOT_FOUND));
  }

  const { bank_account_id } = user;

  if (!bank_account_id) {
    return next(
      new ErrorHandler("No bank account found", StatusCodes.NOT_FOUND)
    );
  }

  const bankDetails = await getBankDetails(bank_account_id);

  const accountDetails = {
    bankName: bankDetails.external_accounts.data[0].bank_name,
    accountHolder: bankDetails.external_accounts.data[0].account_holder_name,
    accountType: bankDetails.external_accounts.data[0].account_holder_type,
    country: bankDetails.external_accounts.data[0].country,
    currency: bankDetails.external_accounts.data[0].currency,
    accountNumber: bankDetails.metadata.account_number,
    routingNumber: bankDetails.metadata.routing_number,
  };

  res.status(200).json({ success: true, bankDetails: accountDetails });
});

// Update bank details
exports.updateBankAccountDetails = catchAsyncError(async (req, res, next) => {
  const { userId } = req;

  const user = await userModel.findByPk(userId);

  if (!user) {
    return next(new ErrorHandler("User not found", StatusCodes.NOT_FOUND));
  }

  const { customerId, bank_account_id } = user;

  const {
    country,
    currency,
    account_holder_name,
    account_holder_type,
    routing_number,
    account_number,
  } = req.body;

  const updatedAccount = await updateBankAccount(
    country,
    currency,
    account_holder_name,
    account_holder_type,
    routing_number,
    account_number,
    customerId,
    bank_account_id
  );

  let updateData = {};

  if (updatedAccount) updateData.bank_account_id = updatedAccount.accountId;

  await user.update(updateData);

  res.status(200).json({ success: true, updatedAccount });
});

// delete bank details
exports.deleteBankAccountDetails = catchAsyncError(async (req, res, next) => {
  const { userId } = req;

  const user = await userModel.findByPk(userId);

  if (!user) {
    return next(new ErrorHandler("User not found", StatusCodes.NOT_FOUND));
  }

  const { bank_account_id } = user;

  const deleteAccount = await deleteBankDetails(bank_account_id);

  let updatedData = {};

  if (deleteAccount.deleted) {
    updatedData.bank_account_id = null;
  }
  await user.update(updatedData);

  res.status(200).json({ success: true, message: "Bank deleted successfully" });
});

// =================== Cancel event route =======================

exports.cancelEvent = catchAsyncError(async (req, res, next) => {
  const { eventId } = req.params;
  // const { userId } = req;

  const event = await eventModel.findByPk(eventId);

  // if (!event) {
  //   return res
  //     .status(StatusCodes.NOT_FOUND)
  //     .json({ message: "Event not found" });
  // }

  // // Check if the current user is the creator of the event
  // if (event.userId !== userId) {
  //   return res
  //     .status(StatusCodes.FORBIDDEN)
  //     .json({ message: "You are not authorized to cancel this event" });
  // }

  // // Check if the event start time is more than 24 hours in the future
  // const eventStartTime = new Date(event.event_date).getTime();
  // const currentTime = new Date().getTime();
  // const twentyFourHoursInMilliseconds = 24 * 60 * 60 * 1000;

  // if (eventStartTime - currentTime <= twentyFourHoursInMilliseconds) {
  //   return res.status(StatusCodes.BAD_REQUEST).json({
  //     message: "Event cannot be canceled within 24 hours of start time",
  //   });
  // }

  // // Update event fields
  // let updateData = {};

  // // Example: Update other fields
  // const { status } = req.body;

  // if (status) updateData.status = status;

  // // Update the event
  // await event.update(updateData);

  // res
  //   .status(StatusCodes.OK)
  //   .json({ success: true, message: "Event cancelled successfully", event });

  refundAmount(event.id, next);
});

// pay commission test route
exports.payCommissions = catchAsyncError(async (req, res, next) => {
  const arr = {};
  try {
    const transactions = await Transaction.findAll({
      where: { payment_status: "succeeded" },
    });

    if (!transactions) {
      return next(
        new ErrorHandler("Transaction not found", StatusCodes.NOT_FOUND)
      );
    }

    // Create object of event amount and bank_account_id
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

    // calculate 60% of the total amount and transfer to the bank
    for (let obj in arr) {
      const event = await eventModel.findByPk(obj, {
        include: [
          {
            model: userModel,
            as: "creator",
            attributes: ["id", "username", "avatar", "email"],
          },
        ],
      });
      const calculatedPercentage = calculate60Percent(arr[obj].amount);

      if (!arr[obj].bank_account_id) {
        return next(
          new ErrorHandler("Bank account not found", StatusCodes.NOT_FOUND)
        );
      } else if (event.status === "Completed") {
        const amount = await payCommission(
          calculatedPercentage,
          arr[obj].bank_account_id,
          event.id,
          event.title,
          event.thumbnail,
          event.event_date,
          event.event_time,
          event.status,
          event.creator.id,
          event.creator.username,
          event.creator.avatar
        );
        // updating the charge field
        if (amount.source_transaction === null) {
          await Transaction.update(
            {
              charge: "paid",
            },
            { where: { eventId: obj } }
          );
        }
      }
    }
  } catch (error) {
    console.log(error);
    throw new Error(error.message);
  }
});

// Pay commission 60% of the total amount to the creator
exports.croneJob = () => {
  cron.schedule("10 18 * * *", async () => {
    console.log("runnnnnnnnnnnn");
    const arr = {};
    try {
      const transactions = await Transaction.findAll({
        where: { payment_status: "succeeded" },
      });

      if (!transactions) {
        return next(
          new ErrorHandler("Transaction not found", StatusCodes.NOT_FOUND)
        );
      }

      // Create object of event amount and bank_account_id
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

      // calculate 60% of the total amount and transfer to the bank
      for (let obj in arr) {
        const event = await eventModel.findByPk(obj, {
          include: [
            {
              model: userModel,
              as: "creator",
              attributes: ["id", "username", "avatar", "email"],
            },
          ],
        });
        const calculatedPercentage = calculate60Percent(arr[obj].amount);

        if (!arr[obj].bank_account_id) {
          return next(
            new ErrorHandler("Bank account not found", StatusCodes.NOT_FOUND)
          );
        } else if (event.status === "Completed") {
          const amount = await payCommission(
            calculatedPercentage,
            arr[obj].bank_account_id,
            event.id,
            event.title,
            event.thumbnail,
            event.event_date,
            event.event_time,
            event.status,
            event.creator.id,
            event.creator.username,
            event.creator.avatar
          );
          // updating the charge field
          if (amount.source_transaction === null) {
            await Transaction.update(
              {
                charge: "paid",
              },
              { where: { eventId: obj } }
            );
          }
        }
      }
    } catch (error) {
      console.log(error);
      throw new Error(error.message);
    }
  });
};

// When event canceled this function will run for refunds
const refundAmount = async (eventId, next) => {
  const transactions = await Transaction.findAll({
    where: { payment_status: "succeeded" },
  });

  if (!transactions) {
    return next(new ErrorHandler("Event not found", StatusCodes.NOT_FOUND));
  }

  const arr = {};

  for (let transaction of transactions) {
    if (!transaction.charge) {
      arr[transaction.eventId] = {};
      arr[transaction.eventId]["customers"] = transactions.customerId;
    }
  }

  for (let obj in arr) {
    const paymentIntents = await getPaymentIntentsByCustomer(
      arr[obj].customers,
      obj
    );

    const refund = payRefund(
      paymentIntents.amount,
      paymentIntents.paymentIntentId
    );

    if (refund.status === "succeeded") {
      await Transaction.update(
        {
          charge: "refunded",
        },
        { where: { eventId: obj } }
      );
    }
  }
};

// Function for calculating 60% of the total amount
function calculate60Percent(totalAmount) {
  if (typeof totalAmount !== "number" || isNaN(totalAmount)) {
    throw new Error("Total amount must be a valid number.");
  }

  const sixtyPercent = totalAmount * 0.6;

  const roundedSixtyPercent = Math.round(sixtyPercent * 100) / 100;

  return roundedSixtyPercent;
}
