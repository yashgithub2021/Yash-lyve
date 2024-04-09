const catchAsyncError = require("../../utils/catchAsyncError");
const ErrorHandler = require("../../utils/errorHandler");
const { eventModel, genreModel } = require("../events/event.model");
const { userModel } = require("../user");
const { StatusCodes } = require("http-status-codes");
// const { Wishlist } = require("../wishlist/wishlist.model");
const secret_key = process.env.STRIPE_SECRET_KEY;
const stripe = require("stripe")(secret_key);

exports.createSubscription = catchAsyncError(async (req, res, next) => {
  console.log("Create subs", req.body);

  const { userId } = req;
  const { eventId } = req.params;

  const user = await userModel.findByPk(userId);
  const event = await eventModel.findByPk(eventId);
  //   const wishlist = await Wishlist.findByPk()

  if (!event || !user)
    return next(
      new ErrorHandler("Event or user not found", StatusCodes.NOT_FOUND)
    );

  const subscription_fees = event.entry_fee;

  res.status(StatusCodes.CREATED).json({ event, user });
});

// exports.deleteEvent = catchAsyncError(async (req, res, next) => {
//   const {
//     params: { eventId },
//     userId,
//   } = req;

//   const event = await eventModel.findByPk(eventId);

//   // Check if event exists
//   if (!event) {
//     return res
//       .status(StatusCodes.NOT_FOUND)
//       .json({ success: false, message: "Event not found" });
//   }

//   // Check if the current user is the creator of the event
//   if (event.userId !== userId) {
//     return res
//       .status(StatusCodes.FORBIDDEN)
//       .json({ success: false, message: "Unauthorized" });
//   }

//   // Delete the event
//   await event.destroy();

//   res
//     .status(StatusCodes.OK)
//     .json({ success: true, message: "Event deleted Successfully" });
// });
