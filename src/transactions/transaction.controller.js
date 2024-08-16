const catchAsyncError = require("../../utils/catchAsyncError");
const ErrorHandler = require("../../utils/errorHandler");
const { StatusCodes } = require("http-status-codes");
const Transaction = require("./transaction.model");
const { eventModel } = require("../events/event.model");
const { userModel } = require("../user/user.model");
const { Op } = require("sequelize");
const { Wishlist } = require("../wishlist");
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
    include: [
      {
        model: userModel,
        as: "creator",
        attributes: ["id", "username", "avatar", "email"],
      },
    ],
  });

  if (!event) {
    return next(new ErrorHandler("Event not found", StatusCodes.NOT_FOUND));
  }

  const transaction = await Transaction.findOne({
    where: { eventId: eventId, userId: userId },
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

  const isWishlist = await Wishlist.findOne({
    where: { userId, eventId, isWishlisted: true },
  });

  const isLike = await Wishlist.findOne({
    where: { userId, eventId, liked: true },
  });

  const currUser = await userModel.findByPk(userId);
  const isAlreadyFollowing = await currUser.hasFollowing(event.creator.id);

  if (!transaction) {
    const eventDetails = {
      userId: event.creator.id,
      eventId: event.id,
      title: event.title,
      eventTime: event.event_time,
      eventDate: event.event_date,
      eventStatus: event.status,
      eventDuration: event.event_duration,
      userName: event.creator.username,
      avatar: event.creator.avatar,
      entryFees: event.entry_fee,
      spots: event.spots,
      hasFollowing: isAlreadyFollowing,
      hasPaid: true, // need to change false
      isWishlisted: isWishlist === null ? false : true,
      isLiked: isLike === null ? false : true,
    };
    return res.status(StatusCodes.OK).json({ success: true, eventDetails });
  }

  if (userId !== transaction.userId) {
    return next(
      new ErrorHandler(
        "You are not authorized to access this event",
        StatusCodes.UNAUTHORIZED
      )
    );
  }

  const eventDetails = {
    eventId: transaction.eventId,
    userId: transaction.userId,
    title: transaction.event.title,
    eventTime: transaction.event.event_time,
    eventDuration: transaction.event.event_duration,
    eventDate: transaction.event.event_date,
    eventStatus: transaction.event.status,
    hasPaid:
      transaction.payment_status === "succeeded" &&
      transaction.charge !== "refunded"
        ? true
        : false,
    amount: transaction.amount,
    userName: event.creator.username,
    avatar: event.creator.avatar,
    entryFees: event.entry_fee,
    spots: event.spots,
    hasFollowing: isAlreadyFollowing,
    isWishlisted: isWishlist === null ? false : true,
    isLiked: isLike === null ? false : true,
  };

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

  res.status(StatusCodes.OK).json({ success: true, transaction });
});

exports.payoutSettlements = catchAsyncError(async (req, res, next) => {
  const { userId } = req;

  const user = await userModel.findByPk(userId);

  if (!user) {
    return next(new ErrorHandler("User not found", StatusCodes.NOT_FOUND));
  }

  const { bank_account_id } = user;

  if (!bank_account_id) {
    return;
  }

  const transfers = await stripe.transfers.list({
    destination: bank_account_id,
  });

  if (!transfers) {
    return next(new ErrorHandler("No tranfers found", StatusCodes.NOT_FOUND));
  }

  let amount = 0;
  let transaction = [];

  const { month, year } = req.query;

  if (month && year) {
    const filteredByMonthYear = transfers.data.filter((transactionObj) => {
      const eventDate = new Date(transactionObj.metadata.eventDate * 1000);
      const date = eventDate.toISOString().split("T")[0];
      const [transactionYear, transactionMonth] = date.split("-");
      transactionObj.metadata.eventDate = date;
      transactionObj.metadata.status = "Success";
      amount += transactionObj.amount / 100;
      return (
        Number(transactionYear) === Number(year) &&
        Number(transactionMonth) === Number(month)
      );
    });
    filteredByMonthYear.forEach((transactionObj) => {
      transaction.push(transactionObj.metadata);
    });
  } else {
    transfers.data.forEach((transactionObj) => {
      const eventDate = new Date(transactionObj.metadata.eventDate * 1000);
      transactionObj.metadata.eventDate = eventDate.toISOString().split("T")[0];
      transactionObj.metadata.status = "Succeeded";
      amount += transactionObj.amount / 100;
      transaction.push(transactionObj.metadata);
    });
  }

  res
    .status(StatusCodes.OK)
    .json({ success: true, totalPaidTransactions: amount, transaction });
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

  const { month, year } = req.query;

  if (month && year) {
    const filteredByMonthYear = transactions.data.filter((transactionObj) => {
      const eventDate = new Date(transactionObj.metadata.eventDate * 1000);
      const date = eventDate.toISOString().split("T")[0];
      const [transactionYear, transactionMonth] = date.split("-");
      transactionObj.metadata.id = transactionObj.id;
      transactionObj.metadata.eventDate = date;
      transactionObj.metadata.status = transactionObj.metadata.status =
        transactionObj.status === "requires_payment_method"
          ? "Cancelled"
          : transactionObj.status === "succeeded"
          ? "Success"
          : transactionObj.status;
      if (transactionObj.status === "succeeded") {
        amount += transactionObj.amount / 100;
      }
      return (
        Number(transactionYear) === Number(year) &&
        Number(transactionMonth) === Number(month)
      );
    });
    filteredByMonthYear.forEach((transactionObj) => {
      transaction.push(transactionObj.metadata);
    });
  } else {
    transactions.data.forEach((transactionObj) => {
      const eventDate = new Date(transactionObj.metadata.eventDate * 1000);
      transactionObj.metadata.id = transactionObj.id;
      transactionObj.metadata.eventDate = eventDate.toISOString().split("T")[0];
      transactionObj.metadata.status =
        transactionObj.status === "requires_payment_method"
          ? "Cancelled"
          : transactionObj.status === "succeeded"
          ? "Success"
          : transactionObj.status;
      if (transactionObj.status === "succeeded") {
        amount += transactionObj.amount / 100;
      }
      transaction.push(transactionObj.metadata);
    });
  }

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

  res.status(StatusCodes.OK).json({ success: true, transaction });
});
