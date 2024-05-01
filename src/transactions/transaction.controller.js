const catchAsyncError = require("../../utils/catchAsyncError");
const ErrorHandler = require("../../utils/errorHandler");
const { StatusCodes } = require("http-status-codes");
const Transaction = require("./transaction.model");
const { eventModel } = require("../events/event.model");
const { userModel } = require("../user/user.model");

exports.getAllTransaction = catchAsyncError(async (req, res, next) => {
  const transactions = await Transaction.findAll();

  if (!transactions) {
    return next(
      new ErrorHandler("Transactions not found", StatusCodes.NOT_FOUND)
    );
  }

  res.status(StatusCodes.CREATED).json({ success: true, transactions });
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

  res.status(StatusCodes.CREATED).json({ transaction });
});

exports.deleteTransaction = catchAsyncError(async (req, res, next) => {
  const transactionId = req.params.id;

  const transaction = await Transaction.findByPk(transactionId);

  if (!transaction) {
    return res.status(404).json({ message: "Transaction not found" });
  }
  await transaction.destroy();

  res.status(StatusCodes.CREATED).json({ transaction });
});
