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
  payCommission,
  getPaymentIntentsByCustomer,
  payRefund,
  getBankDetails,
  generateLoginLink,
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

  const { email, customerId, bank_account_id } = user;

  const { country } = req.body;

  const account = await addBankDetails(country, email, customerId);

  if (!bank_account_id) {
    let updateData = {};

    if (account) updateData.bank_account_id = account.accountId;

    await user.update(updateData);
  }

  res.status(200).json({ success: true, account });
});

// Get bank details
exports.getBankAccountDetails = catchAsyncError(async (req, res, next) => {
  const { userId } = req;

  const user = await userModel.findByPk(userId);

  if (!user) {
    return next(new ErrorHandler("User not found", StatusCodes.NOT_FOUND));
  }

  const { customerId, bank_account_id } = user;

  if (!bank_account_id) {
    return next(
      new ErrorHandler("No bank account added yet", StatusCodes.NOT_FOUND)
    );
  }

  const bankDetails = await getBankDetails();

  let account = [];

  const details = bankDetails.data.filter((data) => {
    return data.metadata.customerId === customerId;
  });

  details.map((detail) => {
    return detail.external_accounts.data.map((acct) => {
      return account.push({
        country: acct.country,
        currency: acct.currency,
        bankName: acct.bank_name,
        accountId: acct.account,
        isPrimary: acct.account === bank_account_id ? true : false,
      });
    });
  });

  res.status(200).json({ success: true, bankDetails: account });
});

// Add primary bank account
exports.addPrimaryBank = catchAsyncError(async (req, res, next) => {
  const { userId } = req;

  const user = await userModel.findByPk(userId);

  if (!user) {
    return next(new ErrorHandler("User not found", StatusCodes.NOT_FOUND));
  }

  const { accountId } = req.body;

  let updateData = {};

  if (accountId) updateData.bank_account_id = accountId;

  await user.update(updateData);

  res.status(200).json({
    success: true,
    accountId: accountId,
    message: "Primary account is added successfully",
  });
});

// delete bank details
exports.deleteBankAccountDetails = catchAsyncError(async (req, res, next) => {
  const { userId } = req;
  const { accountId } = req.params;

  const user = await userModel.findByPk(userId);

  if (!user) {
    return next(new ErrorHandler("User not found", StatusCodes.NOT_FOUND));
  }

  const deleteAccount = await deleteBankDetails(accountId);

  let updatedData = {};

  if (deleteAccount.deleted) {
    updatedData.bank_account_id = null;
  }
  await user.update(updatedData);

  res
    .status(200)
    .json({ success: true, message: "Bank account deleted successfully" });
});

// Login Link screen for event creator
exports.loginLink = catchAsyncError(async (req, res, next) => {
  const { userId } = req;

  const user = await userModel.findByPk(userId);

  if (!user) {
    return next(new ErrorHandler("User not found", StatusCodes.NOT_FOUND));
  }

  const { bank_account_id } = user;

  const loginLink = await generateLoginLink(bank_account_id);

  res.status(200).json({ success: true, loginLink });
});

// Pay commission 60% of the total amount to the creator
exports.croneJob = () => {
  cron.schedule("44 13 * * *", async () => {
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
              attributes: [
                "id",
                "username",
                "avatar",
                "email",
                "bank_account_id",
              ],
            },
          ],
        });
        if (!arr[obj].bank_account_id) {
          return next(
            new ErrorHandler("Bank account not found", StatusCodes.NOT_FOUND)
          );
        } else if (event.status === "Completed") {
          const calculatedPercentage = await calculate60Percent(
            arr[obj].amount
          );

          await Event.update(
            {
              totalAmount: arr[obj].amount,
            },
            { where: { eventId: obj } }
          );

          const amount = await payCommission(
            calculatedPercentage,
            arr[obj].bank_account_id.replaceAll("'", ""),
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

            await Event.update(
              {
                totalAmount: arr[obj].amount,
                commission: amount.amount,
                payStatus: "Success",
              },
              { where: { eventId: obj } }
            );
          }

          if (amount.source_transaction !== null) {
            await Event.update(
              {
                commission: 0,
                payStatus: "Cancelled",
              },
              { where: { eventId: obj } }
            );
          }
        }
      }
    } catch (error) {
      throw new Error(error.message);
    }
  });
};

// When event deleted this function will run for refunds
exports.refundAmountOnDeleteEvent = async (transactions, eventId, next) => {
  return new Promise(async (resolve, reject) => {
    try {
      const arr = [];

      for (let transaction of transactions) {
        if (
          transaction.payment_status === "succeeded" &&
          transaction.charge !== "refunded"
        ) {
          arr.push(transaction.customer_id);
        }
      }

      for (let obj in arr) {
        const paymentIntents = await getPaymentIntentsByCustomer(
          arr[obj],
          eventId
        );

        // console.log("pti", paymentIntents);

        if (paymentIntents.paymentIntentId) {
          const refund = await payRefund(
            paymentIntents.amount,
            paymentIntents.paymentIntentId
          );

          // updating charge field to refunded
          if (refund.status === "succeeded") {
            const updatedTransaction = await Transaction.update(
              {
                charge: "refunded",
              },
              { where: { eventId: eventId, customer_id: arr[obj] } }
            );
            console.log("trans", updatedTransaction);
            resolve(updatedTransaction);
          }
        }
      }
    } catch (error) {
      reject(next(new ErrorHandler(error, StatusCodes.BAD_REQUEST)));
    }
  });
};

// When event deleted this function will run for refunds
exports.refundAmountOnCancelEvent = async (customerId, eventId) => {
  return new Promise(async (resolve, reject) => {
    try {
      const paymentIntents = await getPaymentIntentsByCustomer(
        customerId,
        eventId
      );

      const refund = await payRefund(
        paymentIntents.amount,
        paymentIntents.paymentIntentId
      );

      resolve(refund);
    } catch (error) {
      reject(error);
    }
  });
};

// Function for calculating 60% of the total amount
async function calculate60Percent(totalAmount) {
  if (typeof totalAmount !== "number" || isNaN(totalAmount)) {
    throw new Error("Total amount must be a valid number.");
  }

  const sixtyPercent = totalAmount * 0.6;

  const roundedSixtyPercent = Math.round(sixtyPercent * 100) / 100;

  return roundedSixtyPercent;
}
