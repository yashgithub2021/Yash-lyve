const catchAsyncError = require("../../utils/catchAsyncError");
const ErrorHandler = require("../../utils/errorHandler");
const { eventModel } = require("../events/event.model");
const { userModel } = require("../user");
const { StatusCodes } = require("http-status-codes");
const Subscription = require("./subscription.model");

exports.createSubscription = catchAsyncError(async (req, res, next) => {
  const { userId } = req;
  const { eventId } = req.params;
  const { sessionId } = req.params;
  // const { wishlistId } = req.params;

  const user = await userModel.findByPk(userId);
  const event = await eventModel.findByPk(eventId);
  // const wishlist = await Wishlist.findByPk(wishlistId);

  if (!event || !user)
    return next(
      new ErrorHandler("Event or user not found", StatusCodes.NOT_FOUND)
    );

  // checking payment status
  const session = await captureStripePayment(sessionId);
  console.log("paymentStatus", session.payment_status);
  // console.log("session", session);

  if (session.payment_status === "unpaid" || undefined) {
    return next(
      new ErrorHandler("Payment is not confirmed", StatusCodes.NOT_FOUND)
    );
  }

  // if (wishlist) {
  //   if (wishlist.paymentStatus === false) {
  //     wishlist.paymentStatus = true;
  //     await wishlist.save();
  //   }
  // }

  // console.log("wishlist", wishlist);

  // Create subscription
  // const subscription = await Subscription.create({
  //   userId,
  //   eventId,
  //   status: true,
  // });

  res.status(StatusCodes.CREATED).json({ session });
});

// Get subscription
exports.getSubscription = catchAsyncError(async (req, res, next) => {
  const { subscriptionId } = req.params;

  const subscription = await Subscription.findByPk(subscriptionId, {
    include: [
      {
        model: eventModel,
        as: "subscribed_event", // Use the correct alias for the event association
        attributes: ["id", "title", "thumbnail"],
      },
      {
        model: userModel,
        as: "subscriber", // Use the correct alias for the user association
        attributes: ["id", "username", "avatar"],
      },
    ],
    order: [["createdAt", "DESC"]],
  });

  if (!subscription)
    return next(
      new ErrorHandler("Subscription not found", StatusCodes.NOT_FOUND)
    );

  res.status(StatusCodes.OK).json({ subscription });
});
