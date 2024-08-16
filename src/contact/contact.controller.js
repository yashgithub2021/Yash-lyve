const ErrorHandler = require("../../utils/errorHandler");
const catchAsyncError = require("../../utils/catchAsyncError");
const { StatusCodes } = require("http-status-codes");
const contactModel = require("./contact.modal");
const { userModel } = require("../user/user.model");

exports.createContact = catchAsyncError(async (req, res, next) => {
  const { name, email, desc } = req.body;

  if (!name || !email || !desc) {
    return next(new ErrorHandler("Field is required", StatusCodes.NOT_FOUND));
  }

  const user = await userModel.findOne({ email });

  if (!user) {
    return next(new ErrorHandler("User not found", StatusCodes.NOT_FOUND));
  }

  contact = await contactModel.create(req.body);

  res.status(201).json({ success: true, contact });
});

exports.getContacts = catchAsyncError(async (req, res, next) => {
  const contacts = await contactModel.findAll();

  if (!contacts) {
    return next(new ErrorHandler("Query not found", StatusCodes.NOT_FOUND));
  }

  res.status(201).json({ success: true, contacts });
});

exports.getSingleContact = catchAsyncError(async (req, res, next) => {
  const { id } = req.params;

  const contact = await contactModel.findByPk(id);

  if (!contact) {
    return next(new ErrorHandler("Query not found", StatusCodes.NOT_FOUND));
  }

  res.status(201).json({ success: true, contact });
});

exports.deleteContact = catchAsyncError(async (req, res, next) => {
  const { id } = req.params;

  const contact = await contactModel.findByPk(id);

  if (!contact) {
    return next(new ErrorHandler("Query not found", StatusCodes.NOT_FOUND));
  }

  await contact.destroy();

  res.status(201).json({ success: true, contact });
});
