const ErrorHandler = require("../../utils/errorHandler");
const catchAsyncError = require("../../utils/catchAsyncError");
const contentModel = require("./content.model");
const { StatusCodes } = require("http-status-codes");

const TT = "TERMS_AND_CONDITIONS";
const PP = "PRIVACY_POLICY";

// TT and PP create and update
exports.createUpdateTNC = catchAsyncError(async (req, res, next) => {
  console.log("create content", req.body);
  const { title, desc } = req.body;

  if (!title || !desc) {
    return next(new ErrorHandler("Title and description is required", 400));
  }

  let content = await contentModel.findOne({ where: { title } });
  if (!content) {
    content = await contentModel.create(req.body);
  } else {
    [_, content] = await contentModel.update(req.body, {
      where: { title },
      returning: true,
    });
  }

  res.status(201).json({ success: true, content });
});

exports.getContent = catchAsyncError(async (req, res, next) => {
  console.log("getContent");
  const privacy_policy = await contentModel.findOne({ where: { title: PP } });
  const tos = await contentModel.findOne({ where: { title: TT } });
  res.status(200).json({ success: true, privacy_policy, tos });
});

exports.deleteContent = catchAsyncError(async (req, res, next) => {
  console.log("", req.query);
  const isDeleted = await contentModel.destroy({
    where: { title: req.query.type },
  });
  if (!isDeleted) {
    return next(new ErrorHandler("Content not found", 404));
  }

  res
    .status(200)
    .json({ success: true, message: "Content deleted successfully" });
});

exports.getTT = catchAsyncError(async (req, res, next) => {
  console.log("getTT");
  const content = await contentModel.findOne({
    where: { title: TT },
    attributes: ["desc"],
  });

  if (!content) {
    return next(
      new ErrorHandler("No terms and conditions found", StatusCodes.NOT_FOUND)
    );
  }

  res.status(200).json({ success: true, tos: content.desc });
});

exports.getPP = catchAsyncError(async (req, res, next) => {
  console.log("getPP");
  const content = await contentModel.findOne({
    where: { title: PP },
    attributes: ["desc"],
  });

  if (!content) {
    return next(
      new ErrorHandler("No privacy policy found", StatusCodes.NOT_FOUND)
    );
  }

  res.status(200).json({ success: true, privacy_policy: content.desc });
});
