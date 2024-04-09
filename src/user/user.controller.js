const ErrorHandler = require("../../utils/errorHandler");
const { userModel, otpModel } = require("./user.model");
const catchAsyncError = require("../../utils/catchAsyncError");
const sendEmail = require("../../utils/sendEmail");
const generateOTP = require("../../utils/otpGenerator");
const { StatusCodes } = require("http-status-codes");
const { s3Uploadv2 } = require("../../utils/s3");
const { Op } = require("sequelize");
const { db } = require("../../config/database");
const { eventModel } = require("../events/event.model");
const { notificationModel } = require("../notification");

const getMsg = (otp) => {
  return `<html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
      /* Add your CSS styles here */
      body {
        font-family: Arial, sans-serif;
      }
      .container {
        max-width: 600px;
        margin: 0 auto;
        padding: 20px;
        background-color: #f4f4f4;
      }
      h1 {
        color: #333;
      }
    </style>
  </head>
  <body>
    <div class="container">
      <h1>Welcome to my Lyve Chat</h1>
      <p>your verification otp is</p><b>${otp}</b>
    </div>
  </body>
  </html>`;
};

const storeOTP = async ({ otp, userId }) => {
  console.log({ otp, userId });

  const otpInstance = await otpModel.findOne({ where: { userId } });
  if (!otpInstance) {
    await otpModel.create({
      otp,
      userId,
    });
  } else {
    otpInstance.otp = otp;
    await otpInstance.save();
  }
};

const createNotification = async (userId, text, title, userAvatar) => {
  await notificationModel.create({ userId, text, title, userAvatar });
  console.log("Notification created successfully");
};

exports.register = catchAsyncError(async (req, res, next) => {
  console.log("register", req.body);
  const { email, dob, mobile_no } = req.body;
  const imageFile = req.file;
  const imageUrl = imageFile && (await s3Uploadv2(imageFile));
  let user;
  const prevUser = await userModel.findOne({ email: email });

  if (prevUser && !prevUser.isVerified) {
    await prevUser.update({ ...req.body });
    user = prevUser;
    console.log(prevUser);
  } else {
    user = imageUrl
      ? await userModel.create({
          ...req.body,
          role: "User",
          dob: new Date(dob),
          avatar: imageUrl.Location,
        })
      : await userModel.create({
          ...req.body,
          role: "User",
          dob: new Date(dob),
        });
  }

  const otp = generateOTP();

  await storeOTP({ otp, userId: user.id });

  try {
    const message = getMsg(otp);
    await sendEmail({
      email: user.email,
      subject: "Verify Registration OTP",
      message,
    });
    res
      .status(StatusCodes.CREATED)
      .json({ message: `OTP sent to ${user.email} successfully` });
  } catch (error) {
    return next(
      new ErrorHandler(error.message, StatusCodes.INTERNAL_SERVER_ERROR)
    );
  }
});

exports.verifyRegisterOTP = catchAsyncError(async (req, res, next) => {
  const { otp, email } = req.body;
  if (!otp || !email) {
    return next(new ErrorHandler("Missing OTP", StatusCodes.BAD_REQUEST));
  }
  const otpInstance = await otpModel.findOne({ where: { otp } });
  const user = await userModel.findOne({ where: { email } });

  if (!user)
    return next(
      new ErrorHandler(
        "User not found please check entered email",
        StatusCodes.NOT_FOUND
      )
    );

  if (!otpInstance || !otpInstance.isValid()) {
    if (otpInstance) {
      await otpModel.destroy({ where: { id: otpInstance.id } });
      await userModel.destroy({ where: { email: email } });
    }
    return next(
      new ErrorHandler(
        "OTP is invalid or has been expired.",
        StatusCodes.BAD_REQUEST
      )
    );
  }
  user.isVerified = true;
  await user.save();
  await otpModel.destroy({ where: { id: otpInstance.id } });
  const token = user.getJWTToken();
  res.status(StatusCodes.CREATED).json({ success: true, user, token });
});

