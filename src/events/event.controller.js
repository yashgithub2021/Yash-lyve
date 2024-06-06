const catchAsyncError = require("../../utils/catchAsyncError");
const ErrorHandler = require("../../utils/errorHandler");
const { eventModel, genreModel } = require("./event.model");
const { userModel } = require("../user");
const { StatusCodes } = require("http-status-codes");
const { s3Uploadv2 } = require("../../utils/s3");
const { Op } = require("sequelize");
const formattedQuery = require("../../utils/apiFeatures");
const { Wishlist } = require("../wishlist");
const { db } = require("../../config/database");
const secret_key = process.env.STRIPE_SECRET_KEY;
const stripe = require("stripe")(secret_key);
const { firebase } = require("../../utils/firebase");
const moment = require("moment");
const {
  refundAmountOnDeleteEvent,
  refundAmountOnCancelEvent,
} = require("../bank/bank.controller");
const Transaction = require("../transactions/transaction.model");
const { notificationModel } = require("../notification");
const messaging = firebase.messaging();

const createNotification = async (userId, text, title, userAvatar) => {
  await notificationModel.create({ userId, text, title, userAvatar });
  console.log("Notification created successfully");
};

exports.createEvent = catchAsyncError(async (req, res, next) => {
  console.log("Create event", req.body);
  const { userId } = req;

  const user = await userModel.findByPk(userId);

  if (!user) {
    return next(new ErrorHandler("User not found", StatusCodes.NOT_FOUND));
  }

  if (!user.bank_account_id) {
    return next(
      new ErrorHandler("Please add bank first", StatusCodes.NOT_FOUND)
    );
  }

  const confirmAccount = await stripe.accounts.retrieve(user.bank_account_id);

  if (confirmAccount.capabilities.transfers !== "active") {
    return next(
      new ErrorHandler(
        "Stripe account verification is pending",
        StatusCodes.BAD_REQUEST
      )
    );
  }

  const { genre } = req.body;
  const genreReq = await genreModel.findOne({ where: { name: genre } });
  const creator = await userModel.findByPk(userId);

  if (!genreReq)
    return next(new ErrorHandler("Genre not found", StatusCodes.NOT_FOUND));

  // const thumbnailFile = req.file;
  const thumbnailFile = req.file;
  if (!thumbnailFile) {
    throw new ErrorHandler("Thumbnail is required", StatusCodes.BAD_REQUEST);
  }
  if (thumbnailFile) {
    const imageUrl = await s3Uploadv2(thumbnailFile);
    req.body.thumbnail = imageUrl.Location;
  }

  const eventData = {
    ...req.body,
  };

  const event = await eventModel.create(eventData);
  await event.setGenre(genreReq);
  await event.setCreator(creator);

  const followerIds = await db.query(
    `SELECT "follower_user_id"
     FROM "Follow"
     WHERE "following_user_id" = '${userId}'`,
    { type: db.QueryTypes.SELECT }
  );

  // Extract user IDs from the result
  const userIds = followerIds.map((follower) => follower.follower_user_id);

  // Fetch FCM tokens of followers
  const followers = await userModel.findAll({
    attributes: ["id", "fcm_token"],
    where: {
      id: {
        [Op.in]: userIds,
      },
      fcm_token: {
        [Op.not]: null, // Ensure fcm_token is not null
      },
    },
  });

  // Extract FCM tokens from the result
  const fcmTokens = followers.map((follower) => follower.fcm_token);

  console.log("ffffffffffffffff", fcmTokens);

  const notificationMessage = {
    notification: {
      title: "New Event Recommendation!",
      body: "You have a new event recommendation from your favorite content creator ! Check out their profile.",
    },
  };

  // Prepare an array to hold promises for sending notifications to each device
  const sendPromises = [];

  // Iterate over the array of dummy tokens
  fcmTokens.forEach((token) => {
    const message = { ...notificationMessage, token };
    const sendPromise = messaging.send(message);
    sendPromises.push(sendPromise);
  });

  try {
    // Wait for all promises to resolve (i.e., all notifications are sent)
    const responses = await Promise.all(sendPromises);
    console.log("Push notifications sent successfully:", responses);
    // res.status(200).send(responses);
  } catch (error) {
    console.error("Error sending push notifications:", error);
    // res.status(500).send({ error: "Failed to send push notifications" });
  }

  const newEvent = await eventModel.findByPk(event.id, {
    include: [{ model: genreModel, as: "genre", attributes: ["id", "name"] }],
  });

  res.status(StatusCodes.CREATED).json({ event: newEvent });
});

