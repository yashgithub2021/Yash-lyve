const catchAsyncError = require("../../utils/catchAsyncError");
const ErrorHandler = require("../../utils/errorHandler");
const { StatusCodes } = require("http-status-codes");
const Transaction = require("./transaction.model");
const { eventModel } = require("../events/event.model");
const { userModel } = require("../user/user.model");
const { Op } = require("sequelize");

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

  if (userId !== transaction.userId) {
    return next(
      new ErrorHandler(
        "You are not authorized to access this event",
        StatusCodes.UNAUTHORIZED
      )
    );
  }

  res.status(StatusCodes.CREATED).json({ success: true, transaction });
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
  const transactionId = req.params.id;

  const transaction = await Transaction.findByPk(transactionId);

  if (!transaction) {
    return res.status(404).json({ message: "Transaction not found" });
  }
  await transaction.destroy();

  res.status(StatusCodes.CREATED).json({ success: true, transaction });
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
