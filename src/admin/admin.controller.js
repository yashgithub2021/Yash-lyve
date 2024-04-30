const { StatusCodes } = require("http-status-codes");
const catchAsyncError = require("../../utils/catchAsyncError");
const ErrorHandler = require("../../utils/errorHandler");
const { s3Uploadv2 } = require("../../utils/s3");
const { userModel } = require("../user");
const { Op } = require("sequelize");
const { eventModel, genreModel } = require("../events/event.model");

exports.createUser = catchAsyncError(async (req, res, next) => {
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

  res.status(StatusCodes.CREATED).json({ success: true, user });
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

//Create new route which contain pagination and search query
exports.getAllUsers = catchAsyncError(async (req, res, next) => {
  const { currentPage, resultPerPage, key } = req.query;
  const offset = (currentPage - 1) * resultPerPage;
  let whereClause = {};

  if (key && key.trim() !== "") {
    whereClause = {
      [Op.or]: [{ username: { [Op.iLike]: `%${key}%` } }],
    };
  }

  if (req.user.role === "Admin") {
    // If requester is Admin, exclude users with role "Admin" from the query
    whereClause.role = { [Op.ne]: "Admin" };
  }

  whereClause.isVerified = true;

  const { count, rows: users } = await userModel.findAndCountAll({
    where: whereClause,
    limit: resultPerPage,
    offset: offset,
  });

  res.status(200).json({
    success: true,
    length: count,
    users: users,
  });
});

// create Single user route
exports.getSingleUser = catchAsyncError(async (req, res, next) => {
  const user = await userModel.findByPk(req.params.id);
  if (!user)
    return next(new ErrorHandler("User not found", StatusCodes.NOT_FOUND));

  res.status(StatusCodes.OK).json({ success: true, user });
});

//Create new route old route is not working
exports.updateUser = catchAsyncError(async (req, res, next) => {
  const userId = req.params.id;

  const user = await userModel.findByPk(userId);

  if (!user) {
    return next(new ErrorHandler("User not found", StatusCodes.NOT_FOUND));
  }

  // Update event fields
  let updateData = {};

  const thumbnailFile = req.file;

  if (thumbnailFile) {
    const imageUrl = await s3Uploadv2(thumbnailFile);
    updateData.avatar = imageUrl.Location;
  }

  // You can add more fields to update as needed
  const { username, gender, mobile_no } = req.body;

  if (username) updateData.username = username;
  if (gender) updateData.gender = gender;
  if (mobile_no) updateData.mobile_no = mobile_no;

  // Update the event
  await user.update(updateData);

  res
    .status(StatusCodes.OK)
    .json({ success: true, message: "Event updated successfully", user });
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

// Create Admin update profile route
exports.updateAdminProfile = catchAsyncError(async (req, res, next) => {
  const { userId } = req;

  const user = await userModel.findByPk(userId);

  if (!user) {
    return next(new ErrorHandler("User not found", StatusCodes.NOT_FOUND));
  }

  // Update event fields
  let updateData = {};

  const thumbnailFile = req.file;

  if (thumbnailFile) {
    const imageUrl = await s3Uploadv2(thumbnailFile);
    updateData.avatar = imageUrl.Location;
  }

  // You can add more fields to update as needed
  const { username, gender, mobile_no, country, dob } = req.body;

  if (username) updateData.username = username;
  if (gender) updateData.gender = gender;
  if (mobile_no) updateData.mobile_no = mobile_no;
  if (dob) updateData.dob = dob;
  if (country) updateData.country = country;

  // Update the event
  await user.update(updateData);

  res
    .status(StatusCodes.OK)
    .json({ success: true, message: "Event updated successfully", user });
});

// Admin account delete
exports.deleteAdmin = catchAsyncError(async (req, res, next) => {
  const { email } = req.body;

  const adminAccount = await userModel.destroy({ where: { email } });

  if (!adminAccount) {
    return next(new ErrorHandler("Invalid credentials", StatusCodes.NOT_FOUND));
  }

  res
    .status(StatusCodes.OK)
    .json({ success: true, message: "Account deleted successfully" });
});

// Admin dashboard
exports.getDashboardData = catchAsyncError(async (req, res, next) => {
  const [userCount, events, genreCount] = await Promise.all([
    userModel.count({
      where: {
        role: {
          [Op.not]: "Admin",
        },
      },
    }),
    eventModel.findAll({ raw: true }),
    genreModel.count(),
  ]);

  // Initialize counters for different event statuses
  let liveEvents = 0,
    upcomingEvents = 0,
    completedEvents = 0;

  // Iterate through fetched events to count different statuses
  events.forEach((event) => {
    if (event.status === "Live") {
      liveEvents++;
    } else if (event.status === "Upcoming") {
      upcomingEvents++;
    } else {
      completedEvents++;
    }
  });

  // Calculate total event count
  const eventCount = events.length;

  // Send response with the aggregated data
  res.status(200).send({
    success: true,
    data: [
      { key: "Users", value: userCount },
      { key: "Events", value: eventCount },
      { key: "Genres", value: genreCount },
      { key: "Live events", value: liveEvents },
      { key: "Upcoming events", value: upcomingEvents },
      { key: "Completed events", value: completedEvents },
    ],
  });
});