exports.deleteEvent = catchAsyncError(async (req, res, next) => {
  const {
    params: { eventId },
    userId,
  } = req;

  const event = await eventModel.findByPk(eventId);

  // Check if event exists
  if (!event) {
    return res
      .status(StatusCodes.NOT_FOUND)
      .json({ success: false, message: "Event not found" });
  }

  // Check if the current user is the creator of the event
  if (event.userId !== userId) {
    return res
      .status(StatusCodes.FORBIDDEN)
      .json({ success: false, message: "Unauthorized" });
  }

  // Check if the event start time is more than 24 hours in the future
  if (event.status === "Completed") {
    await event.destroy();
    return res
      .status(StatusCodes.OK)
      .json({ success: true, message: "Event deleted Successfully" });
  } else {
    const eventStartTime = new Date(event.event_date).getTime();
    const currentTime = new Date().getTime();
    const twentyFourHoursInMilliseconds = 24 * 60 * 60 * 1000;

    if (eventStartTime - currentTime <= twentyFourHoursInMilliseconds) {
      return next(
        new ErrorHandler(
          "Event cannot be canceled within 24 hours of start time",
          StatusCodes.BAD_GATEWAY
        )
      );
    }
  }

  const transactions = await Transaction.findAll({
    where: { eventId: eventId },
  });

  let refund;

  if (transactions.length > 0) {
    refund = await refundAmountOnDeleteEvent(transactions, eventId, next);
    if (refund) {
      const notificationPromises = transactions.map(async (transaction) => {
        const userId = transaction.userId; // Assuming this is how you get the user ID from the transaction
        const user = await userModel.findByPk(userId); // Assuming userModel is your user model

        if (user) {
          const notificationText = `The event ${event.title} has been canceled. You will receive a refund.`;
          const notificationTitle = "Event Canceled";
          await createNotification(
            userId,
            notificationText,
            notificationTitle,
            event.thumbnail
          );
          if (user.fcm_token) {
            const fcmMessage = {
              notification: {
                title: "Event Canceled",
                body: `The event ${event.title} in which you had a spot reserved is canceled by your content creator. You will be refunded. Explore Other amazing events on the app.`,
              },
              token: user.fcm_token,
              data: {
                type: "event_cancelled",
                eventId: eventId,
              },
            };

            try {
              await messaging.send(fcmMessage);
              console.log(`Notification sent to user ${userId}`);
            } catch (error) {
              console.error(
                `Error sending notification to user ${userId}:`,
                error
              );
            }
          }
        }
      });
      // Wait for all notifications to be sent
      await Promise.all(notificationPromises);
    }
    await event.destroy();
  } else {
    refund = "No transactions found on this event";
    await event.destroy();
  }

  res
    .status(StatusCodes.OK)
    .json({ success: true, message: "Event deleted Successfully", refund });
});

exports.updateEvent = catchAsyncError(async (req, res, next) => {
  const { eventId } = req.params;
  const { userId } = req;
  const imageFile = req.file;

  let event = await eventModel.findByPk(eventId);

  if (!event) {
    return res
      .status(StatusCodes.NOT_FOUND)
      .json({ message: "Event not found" });
  }

  // Check if the current user is the creator of the event
  if (event.userId !== userId) {
    return res
      .status(StatusCodes.FORBIDDEN)
      .json({ message: "You are not authorized to update this event" });
  }

  // Update event fields
  let updateData = {};

  // If there's an image file, upload to S3 and update the thumbnail
  if (imageFile) {
    const imageUrl = await s3Uploadv2(imageFile);
    updateData.thumbnail = imageUrl.Location;
  }

  // Example: Update other fields
  // You can add more fields to update as needed
  const {
    title,
    host,
    event_date,
    event_time,
    spots,
    entry_fee,
    status,
    event_duration,
  } = req.body;

  if (title) updateData.title = title;
  if (host) updateData.host = host;
  if (event_date) updateData.event_date = event_date;
  if (event_time) updateData.event_time = event_time;
  if (spots) updateData.spots = spots;
  if (entry_fee) updateData.entry_fee = entry_fee;
  if (status) updateData.status = status;
  if (event_duration) updateData.event_duration = event_duration;

  // Update the event
  await event.update(updateData);

  res
    .status(StatusCodes.OK)
    .json({ success: true, message: "Event updated successfully", event });
});

exports.createGenre = catchAsyncError(async (req, res, next) => {
  console.log("Create Genre", req.body);
  const thumbnailFile = req.file;
  if (!thumbnailFile) {
    throw new ErrorHandler("Thumbnail is required", StatusCodes.BAD_REQUEST);
  }
  if (thumbnailFile) {
    const imageUrl = await s3Uploadv2(thumbnailFile);
    req.body.thumbnail = imageUrl.Location;
  }
  const genre = await genreModel.create({ ...req.body });
  res.status(StatusCodes.CREATED).json({ success: true, genre });
});