exports.login = catchAsyncError(async (req, res, next) => {
  console.log("login", req.body);
  const { email, password } = req.body;

  const user = await userModel
    .scope("withPassword")
    .findOne({ where: { email } });

  if (!user) {
    return next(
      new ErrorHandler(
        "User not found with entered credentials",
        StatusCodes.NOT_FOUND
      )
    );
  }

  if (!user.isVerified) {
    return next(
      new ErrorHandler("Please Verify OTP.", StatusCodes.UNAUTHORIZED)
    );
  }

  const isMatch = await user.comparePassword(password);

  if (!isMatch) {
    return next(
      new ErrorHandler("Invalid Credentials", StatusCodes.BAD_REQUEST)
    );
  }

  const token = user.getJWTToken();
  res.status(StatusCodes.OK).json({ user, token });
});

exports.resendOTP = catchAsyncError(async (req, res, next) => {
  console.log("resendOTP", req.body);
  const { email } = req.body;
  if (!email) {
    return next(new ErrorHandler("Please enter your email.", 400));
  }

  const user = await userModel.findOne({ where: { email } });
  if (!user) {
    return next(
      new ErrorHandler("Please register or User doesn't exist.", 400)
    );
  }

  const otp = generateOTP();
  await storeOTP({ otp, userId: user.id });

  try {
    const message = getMsg(otp);
    await sendEmail({
      email: email,
      subject: "Resend OTP",
      message,
    });

    res.status(200).json({ message: "OTP sent to your email successfully" });
  } catch (error) {
    return next(new ErrorHandler(error.message, 500));
  }
});

exports.forgotPassword = catchAsyncError(async (req, res, next) => {
  console.log("forgot password", req.body);
  const { email } = req.body;
  if (!email) {
    return next(
      new ErrorHandler("Please provide a valid email.", StatusCodes.BAD_REQUEST)
    );
  }

  const user = await userModel.findOne({ where: { email: req.body.email } });

  if (!user) {
    return next(
      new ErrorHandler(
        "User not found with entered credentials",
        StatusCodes.NOT_FOUND
      )
    );
  }

  const otp = generateOTP();

  await storeOTP({ otp, userId: user.id });

  const message = `<b>Your password reset OTP is :- <h2>${otp}</h2></b><div>If you have not requested this email then, please ignore it.</div>`;

  try {
    await sendEmail({
      email: user.email,
      subject: "Password Reset",
      message,
    });

    res.status(StatusCodes.OK).json({
      success: true,
      message: `Email sent to ${user.email} successfully`,
    });
  } catch (error) {
    await otpModel.destroy({ where: { otp, userId: user.id } });
    return next(
      new ErrorHandler(error.message, StatusCodes.INTERNAL_SERVER_ERROR)
    );
  }
});

exports.verifyOtp = catchAsyncError(async (req, res, next) => {
  const { otp } = req.body;
  if (!otp) {
    return next(new ErrorHandler("Missing OTP", StatusCodes.BAD_REQUEST));
  }

  const otpInstance = await otpModel.findOne({ where: { otp } });

  if (!otpInstance || !otpInstance.isValid()) {
    if (otpInstance) {
      await otpModel.destroy({ where: { id: otpInstance.id } });
    }

    return next(
      new ErrorHandler(
        "OTP is invalid or has been expired",
        StatusCodes.BAD_REQUEST
      )
    );
  }

  await otpModel.destroy({ where: { id: otpInstance.id } });

  res
    .status(StatusCodes.OK)
    .json({ message: "OTP verified successfully", userId: otpInstance.userId });
});

