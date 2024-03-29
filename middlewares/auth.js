const jwt = require("jsonwebtoken");
const { userModel, roleModel } = require("../src/user/user.model");
const ErrorHandler = require("../utils/errorHandler");
const { StatusCodes } = require("http-status-codes");

exports.auth = async (req, res, next) => {
  console.log(req.headers.authorization);
  try {
    if (!req.headers.authorization) {
      return res.status(401).send({
        error: {
          message: `Unauthorized. Please Send token in request header`,
        },
      });
    }

    const { userId } = jwt.verify(
      req.headers.authorization,
      process.env.JWT_SECRET
    );
    console.log({ userId });

    req.userId = userId;

    next();
  } catch (error) {
    console.log(error);
    return res.status(401).send({ error: { message: `Unauthorized` } });
  }
};

exports.authRole = (roles) => async (req, res, next) => {
  try {
    const userId = req.userId;
    const user = await userModel.findByPk(userId);
    if (!user)
      return next(
        new ErrorHandler(
          "Invalid token. User not found.",
          StatusCodes.NOT_FOUND
        )
      );

    if (!roles.includes(user.role))
      return next(new ErrorHandler("Restricted.", StatusCodes.UNAUTHORIZED));

    req.user = user;

    next();
  } catch (error) {
    return next(new ErrorHandler("Unauthorized.", StatusCodes.UNAUTHORIZED));
  }
};