exports.updateGenre = catchAsyncError(async (req, res, next) => {
  const genreId = req.params.id;

  const genre = await genreModel.findByPk(genreId);

  if (!genre) {
    return res
      .status(StatusCodes.NOT_FOUND)
      .json({ success: false, message: "Genre not found" });
  }

  const { name } = req.body;
  const thumbnailFile = req.file;

  if (!thumbnailFile) {
    throw new ErrorHandler("Thumbnail is required", StatusCodes.BAD_REQUEST);
  }

  const imageUrl = await s3Uploadv2(thumbnailFile);

  let updatedGenre = {};

  if (name) updatedGenre.name = name;
  if (thumbnailFile) updatedGenre.thumbnail = imageUrl.Location;

  await genre.update(updatedGenre);

  res
    .status(StatusCodes.OK)
    .json({ success: true, message: "Genre updated successfully", genre });
});

exports.deleteGenre = catchAsyncError(async (req, res, next) => {
  const { genreId } = req.params;

  const genre = await genreModel.findByPk(genreId);

  if (!genre) {
    return res
      .status(StatusCodes.NOT_FOUND)
      .json({ success: false, message: "Genre not found" });
  }

  await genre.destroy();

  res
    .status(StatusCodes.OK)
    .json({ success: true, message: "Genre deleted successfully" });
});

exports.getUpcomingEvents = catchAsyncError(async (req, res, next) => {
  const upcomingEvents = await eventModel.findAll({
    where: { status: "Upcoming" },
    attributes: ["id", "title", "event_time"],
    include: [
      {
        model: genreModel,
        as: "genre",
        attributes: ["thumbnail"],
      },
    ],
  });

  if (!upcomingEvents) {
    res
      .status(StatusCodes.NOT_FOUND)
      .json({ success: false, message: "Upcoming events not found" });
  }

  res.status(StatusCodes.OK).json({ upcomingEvents });
});

exports.getRecommendedEvents = catchAsyncError(async (req, res, next) => {
  const { userId } = req;
  // Fetch all events ordered by createdAt in descending order
  const allEvents = await eventModel.findAll({
    order: [["createdAt", "DESC"]],
    include: [
      {
        model: genreModel,
        as: "genre",
        attributes: ["id", "name", "thumbnail"],
      },
      {
        model: userModel,
        as: "creator",
        attributes: ["id", "username", "avatar"],
        where: { deletedAt: null },
      },
    ],
  });

  const eventsWithWishlist = await Promise.all(
    allEvents.map(async (event) => {
      const isWishlisted = await Wishlist.findOne({
        where: { userId, eventId: event.id, isWishlisted: true },
      });

      const isLiked = await Wishlist.findOne({
        where: { userId, eventId: event.id, liked: true },
      });
      const isDisLiked = await Wishlist.findOne({
        where: { userId, eventId: event.id, disliked: true },
      });

      const likesCount = await Wishlist.count({
        where: { eventId: event.id, liked: true },
      });
      const dislikesCount = await Wishlist.count({
        where: { eventId: event.id, disliked: true },
      });

      return {
        ...event.toJSON(),
        isWishlisted: !!isWishlisted,
        isLiked: !!isLiked,
        isDisLiked: !!isDisLiked,
        likes_count: likesCount,
        dislikes_count: dislikesCount,
      };
    })
  );

  res.status(StatusCodes.OK).json({ recommendedEvents: eventsWithWishlist });
});

