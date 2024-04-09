const multer = require("multer");
const ErrorHandler = require("../utils/errorHandler");
const { StatusCodes } = require("http-status-codes");
module.exports = (err, req, res, next) => {
  console.error({ err });
  err.message = err.message || "Internal Server Error";

  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      err = new ErrorHandler(
        "File size is too large",
        StatusCodes.REQUEST_TOO_LONG
      );
    }

    if (err.code === "LIMIT_FILE_COUNT") {
      err = new ErrorHandler("File limit reached", StatusCodes.BAD_REQUEST);
    }

    if (err.code === "LIMIT_UNEXPECTED_FILE") {
      err = new ErrorHandler(
        "File must be an image",
        StatusCodes.UNPROCESSABLE_ENTITY
      );
    }
  }

  if (err.name === "CastError") {
    const msg = `Resource not found. Invalid: ${err.path}`;
    err = new ErrorHandler(msg, StatusCodes.INTERNAL_SERVER_ERROR);
  }

  if (err.name === "SequelizeValidationError") {
    let errors = err.errors.map((el) => {
      let message = el.message;
      if (
        el.validatorKey === "notEmpty" ||
        el.validatorKey === "notNull" ||
        el.validatorKey === "is_null"
      ) {
        message = `${el.path} ${el.message}`;
      }
      return message;
    });

    const msg = errors.join(", ");
    err = new ErrorHandler(msg, StatusCodes.CONFLICT);
  }

  if (err.name === "SequelizeUniqueConstraintError") {
    let errors = err.errors.map((el) => {
      if (el.path === "email") {
        return "Email is already registered.";
      }
      return el.message;
    });

    err = new ErrorHandler(errors.join(", "), StatusCodes.CONFLICT);
  }

  // JWT errors
  if (err.name === "JsonWebTokenError") {
    const message = `Invalid token, please try again`;
    err = new ErrorHandler(message, StatusCodes.UNAUTHORIZED);
  }

  if (err.name === "TokenExpiredError") {
    const message = `Token has expired, please login again`;
    err = new ErrorHandler(message, StatusCodes.UNAUTHORIZED);
  }

  res.status(err.statusCode || StatusCodes.INTERNAL_SERVER_ERROR).json({
    success: false,
    error: {
      message: err.message,
    },
  });
};