exports.updatePassword = catchAsyncError(async (req, res, next) => {
  console.log("Update Password", req.body);

  const userId = req.userId || req.body.userId;

  const user = await userModel
    .scope("withPassword")
    .findOne({ where: { id: userId } });

  if (!user) {
    return next(new ErrorHandler("User not found", StatusCodes.NOT_FOUND));
  }

  const { password, oldPassword } = req.body;

  if (password === oldPassword) {
    return next(
      new ErrorHandler("New password must not be same as old password")
    );
  }

  if (req.userId && !req.body.oldPassword) {
    return next(
      new ErrorHandler(
        "Please enter your old password to update",
        StatusCodes.BAD_REQUEST
      )
    );
  }

  if (oldPassword) {
    console.log("old Password", oldPassword);
    const isMatch = await user.comparePassword(oldPassword);

    if (!isMatch) {
      return next(
        new ErrorHandler(
          "Password does not match with old password",
          StatusCodes.UNAUTHORIZED
        )
      );
    }
  }
  user.password = password;

  await user.save();

  res.status(StatusCodes.OK).json({ message: "Password Updated Successfully" });
});

exports.getAllUsers = catchAsyncError(async (req, res, next) => {
  console.log("Admin Get All users");
  const { page_number, page_size, search_query } = req.query;
  const { userId } = req;
  let where = {
    role: "User",
    id: { [Op.not]: userId },
  };

  if (search_query) {
    where[Op.or] = [
      { username: { [Op.iLike]: `%${search_query}%` } },
      { email: { [Op.iLike]: `%${search_query}%` } },
    ];
  }

  const query = {
    where,
    attributes: ["id", "username", "avatar"],
  };

  if (page_number && page_size) {
    const currentPage = parseInt(page_number, 10) || 1;
    const limit = parseInt(page_size, 10) || 10;
    const offset = (currentPage - 1) * limit;

    query.offset = offset;
    query.limit = limit;
  }

  const users = await userModel.findAll(query);

  // Get the following users for the current user
  const userFollowing = await userModel.findAll({
    where: {
      id: {
        [Op.in]: db.literal(`(
          SELECT "following_user_id" 
          FROM "Follow" 
          WHERE "follower_user_id" = '${req.userId}'
        )`),
      },
    },
    attributes: ["id"],
  });

  const followingUserIds = userFollowing.map((user) => user.id);

  // Update each user object to include the following field
  const usersWithFollowing = users.map((user) => ({
    ...user.toJSON(),
    following: followingUserIds.includes(user.id),
  }));

  res.status(StatusCodes.OK).json({ users: usersWithFollowing });
});

exports.getProfile = catchAsyncError(async (req, res, next) => {
  console.log("User profile", req.userId);

  const { userId } = req;

  const user = await userModel.findByPk(userId, {
    attributes: [
      "id",
      "avatar",
      "username",
      "email",
      "mobile_no",
      "dob",
      "gender",
      "country",
    ], // Exclude 'role' attribute
  });

  if (!user)
    return next(new ErrorHandler("User not found", StatusCodes.NOT_FOUND));

  res.status(StatusCodes.OK).json({ user });
});

exports.getUserProfile = catchAsyncError(async (req, res, next) => {
  console.log("User Profile by Id", req.params);

  const { userId } = req.params;

  // Find the user's profile
  const user = await userModel.findByPk(userId, {
    attributes: ["id", "username", "avatar"],
  });

  if (!user) {
    return res
      .status(StatusCodes.NOT_FOUND)
      .json({ message: "User not found" });
  }

  // Find the current user's following list
  const userFollowing = await userModel.findAll({
    where: {
      id: {
        [Op.in]: db.literal(`(
          SELECT "following_user_id" 
          FROM "Follow" 
          WHERE "follower_user_id" = '${req.userId}'
        )`),
      },
    },
    attributes: ["id"],
  });

  const following_count = await userModel.count({
    where: {
      id: {
        [Op.in]: db.literal(`(
          SELECT "following_user_id" 
          FROM "Follow" 
          WHERE "follower_user_id" = '${userId}'
        )`),
      },
    },
    distinct: true,
    col: "id",
  });
  const follower_count = await userModel.count({
    where: {
      id: {
        [Op.in]: db.literal(`(
          SELECT "follower_user_id" 
          FROM "Follow" 
          WHERE "following_user_id" = '${userId}'
        )`),
      },
    },
    distinct: true,
    col: "id",
  });
  console.log("Following Count", following_count);
  console.log("Follower Count", follower_count);

  const followingUserIds = userFollowing.map((user) => user.id);

  const streamed = await eventModel.count({
    where: {
      userId: userId,
      status: "Completed",
    },
  });
  // Add following field to the user object
  const userProfile = {
    ...user.toJSON(),
    following: followingUserIds.includes(userId),
    following_count: following_count,
    follower_count: follower_count,
    streamed_count: streamed,
  };

  res.status(StatusCodes.OK).json({ user: userProfile });
});

