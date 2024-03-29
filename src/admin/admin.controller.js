const { StatusCodes } = require("http-status-codes");
const catchAsyncError = require("../../utils/catchAsyncError");
const ErrorHandler = require("../../utils/errorHandler");
const { s3Uploadv2 } = require("../../utils/s3");
const { userModel } = require("../user");

exports.createUser = catchAsyncError(async (req, res, next) => {
  console.log("Admin create user");
  const image = req.file;
  let imageUrl;
  image && (imageUrl = (await s3Uploadv2(image)).Location);

  let user;
  user = imageUrl
    ? await userModel.create({
      ...req.body,
      isVerified: true,
      avatar: imageUrl,
    })
    : await userModel.create({ ...req.body, isVerified: true });

  res.status(StatusCodes.CREATED).json({ user });
});

exports.deleteUser = catchAsyncError(async (req, res, next) => {
  const {
    params: { id },
  } = req;

  await userModel.destroy({ where: { id } });

  res
    .status(StatusCodes.OK)
    .json({ success: true, message: "User deleted successfully" });
});

exports.getAllUsers = catchAsyncError(async (req, res, next) => {
  console.log("Admin Get ALl users");

  const users = await userModel.findAll();
  res.status(StatusCodes.OK).json({ users });
});

exports.getSingleUser = catchAsyncError(async (req, res, next) => {
  const user = await userModel.findByPk(req.params.id);
  if (!user)
    return next(new ErrorHandler("User not found", StatusCodes.NOT_FOUND));

  res.status(StatusCodes.OK).json({ user });
});

exports.updateUser = catchAsyncError(async (req, res, next) => {
  const userId = req.params.id;
  const updateData = userModel.getUpdateFields(req.body);

  if (Object.keys(updateData).length === 0) {
    return next(
      new ErrorHandler(
        "Please provdide data to update",
        StatusCodes.BAD_REQUEST
      )
    );
  }
  console.log(updateData);
  const [isUpdated] = await userModel.update(updateData, {
    where: { id: userId },
  });

  if (isUpdated === 0) {
    return next(new ErrorHandler("User not found", StatusCodes.NOT_FOUND));
  }

  res
    .status(StatusCodes.OK)
    .json({ message: "User Updated Successfully", isUpdated });
});

exports.register = catchAsyncError(async (req, res, next) => {
  const admin = await userModel.create({
    ...req.body,
    isVerified: true,
    role: "Admin",
  });

  const token = admin.getJWTToken();

  res.status(StatusCodes.CREATED).json({ admin, token });
});