exports.getEvents = catchAsyncError(async (req, res, next) => {
  const { status, page_number, page_size, genre, wishlisted, search_query } =
    req.query;
  const { userId } = req;

  let where = {
    status: {
      [Op.or]: ["Upcoming", "Live"],
    },
  };
  const query = {
    where,
    include: [
      {
        model: genreModel,
        as: "genre",
        attributes: ["id", "name", "thumbnail"],
      },
      {
        model: userModel,
        as: "creator",
        attributes: ["id", "username", "avatar"],
        where: { deletedAt: null },
      },
    ],
    order: [["createdAt", "DESC"]],
  };

  // if (status) {
  //   where.status = status.charAt(0).toUpperCase() + status.slice(1);
  // }
  if (status) {
    where.status = status;
  }

  if (genre) {
    const genreArray = Array.isArray(genre) ? genre : [genre];
    const genreIds = [];

    for (const genreName of genreArray) {
      const genreRecord = await genreModel.findOne({
        where: { name: genreName },
      });

      if (genreRecord) {
        genreIds.push(genreRecord.id);
      }
    }

    if (genreIds.length > 0) {
      // Add the genreIds to the query with OR condition
      query.where = {
        ...query.where,
        Genre: { [Op.or]: genreIds },
      };
    }
  }

  if (wishlisted === "true" && userId) {
    const wishlistEvents = await Wishlist.findAll({
      where: { userId, isWishlisted: true },
      attributes: ["eventId"],
    });

    const eventIds = wishlistEvents.map(
      (wishlistEvent) => wishlistEvent.eventId
    );

    where.id = { [Op.in]: eventIds };
  }

  if (search_query) {
    where[Op.or] = [
      { title: { [Op.iLike]: `%${search_query}%` } },
      { host: { [Op.iLike]: `%${search_query}%` } },
    ];
  }

  if (userId) {
    where.userId = { [Op.ne]: userId }; // Exclude events created by the current user
  }

  if (page_number && page_size) {
    const currentPage = parseInt(page_number, 10) || 1;
    const limit = parseInt(page_size, 10) || 10;
    const offset = (currentPage - 1) * limit;

    query.offset = offset;
    query.limit = limit;
  }

  console.log("Query", query);

  const events = await eventModel.findAll(query);

  // Add the isWishlisted field to each event
  const eventsWithWishlist = await Promise.all(
    events.map(async (event) => {
      const isWishlisted = await Wishlist.findOne({
        where: { userId, eventId: event.id, isWishlisted: true },
      });

      const isLiked = await Wishlist.findOne({
        where: { userId, eventId: event.id, liked: true },
      });
      const isDisLiked = await Wishlist.findOne({
        where: { userId, eventId: event.id, disliked: true },
      });

      const likesCount = await Wishlist.count({
        where: { eventId: event.id, liked: true },
      });
      const dislikesCount = await Wishlist.count({
        where: { eventId: event.id, disliked: true },
      });

      return {
        ...event.toJSON(),
        isWishlisted: !!isWishlisted,
        isLiked: !!isLiked,
        isDisLiked: !!isDisLiked,
        likes_count: likesCount,
        dislikes_count: dislikesCount,
      };
    })
  );

  res.status(200).json({ success: true, events: eventsWithWishlist });
});

// exports.getEvents = catchAsyncError(async (req, res, next) => {
//   const { status, page_number, page_size, genre, wishlisted, search_query } =
//     req.query;
//   const { userId } = req;

//   let where = {};
//   const query = {
//     where,
//     include: [
//       {
//         model: genreModel,
//         as: "genre",
//         attributes: ["id", "name", "thumbnail"],
//       },
//       {
//         model: userModel,
//         as: "creator",
//         attributes: ["id", "username", "avatar"],
//         where: { deletedAt: null },
//       },
//     ],
//     order: [["createdAt", "DESC"]],
//   };

//   if (status) {
//     where.status = status;
//   }

//   if (genre) {
//     const genreArray = Array.isArray(genre) ? genre : [genre];
//     const genreIds = [];

//     for (const genreName of genreArray) {
//       const genreRecord = await genreModel.findOne({
//         where: { name: genreName },
//       });

//       if (genreRecord) {
//         genreIds.push(genreRecord.id);
//       }
//     }

//     if (genreIds.length > 0) {
//       // Add the genreIds to the query with OR condition
//       query.where = {
//         ...query.where,
//         Genre: { [Op.or]: genreIds },
//       };
//     }
//   }

//   if (wishlisted === "true" && userId) {
//     const wishlistEvents = await Wishlist.findAll({
//       where: { userId, isWishlisted: true },
//       attributes: ["eventId"],
//     });

//     const eventIds = wishlistEvents.map(
//       (wishlistEvent) => wishlistEvent.eventId
//     );

//     where.id = { [Op.in]: eventIds };
//   }

//   if (search_query) {
//     where[Op.or] = [
//       { title: { [Op.iLike]: `%${search_query}%` } },
//       { host: { [Op.iLike]: `%${search_query}%` } },
//     ];
//   }

//   if (page_number && page_size) {
//     const currentPage = parseInt(page_number, 10) || 1;
//     const limit = parseInt(page_size, 10) || 10;
//     const offset = (currentPage - 1) * limit;

//     query.offset = offset;
//     query.limit = limit;
//   }

//   console.log("Query", query);

//   const events = await eventModel.findAll(query);

//   // Add the isWishlisted field to each event
//   const eventsWithWishlist = await Promise.all(
//     events.map(async (event) => {
//       const isWishlisted = await Wishlist.findOne({
//         where: { userId, eventId: event.id, isWishlisted: true },
//       });

//       const isLiked = await Wishlist.findOne({
//         where: { userId, eventId: event.id, liked: true },
//       });
//       const isDisLiked = await Wishlist.findOne({
//         where: { userId, eventId: event.id, disliked: true },
//       });

//       const likesCount = await Wishlist.count({
//         where: { eventId: event.id, liked: true },
//       });
//       const dislikesCount = await Wishlist.count({
//         where: { eventId: event.id, disliked: true },
//       });

//       return {
//         ...event.toJSON(),
//         isWishlisted: !!isWishlisted,
//         isLiked: !!isLiked,
//         isDisLiked: !!isDisLiked,
//         likes_count: likesCount,
//         dislikes_count: dislikesCount,
//       };
//     })
//   );