exports.updateProfile = catchAsyncError(async (req, res, next) => {
  const { userId } = req;
  console.log("Req Body", req.body);
  const imageFile = req.file;

  if (imageFile) {
    const imageUrl = await s3Uploadv2(imageFile);
    req.body.avatar = imageUrl.Location;
  }
  const updateData = userModel.getUpdateFields(req.body);
  console.log(updateData);
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
    .json({ message: "Profile Updated Successfully", isUpdated });
});

exports.deleteUser = catchAsyncError(async (req, res, next) => {
  const { userId } = req;
  await userModel.destroy({ where: { id: userId } });
  res
    .status(StatusCodes.OK)
    .json({ success: true, message: "User deleted successfully" });
});

/* ====================================FOLLOW STUFF==================================================*/
exports.followCreator = catchAsyncError(async (req, res, next) => {
  console.log("Follow user", req.params);
  const {
    params: { creatorId },
  } = req;

  const { userId } = req;

  const currUser = await userModel.findByPk(userId);

  const targetCreator = await userModel.findByPk(creatorId);

  if (userId === creatorId) {
    return next(
      new ErrorHandler("you can not follow yourself", StatusCodes.FORBIDDEN)
    );
  }

  if (!targetCreator) {
    return next(
      new ErrorHandler("User with given id not found", StatusCodes.NOT_FOUND)
    );
  }

  const isAlreadyFollowing = await currUser.hasFollowing(targetCreator);

  if (isAlreadyFollowing) {
    return next(
      new ErrorHandler("Already following this user", StatusCodes.BAD_REQUEST)
    );
  }

  await currUser.addFollowing(targetCreator);

  const message = `${currUser.username} started following you.`;
  await createNotification(
    targetCreator.id,
    message,
    "follow",
    currUser.avatar
  );

  res
    .status(StatusCodes.CREATED)
    .json({ success: true, message: "You are now following this user" });
});

exports.unfollowCreator = catchAsyncError(async (req, res, next) => {
  console.log("Unfollow creator", req.params);

  const { userId } = req;

  const {
    params: { creatorId },
  } = req;

  const currUser = await userModel.findByPk(userId);
  const targetCreator = await userModel.findByPk(creatorId);

  if (userId === creatorId) {
    return next(
      new ErrorHandler("you can not unfollow yourself", StatusCodes.FORBIDDEN)
    );
  }

  if (!targetCreator) {
    return next(
      new ErrorHandler("User with given id not found", StatusCodes.NOT_FOUND)
    );
  }

  const isAlreadyFollowing = await currUser.hasFollowing(targetCreator);
  if (!isAlreadyFollowing) {
    return next(
      new ErrorHandler(
        "You are not following this user already",
        StatusCodes.BAD_REQUEST
      )
    );
  }

  await currUser.removeFollowing(targetCreator);

  res.status(StatusCodes.OK).json({
    success: true,
    message: "You have unfollowed this user successfully",
  });
});

