const catchAsyncError = require("../../utils/catchAsyncError");
const ErrorHandler = require("../../utils/errorHandler");
const { StatusCodes } = require("http-status-codes");
const Transaction = require("./transaction.model");
const { eventModel } = require("../events/event.model");
const { userModel } = require("../user/user.model");
const { Op } = require("sequelize");
const secret_key = process.env.STRIPE_SECRET_KEY;
const stripe = require("stripe")(secret_key);

exports.getAllTransaction = catchAsyncError(async (req, res, next) => {
  const { currentPage, resultPerPage, key, status } = req.query;
  const offset = (currentPage - 1) * resultPerPage;
  let whereClause = {};

  // Add status to whereClause if provided, otherwise return all events
  if (status && status.trim() !== "") {
    if (status === "succeeded") {
      whereClause = {
        ...whereClause,
        payment_status: "succeeded",
      };
    }
    if (status === "failed") {
      whereClause = {
        ...whereClause,
        payment_status: "failed",
      };
    }
    if (status === "cancelled") {
      whereClause = {
        ...whereClause,
        payment_status: "cancelled",
      };
    }
  }

  if (key && key.trim() !== "") {
    whereClause = {
      ...whereClause,
      [Op.or]: [
        { transaction_id: { [Op.iLike]: `%${key}%` } }, // Assuming 'name' is the field to search for genres
      ],
    };
  }

  const { count, rows: transactions } = await Transaction.findAndCountAll({
    where: whereClause,
    limit: resultPerPage,
    offset: offset,
  });

  res.status(200).json({ success: true, length: count, transactions });
});

exports.getSingleTransaction = catchAsyncError(async (req, res, next) => {
  const { eventId } = req.params;
  const { userId } = req;

  where = {
    status: {
      [Op.or]: ["Upcoming", "Live"],
    },
  };

  const event = await eventModel.findByPk(eventId, {
    where,
  });

  const transaction = await Transaction.findOne({
    where: { eventId },
    include: [
      {
        model: eventModel,
        as: "event",
        attributes: [
          "title",
          "thumbnail",
          "event_duration",
          "event_date",
          "event_time",
          "status",
          "spots",
        ],
      },

      {
        model: userModel,
        as: "user",
        attributes: ["username", "avatar", "email"],
      },
    ],
    order: [["createdAt", "DESC"]],
  });

  if (!transaction) {
    return next(
      new ErrorHandler("Transaction not found", StatusCodes.NOT_FOUND)
    );
  }

  const eventDetails = {
    eventId: transaction.eventId,
    userId: transaction.userId,
    title: transaction.event.title,
    eventTime: transaction.event.event_time,
    eventDate: transaction.event.event_date,
    eventStatus: transaction.event.status,
    paymentStatus: transaction.payment_status,
    amount: transaction.amount,
    user: transaction.user.username,
    avatar: transaction.user.avatar,
    spots: event.spots,
    following: "",
  };

  if (userId !== transaction.userId) {
    return next(
      new ErrorHandler(
        "You are not authorized to access this event",
        StatusCodes.UNAUTHORIZED
      )
    );
  }

  res.status(StatusCodes.OK).json({ success: true, eventDetails });
});

exports.updateTransaction = catchAsyncError(async (req, res, next) => {
  const transaction = await Transaction.findByPk(req.params.id);

  if (!transaction) {
    return res.status(404).json({ message: "Transaction not found" });
  }
  await transaction.update(req.body);

  res.status(StatusCodes.CREATED).json({ success: true, transaction });
});

exports.deleteTransaction = catchAsyncError(async (req, res, next) => {
  const { transactionId } = req.params;

  const transaction = await Transaction.findByPk(transactionId);

  if (!transaction) {
    return res.status(404).json({ message: "Transaction not found" });
  }
  await transaction.destroy();

  res.status(StatusCodes.CREATED).json({ success: true, transaction });
});

exports.payoutSettlements = catchAsyncError(async (req, res, next) => {
  const { userId } = req;

  const user = await userModel.findByPk(userId);

  if (!user) {
    return next(new ErrorHandler("User not found", StatusCodes.NOT_FOUND));
  }

  const { bank_account_id } = user;

  const transfers = await stripe.transfers.list({
    destination: bank_account_id,
  });

  if (!transfers) {
    return next(new ErrorHandler("No tranfers found", StatusCodes.NOT_FOUND));
  }

  let amount = 0;
  let transaction = [];

  transfers.data.forEach((amnt) => {
    amount += amnt.amount;
    transaction.push(amnt.metadata);
  });

  res
    .status(StatusCodes.CREATED)
    .json({ success: true, totalRevanue: amount, transfers });
});

exports.payoutTransactions = catchAsyncError(async (req, res, next) => {
  const { userId } = req;

  const user = await userModel.findByPk(userId);

  if (!user) {
    return next(new ErrorHandler("User not found", StatusCodes.NOT_FOUND));
  }

  const { customerId } = user;

  const transactions = await stripe.paymentIntents.list({
    customer: customerId,
  });

  if (!transactions) {
    return next(
      new ErrorHandler("Transactions not found", StatusCodes.NOT_FOUND)
    );
  }

  let amount = 0;
  let transaction = [];

  transactions.data.forEach((transactionObj) => {
    transactionObj.metadata.status = transactionObj.status;
    if (transactionObj.metadata.amount === "succeeded") {
      amount += transactionObj.amount;
    }
    transaction.push(transactionObj.metadata);
  });

  res.status(StatusCodes.OK).json({
    success: true,
    totalTransactionPaid: amount,
    transactions: transaction,
  });
});

exports.getAdminSingleTransaction = catchAsyncError(async (req, res, next) => {
  const { transactionId } = req.params;

  const transaction = await Transaction.findByPk(transactionId, {
    include: [
      {
        model: eventModel,
        as: "event",
      },
      {
        model: userModel,
        as: "user",
      },
    ],
    order: [["createdAt", "DESC"]],
  });

  if (!transaction) {
    return next(
      new ErrorHandler("Transaction not found", StatusCodes.NOT_FOUND)
    );
  }

  res.status(StatusCodes.CREATED).json({ success: true, transaction });
});
