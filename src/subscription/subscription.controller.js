const catchAsyncError = require("../../utils/catchAsyncError");
const ErrorHandler = require("../../utils/errorHandler");
const { eventModel } = require("../events/event.model");
const { userModel } = require("../user");
const { StatusCodes } = require("http-status-codes");
const Subscription = require("./subscription.model");
// const { Wishlist } = require("../wishlist/wishlist.model");
// const Transaction = require("../transactions/transaction.model");
const { createCheckout, captureStripePayment } = require("../../utils/stripe");

// Create session for generating session id and url for payment
exports.createSession = catchAsyncError(async (req, res, next) => {
  const { userId } = req;
  const { eventId } = req.params;

  const user = await userModel.findByPk(userId);
  const event = await eventModel.findByPk(eventId);

  if (!event)
    return next(new ErrorHandler("Event not found", StatusCodes.NOT_FOUND));

  //Getting stipe session
  const stripe = await createCheckout(event, user);

  if (!stripe) {
    return next(new ErrorHandler("Session not found", StatusCodes.NOT_FOUND));
  }

  res.status(StatusCodes.CREATED).json({ sessionURL: stripe });
});

// create subscripion after payment is confrim using seesion id
// wishlist is not handled yet
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

// const capturePaymentStripe = async (req, res, next) => {
//   const {
//     startDate,
//     endDate,
//     startTime,
//     endTime,
//     carId,
//     insurance,
//     person,
//     luggage,
//     fromAddress,
//     toAddress,
//     discount,
//     name,
//     email,
//     phone,
//   } = req.body;
//   try {
//     const car = await carModel.findById(carId);
//     const price = car.price;

//     const total = await calculateTotal(
//       startDate,
//       endDate,
//       startTime,
//       endTime,
//       price,
//       insurance,
//       discount
//     );

//     const session_id = req.params.orderId;

//     try {
//       const session = await stripe.checkout.sessions.retrieve(session_id);
//       const paymentStatus = session.payment_status;
//       if (paymentStatus) {
//         const user = await userModel.findById(req.userId);
//         if (user) {
//           const booking = await bookingModel.create({
//             car: carId,
//             user: req.userId,
//             pickupLocation: fromAddress,
//             startDate: new Date(
//               ${format(new Date(startDate), "MMMM dd, yyyy")}, ${startTime}
//             ),
//             dropofLocation: toAddress,
//             endDate: new Date(
//               ${format(new Date(endDate), "MMMM dd, yyyy")}, ${endTime}
//             ),
//             person: person,
//             luggage: luggage,
//             totalPrice: total,
//             status:
//               session.payment_status === "unpaid" ? "CANCELLED" : "COMPLETED",
//             stripeOrderId: session_id,
//             insurance: insurance,
//           });

//           // also add to transaction model
//           const transaction = await transactionModel.create({
//             booking: booking._id,
//             user: req.userId,
//             amount: total,
//             status:
//               session.payment_status === "unpaid" ? "CANCELLED" : "COMPLETED",
//             transactionId: session.id,
//           });

//           await sendMail(transaction.transactionId, total, car.name);
//           await sendUserMail(
//             transaction.transactionId,
//             booking,
//             total,
//             car.name,
//             user.email,
//             user.name
//           );

//           return res.status(200).json({
//             paymentCaptured: { status: "COMPLETED" },
//           });
//         } else {
//           const booking = await bookingModel.create({
//             car: carId,
//             name: name,
//             email: email,
//             phone: phone,
//             pickupLocation: fromAddress,
//             startDate: new Date(
//               ${format(new Date(startDate), "MMMM dd, yyyy")}, ${startTime}
//             ),
//             dropofLocation: toAddress,
//             endDate: new Date(
//               ${format(new Date(endDate), "MMMM dd, yyyy")}, ${endTime}
//             ),
//             person: person,
//             luggage: luggage,
//             totalPrice: total,
//             status:
//               session.payment_status === "unpaid" ? "CANCELLED" : "COMPLETED",
//             StripeOrderId: session.id,
//             insurance: insurance,
//           });

//           const transaction = await transactionModel.create({
//             booking: booking._id,
//             name: name,
//             email: email,
//             phone: phone,
//             amount: total,
//             status:
//               session.payment_status === "unpaid" ? "CANCELLED" : "COMPLETED",
//             transactionId: session.id,
//           });

//           await sendMail(transaction.transactionId, total, car.name);
//           await sendUserMail(
//             transaction.transactionId,
//             booking,
//             total,
//             car.name,
//             email,
//             name
//           );
//         }

//         return res.status(200).json({
//           paymentCaptured: { status: "COMPLETED" },
//         });
//       } else if (paymentStatus === "requires_payment_method") {
//         res.send("Payment failed. Please try again.");
//       } else {
//         res.send("Payment status: " + paymentStatus);
//       }
//     } catch (error) {
//       console.error("Error retrieving payment status:", error);
//       res
//         .status(500)
//         .send("An error occurred while retrieving payment status.");
//     }
//   } catch (error) {
//     res.status(500).json(error.message);
//   }
// };

// const createCheckout = async (req, res, next) => {
//   const { products, customerEmail, base } = req.body;

//   const lineItems = products.map((product) => ({
//     price_data: {
//       currency: "nzd",
//       product_data: {
//         name: product.dish,
//         images: [product.imgdata],
//       },
//       unit_amount: product.price * 100,
//     },
//     quantity: product.qnty,
//   }));

//   try {
//     const session = await stripe.checkout.sessions.create({
//       payment_method_types: ["card"],
//       line_items: lineItems,
//       phone_number_collection: {
//         enabled: true,
//       },
//       mode: "payment",
//       success_url: `${base}/order`,
//       cancel_url: `${base}/order`,
//       customer_email: customerEmail,
//       custom_fields: [
//         {
//           key: "name",
//           label: {
//             type: "custom",
//             custom: "Your name",
//           },
//           type: "text",
//         },
//       ],
//     });
//     res.json({ id: session.id });
//   } catch (e) {
//     console.log(e);
//   }
// };
