class ErrorHandler extends Error {
  constructor(msg, status) {
    super(msg);
    this.statusCode = status;

    Error.captureStackTrace(this, this.constructor);
  }
}

module.exports = ErrorHandler;