exports.getCreatorFollowers = catchAsyncError(async (req, res, next) => {
  const { userId } = req;
  const { page_number, page_size, search_query } = req.query;

  let query = {};
  if (page_number && page_size) {
    const currentPage = parseInt(page_number, 10) || 1;
    const limit = parseInt(page_size, 10) || 10;
    const offset = (currentPage - 1) * limit;

    query.offset = offset;
    query.limit = limit;
  }

  if (search_query) {
    query.where = {
      id: {
        [Op.in]: db.literal(`(
          SELECT "follower_user_id" 
          FROM "Follow" 
          WHERE "following_user_id" = '${userId}'
        )`),
      },
      username: {
        [Op.iLike]: `%${search_query}%`,
      },
    };
  } else {
    query.where = {
      id: {
        [Op.in]: db.literal(`(
          SELECT "follower_user_id" 
          FROM "Follow" 
          WHERE "following_user_id" = '${userId}'
        )`),
      },
    };
  }

  console.log("Query", query);

  const followers = await userModel.findAll({
    ...query,
    attributes: ["id", "username", "avatar"],
  });

  // Get the following users for the current user
  const userFollowing = await userModel.findAll({
    where: {
      id: {
        [Op.in]: db.literal(`(
          SELECT "following_user_id" 
          FROM "Follow" 
          WHERE "follower_user_id" = '${userId}'
        )`),
      },
    },
    attributes: ["id"],
  });

  const followingUserIds = userFollowing.map((user) => user.id);

  // Update each follower object to include the following field
  const followersWithFollowing = followers.map((follower) => ({
    ...follower.toJSON(),
    following: followingUserIds.includes(follower.id),
  }));

  res.status(StatusCodes.OK).json({ followers: followersWithFollowing });
});

exports.getCreatorFollowing = catchAsyncError(async (req, res, next) => {
  const { userId } = req;
  const { page_number, page_size, search_query } = req.query;

  let query = {};
  if (page_number && page_size) {
    const currentPage = parseInt(page_number, 10) || 1;
    const limit = parseInt(page_size, 10) || 10;
    const offset = (currentPage - 1) * limit;

    query.offset = offset;
    query.limit = limit;
  }

  if (search_query) {
    query.where = {
      id: {
        [Op.in]: db.literal(`(
          SELECT "following_user_id" 
          FROM "Follow" 
          WHERE "follower_user_id" = '${userId}'
        )`),
      },
      username: {
        [Op.iLike]: `%${search_query}%`,
      },
    };
  } else {
    query.where = {
      id: {
        [Op.in]: db.literal(`(
          SELECT "following_user_id" 
          FROM "Follow" 
          WHERE "follower_user_id" = '${userId}'
        )`),
      },
    };
  }

  console.log("Query", query);

  const followings = await userModel.findAll({
    ...query,
    attributes: ["id", "username", "avatar"],
  });

  // Get the following users for the current user
  const userFollowing = await userModel.findAll({
    where: {
      id: {
        [Op.in]: db.literal(`(
          SELECT "following_user_id" 
          FROM "Follow" 
          WHERE "follower_user_id" = '${userId}'
        )`),
      },
    },
    attributes: ["id"],
  });

  const followingUserIds = userFollowing.map((user) => user.id);

  // Update each following object to include the following field
  const followingsWithFollowing = followings.map((following) => ({
    ...following.toJSON(),
    following: followingUserIds.includes(following.id),
  }));

  res.status(StatusCodes.OK).json({ followings: followingsWithFollowing });
});

exports.getSuggestedUsers = catchAsyncError(async (req, res, next) => {
  const { userId } = req;
  let query = {
    where: {
      id: { [Op.ne]: userId }, // Exclude current user
      role: "User",
    },
    include: [
      {
        model: eventModel,
        as: "events",
        attributes: [],
      },
    ],
    group: ["User.id"],
  };

  const userFollowing = await userModel.findAll({
    where: {
      id: {
        [Op.in]: db.literal(`(
          SELECT "following_user_id" 
          FROM "Follow" 
          WHERE "follower_user_id" = '${userId}'
        )`),
      },
    },
  });

  const followingUserIds = userFollowing.map((user) => user.id);

  // Find users who have created events
  const suggested = await userModel.findAll({
    ...query,
    attributes: ["id", "username", "avatar"],
  });

  const suggestedUsers = suggested.map((user) => ({
    ...user.toJSON(),
    following: followingUserIds.includes(user.id),
  }));

  res.status(200).json({ success: true, suggestedUsers });
});
