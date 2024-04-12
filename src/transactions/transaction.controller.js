const catchAsyncError = require("../../utils/catchAsyncError");
const ErrorHandler = require("../../utils/errorHandler");
const { StatusCodes } = require("http-status-codes");
const Transaction = require("./transaction.model");
const { eventModel } = require("../events/event.model");
const { userModel } = require("../user/user.model");

// currently, No use of this route
exports.createTransaction = catchAsyncError(async (req, res, next) => {
  console.log("Create transaction", req.body);
  const { userId } = req;

  const transaction = await Transaction.create(req.body);
  res.status(201).json(transaction);

  res.status(StatusCodes.CREATED).json({ event: creator });
});

exports.getAllTransaction = catchAsyncError(async (req, res, next) => {
  const transaction = await Transaction.findAll({
    include: [
      {
        model: eventModel,
        as: "transaction", // Use the correct alias for the event association
        attributes: ["title", "thumbnail"],
      },
      {
        model: userModel,
        as: "transaction", // Use the correct alias for the user association
        attributes: ["username", "avatar", "email"],
      },
    ],
    order: [["createdAt", "DESC"]],
  });

  if (!transaction) {
    return next(
      new ErrorHandler("Transactions not found", StatusCodes.NOT_FOUND)
    );
  }

  res.status(StatusCodes.CREATED).json({ transaction });
});

exports.getSingleTransaction = catchAsyncError(async (req, res, next) => {
  const transactionId = req.params.id;

  const transaction = await Transaction.findByPk(transactionId);

  if (!transaction) {
    return next(
      new ErrorHandler("Transaction not found", StatusCodes.NOT_FOUND)
    );
  }

  res.status(StatusCodes.CREATED).json({ transaction });
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