//   res.status(200).json({ success: true, events: eventsWithWishlist });
// });

exports.getFollowingEvents = catchAsyncError(async (req, res, next) => {
  const { userId } = req;
  const { page_number, page_size, status, search_query } = req.query;

  let query = {
    order: [["createdAt", "DESC"]], // Order events by creation date in descending order
  };

  // if (status) {
  //   query.where = {
  //     status,
  //   };
  // }

  if (status) {
    if (status === "Live" || status === "Upcoming") {
      query.where = {
        status: status,
      };
    } else {
      query.where = {
        status: ["Upcoming", "Live"],
      };
    }
  }

  if (search_query) {
    if (query.where) {
      query.where = {
        [Op.and]: [
          query.where,
          {
            [Op.or]: [
              { title: { [Op.iLike]: `%${search_query}%` } },
              { host: { [Op.iLike]: `%${search_query}%` } },
            ],
          },
        ],
      };
    } else {
      query.where = {
        [Op.or]: [
          { title: { [Op.iLike]: `%${search_query}%` } },
          { host: { [Op.iLike]: `%${search_query}%` } },
        ],
      };
    }
  }

  if (page_number && page_size) {
    const currentPage = parseInt(page_number, 10) || 1;
    const limit = parseInt(page_size, 10) || 10;
    const offset = (currentPage - 1) * limit;

    query.offset = offset;
    query.limit = limit;
  }

  // Get the list of users that the current user is following
  const followingUsers = await userModel.findAll({
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

  // Extract the IDs of the following users
  const followingUserIds = followingUsers.map((user) => user.id);

  // Get events associated with the following users
  const following_events = await eventModel.findAll({
    where: {
      userId: {
        [Op.in]: followingUserIds,
      },
      ...query.where, // Merge with existing where conditions
    },
    ...query,
    include: [
      {
        model: genreModel,
        as: "genre",
        attributes: ["id", "name", "thumbnail"],
      },
      {
        model: userModel,
        as: "creator",
        attributes: ["id", "username", "avatar"],
      },
    ],
  });

  // Check if each event is wishlisted by the current user
  const formattedEvents = await Promise.all(
    following_events.map(async (event) => {
      const isWishlisted = await Wishlist.findOne({
        where: {
          userId,
          eventId: event.id,
          isWishlisted: true,
        },
        attributes: ["id"],
      });
      const isLiked = await Wishlist.findOne({
        where: { userId, eventId: event.id, liked: true },
      });
      const isDisLiked = await Wishlist.findOne({
        where: { userId, eventId: event.id, disliked: true },
      });

      const likesCount = await Wishlist.count({
        where: { eventId: event.id, liked: true },
      });
      const dislikesCount = await Wishlist.count({
        where: { eventId: event.id, disliked: true },
      });

      return {
        ...event.toJSON(),
        isWishlisted: !!isWishlisted, // Convert to boolean
        isLiked: !!isLiked,
        isDisLiked: !!isDisLiked,
        likes_count: likesCount,
        dislikes_count: dislikesCount,
      };
    })
  );

  res.status(StatusCodes.OK).json({ following_events: formattedEvents });
});

exports.getGenres = catchAsyncError(async (req, res) => {
  const genres = await genreModel.findAll({
    attributes: ["id", "name", "thumbnail"], // Select only id and name fields
  });
  res.status(200).json({ success: true, genres });
});

// Add new genre route which contains pagination with query
exports.getAllGenres = catchAsyncError(async (req, res, next) => {
  const { currentPage, resultPerPage, key } = req.query;
  const offset = (currentPage - 1) * resultPerPage;
  let whereClause = {};

  if (key && key.trim() !== "") {
    whereClause = {
      [Op.or]: [
        { name: { [Op.iLike]: `%${key}%` } }, // Assuming 'name' is the field to search for genres
      ],
    };
  }

  try {
    const { count, rows: genres } = await genreModel.findAndCountAll({
      where: whereClause,
      attributes: ["id", "name", "thumbnail"], // Select only id, name, and thumbnail fields
      limit: resultPerPage,
      offset: offset,
    });

    res.status(200).json({
      success: true,
      length: count,
      genres: genres,
    });
  } catch (error) {
    next(
      new ErrorHandler(
        "Failed to fetch genres",
        StatusCodes.INTERNAL_SERVER_ERROR
      )
    );
  }
});

// Add Single Genre route
exports.getSingleGenre = catchAsyncError(async (req, res, next) => {
  const { genreId } = req.params;

  const genre = await genreModel.findByPk(genreId);

  console.log(genre);

  if (!genre) {
    next(new ErrorHandler("Genre not found", StatusCodes.NOT_FOUND));
  }

  res.status(200).json({
    success: true,
    genre,
  });
});

exports.getMyUpcomingEvents = catchAsyncError(async (req, res, next) => {
  const { userId } = req; // Assuming user ID is stored in req.user
  const { page_number, page_size } = req.query;

  const today = new Date();
  const formattedToday = today.toISOString().split("T")[0];
  console.log(formattedToday);
  const currentPage = parseInt(page_number, 10) || 1;
  const limit = parseInt(page_size, 10) || 10;
  const offset = (currentPage - 1) * limit;

  const myUpcomingEvents = await eventModel.findAll({
    where: {
      userId: userId,
      status: "Upcoming",
    },
    attributes: ["id", "title", "event_date", "event_time", "thumbnail"],
    order: [["event_date", "ASC"]], // Order by event date ascending
    limit: limit,
    offset: offset,
  });

  res.status(200).json({ success: true, myUpcomingEvents });
});

exports.globalSearch = catchAsyncError(async (req, res, next) => {
  const { search_query, page_number, page_size } = req.query;
  const { userId } = req;
  // Define pagination parameters
  let query = {};
  if (page_number && page_size) {
    const currentPage = parseInt(page_number, 10) || 1;
    const limit = parseInt(page_size, 10) || 10;
    const offset = (currentPage - 1) * limit;

    query.offset = offset;
    query.limit = limit;
  }

  // Search users based on the search query
  const users = await userModel.findAll({
    where: {
      [Op.or]: [{ username: { [Op.iLike]: `%${search_query}%` } }],
    },
    ...query,
    attributes: ["id", "avatar", "username"],
  });

  // Search genres based on the search query
  const genres = await genreModel.findAll({
    where: {
      name: { [Op.iLike]: `%${search_query}%` },
    },
    ...query,
    attributes: ["id", "name", "thumbnail"],
  });

  // Search events based on the search query
  const events = await eventModel.findAll({
    where: {
      title: { [Op.iLike]: `%${search_query}%` },
      status: { [Op.or]: ["Upcoming", "Live"] },
    },
    ...query,
    attributes: [
      "id",
      "title",
      "event_date",
      "event_time",
      "thumbnail",
      "host",
      "status",
    ],
    include: [
      {
        model: genreModel,
        as: "genre",
        attributes: ["id", "name", "thumbnail"],
      },
      {
        model: userModel,
        as: "creator",
        attributes: ["id", "username", "avatar"],
        where: { deletedAt: null },
      },
    ],
  });

  const eventsWithWishlist = await Promise.all(
    events.map(async (event) => {
      const isWishlisted = await Wishlist.findOne({
        where: { userId, eventId: event.id, isWishlisted: true },
      });

      const isLiked = await Wishlist.findOne({
        where: { userId, eventId: event.id, liked: true },
      });
      const isDisLiked = await Wishlist.findOne({
        where: { userId, eventId: event.id, disliked: true },
      });

      const likesCount = await Wishlist.count({
        where: { eventId: event.id, liked: true },
      });
      const dislikesCount = await Wishlist.count({
        where: { eventId: event.id, disliked: true },
      });
      return {
        ...event.toJSON(),
        isWishlisted: !!isWishlisted,
        isLiked: !!isLiked,
        isDisLiked: !!isDisLiked,
        likes_count: likesCount,
        dislikes_count: dislikesCount,
      };
    })
  );

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

  const usersWithFollowing = users.map((user) => ({
    ...user.toJSON(),
    following: followingUserIds.includes(user.id),
  }));

  res.status(200).json({
    success: true,
    users: usersWithFollowing,
    genres: genres,
    events: eventsWithWishlist,
  });
});

exports.getUserEvents = catchAsyncError(async (req, res, next) => {
  console.log("Get Streamed Events");
  const { page_number, page_size, name, status } = req.query;
  const { userId: otherUserId } = req.params;
  const { userId: likedUserId } = req;
  let where = {
    userId: otherUserId,
  };

  if (name) {
    where.title = { [Op.iLike]: `%${name}%` };
  }

  if (status) {
    where.status = status;
  }

  const query = {
    where,
    include: [
      {
        model: genreModel,
        as: "genre",
        attributes: ["id", "name", "thumbnail"],
      },
      {
        model: userModel,
        as: "creator",
        attributes: ["id", "username", "avatar"],
        where: { deletedAt: null },
      },
    ],
  };

  if (page_number && page_size) {
    const currentPage = parseInt(page_number, 10) || 1;
    const limit = parseInt(page_size, 10) || 10;
    const offset = (currentPage - 1) * limit;

    query.offset = offset;
    query.limit = limit;
  }

  const events = await eventModel.findAll(query);

  const eventsWithWishlist = await Promise.all(
    events.map(async (event) => {
      const isWishlisted = await Wishlist.findOne({
        where: { userId: likedUserId, eventId: event.id, isWishlisted: true },
      });

      const isLiked = await Wishlist.findOne({
        where: { userId: likedUserId, eventId: event.id, liked: true },
      });
      const isDisLiked = await Wishlist.findOne({
        where: { userId: likedUserId, eventId: event.id, disliked: true },
      });

      const likesCount = await Wishlist.count({
        where: { eventId: event.id, liked: true },
      });
      const dislikesCount = await Wishlist.count({
        where: { eventId: event.id, disliked: true },
      });
      return {
        ...event.toJSON(),
        isWishlisted: !!isWishlisted,
        isLiked: !!isLiked,
        isDisLiked: !!isDisLiked,
        likes_count: likesCount,
        dislikes_count: dislikesCount,
      };
    })
  );

  res.status(StatusCodes.OK).json({ streamedEvents: eventsWithWishlist });
});

exports.getStreamedDetails = catchAsyncError(async (req, res, next) => {
  const { eventId } = req.params;

  console.log("eventId", eventId);

  const event = await eventModel.findOne({
    where: {
      id: eventId,
      status: "Completed",
    },
    include: [
      {
        model: genreModel,
        as: "genre",
        attributes: ["id", "name", "thumbnail"],
      },
      {
        model: userModel,
        as: "creator",
        attributes: ["id", "username", "avatar"],
        where: { deletedAt: null },
      },
    ],
  });

  if (!event) {
    return res
      .status(StatusCodes.NOT_FOUND)
      .json({ success: false, message: "Event not found" });
  }

  event.setDataValue("totalGuest", "500");
  event.setDataValue("comments", "1588");
  event.setDataValue("likes", "12454");
  event.setDataValue("dislikes", "314");
  event.setDataValue("dislikes", "314");
  event.setDataValue("totalAmount", 875242);
  event.setDataValue("commission", 245634);
  event.setDataValue("payStatus", "Success");
  event.setDataValue("payout", 631479);
  res.status(StatusCodes.OK).json({ success: true, event });
});

exports.getAllEvents = catchAsyncError(async (req, res, next) => {
  const { currentPage, resultPerPage, key, status } = req.query;
  const offset = (currentPage - 1) * resultPerPage;
  let whereClause = {};

  // Add status to whereClause if provided, otherwise return all events
  if (status && status.trim() !== "") {
    if (status === "Live") {
      whereClause = {
        ...whereClause,
        status: "Live",
      };
    }
    if (status === "Completed") {
      whereClause = {
        ...whereClause,
        status: "Completed",
      };
    }
    if (status === "Upcoming") {
      whereClause = {
        ...whereClause,
        status: "Upcoming",
      };
    }
  }

  if (key && key.trim() !== "") {
    whereClause = {
      ...whereClause,
      [Op.or]: [
        { title: { [Op.iLike]: `%${key}%` } }, // Assuming 'name' is the field to search for genres
      ],
    };
  }

  const { count, rows: events } = await eventModel.findAndCountAll({
    where: whereClause,
    limit: resultPerPage,
    offset: offset,
  });

  res.status(200).json({ success: true, length: count, events });
});

exports.getSingleEvent = catchAsyncError(async (req, res, next) => {
  const { eventId } = req.params;

  const event = await eventModel.findByPk(
    eventId
    //   {
    //   include: [
    //     {
    //       model: userModel,
    //       as: "creator",
    //       attributes: ["id", "username", "avatar"],
    //     },
    //   ],
    // }
  );

  if (!event) {
    return res
      .status(StatusCodes.NOT_FOUND)
      .json({ success: false, message: "Event not found" });
  }

  res.status(200).json({ success: true, event });
});

exports.getEventsWithStatus = catchAsyncError(async (req, res, next) => {
  const { status } = req.query;

  let whereClause = {};

  if (status === "Upcoming") {
    whereClause = { status: "Upcoming" };
  } else if (status === "Completed") {
    whereClause = { status: "Completed" };
  } else if (status === "Live") {
    whereClause = { status: "Live" };
  }

  const events = await eventModel.findAll({ where: whereClause });

  if (!events) {
    return res
      .status(StatusCodes.NOT_FOUND)
      .json({ success: false, message: "Events not found" });
  }

  res.status(200).json({ success: true, events });
});

// Go live event
exports.goLiveEvent = catchAsyncError(async (req, res, next) => {
  const { eventId } = req.params;
  const { userId } = req;

  const event = await eventModel.findByPk(eventId);
  console.log("runn");

  if (!event) {
    return res
      .status(StatusCodes.NOT_FOUND)
      .json({ message: "Event not found" });
  }

  if (event.userId !== userId) {
    return next(
      new ErrorHandler(
        "You are not authorized to access this event",
        StatusCodes.UNAUTHORIZED
      )
    );
  }

  const givenDate = event.event_date.toISOString();
  const givenTime = event.event_time;

  const combinedDateTimeString = `${givenDate.split("T")[0]}T${givenTime}`;
  const combinedDateTime = new Date(combinedDateTimeString);

  const fiveMinutesInMillis = 5 * 60 * 1000;
  const modifiedDateTime = new Date(
    combinedDateTime.getTime() - fiveMinutesInMillis
  );

  const currentTime = new Date();
  const addedTime = new Date(currentTime);
  addedTime.setHours(addedTime.getHours() + 5);
  addedTime.setMinutes(addedTime.getMinutes() + 30);
  console.log(addedTime);

  let canGoLive = false;

  if (modifiedDateTime <= addedTime) {
    canGoLive = true;
  }

  res.status(StatusCodes.OK).json({ success: true, goLive: canGoLive });
});

// add cancel event route
exports.cancelEvent = catchAsyncError(async (req, res, next) => {
  const { eventId } = req.params;
  const { userId } = req;

  const event = await eventModel.findByPk(eventId);

  if (!event) {
    return res
      .status(StatusCodes.NOT_FOUND)
      .json({ message: "Event not found" });
  }

  // Check if the event start time is more than 24 hours in the future
  const eventStartTime = new Date(event.event_date).getTime();
  const currentTime = new Date().getTime();
  const twentyFourHoursInMilliseconds = 24 * 60 * 60 * 1000;

  if (eventStartTime - currentTime <= twentyFourHoursInMilliseconds) {
    return next(
      new ErrorHandler(
        "Event cannot be canceled within 24 hours of start time",
        StatusCodes.BAD_GATEWAY
      )
    );
  }

  const user = await userModel.findByPk(userId);

  if (!user) {
    return next(new ErrorHandler("User not found", StatusCodes.NOT_FOUND));
  }

  const transaction = await Transaction.findOne({
    where: { eventId: eventId, userId: userId },
  });

  if (!transaction) {
    res
      .status(StatusCodes.OK)
      .json({ success: true, message: "You have not pay for this event" });
  }

  const refund = await refundAmountOnCancelEvent(user.customerId, eventId);

  if (refund.status === "succeeded") {
    const refunded = await Transaction.update(
      {
        charge: "refunded",
      },
      { where: { id: transaction.id } }
    );

    if (refunded) {
      const message = `Your refund has been processed for the Cancelled Event: ${event.title}.`;
      await createNotification(
        user.id,
        message,
        "Payment Refund",
        event.thumbnail
      );

      let token = user.fcm_token;
      console.log("Target user FCM token:", token);

      const fcmMessage = {
        notification: {
          title: "Payment Refund",
          body: message,
        },
        token,
        data: {
          type: "Payment Refund",
        },
      };

      try {
        await messaging.send(fcmMessage);
        console.log("Push notification sent successfully.");
      } catch (error) {
        // Handle error if FCM token is expired or invalid
        console.error("Error sending push notification:", error);
        // Log the error and proceed with the follow operation
      }
    }
  }

  res
    .status(StatusCodes.OK)
    .json({ success: true, message: "Event cancelled successfully" });
});

// create admin event update route
exports.adminUpdateEvent = catchAsyncError(async (req, res, next) => {
  const { eventId } = req.params;

  let event = await eventModel.findByPk(eventId);

  if (!event) {
    return res
      .status(StatusCodes.NOT_FOUND)
      .json({ message: "Event not found" });
  }

  // Update event fields
  let updateData = {};

  const thumbnailFile = req.file;

  console.log(thumbnailFile);

  if (thumbnailFile) {
    const imageUrl = await s3Uploadv2(thumbnailFile);
    updateData.thumbnail = imageUrl.Location;
  }

  // You can add more fields to update as needed
  const {
    title,
    host,
    event_date,
    event_time,
    spots,
    entry_fee,
    status,
    event_duration,
  } = req.body;

  if (title) updateData.title = title;
  if (host) updateData.host = host;
  if (event_date) updateData.event_date = event_date;
  if (event_time) updateData.event_time = event_time;
  if (spots) updateData.spots = spots;
  if (entry_fee) updateData.entry_fee = entry_fee;
  if (status) updateData.status = status;
  if (event_duration) updateData.event_duration = event_duration;

  // Update the event
  await event.update(updateData);

  console.log("eventtttttt", event);

  res
    .status(StatusCodes.OK)
    .json({ success: true, message: "Event updated successfully", event });
});

// admin delete events
exports.adminDeleteEvent = catchAsyncError(async (req, res, next) => {
  const { eventId } = req.params;

  const event = await eventModel.findByPk(eventId);

  // Check if event exists
  if (!event) {
    return res
      .status(StatusCodes.NOT_FOUND)
      .json({ success: false, message: "Event not found" });
  }

  // Delete the event
  await event.destroy();

  res
    .status(StatusCodes.OK)
    .json({ success: true, message: "Event deleted Successfully" });
});
