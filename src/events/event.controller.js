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

exports.createEvent = catchAsyncError(async (req, res, next) => {
  console.log("Create event", req.body);
  const { userId } = req;
  const { genre } = req.body;
  const genreReq = await genreModel.findOne({ where: { name: genre } });
  const creator = await userModel.findByPk(userId);

  if (!genreReq)
    return next(
      new ErrorHandler("Genre not found", StatusCodes.NOT_FOUND)
    );


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
  await event.setCreator(creator)

  const newEvent = await eventModel.findByPk(event.id, {
    include: [
      { model: genreModel, as: "genre", attributes: ["id", "name"] },
    ],
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
    return res.status(StatusCodes.NOT_FOUND).json({ success: false, message: "Event not found" });
  }

  // Check if the current user is the creator of the event
  if (event.userId !== userId) {
    return res.status(StatusCodes.FORBIDDEN).json({ success: false, message: "Unauthorized" });
  }

  // Delete the event
  await event.destroy();

  res
    .status(StatusCodes.OK)
    .json({ success: true, message: "Event deleted Successfully" });
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
  res.status(StatusCodes.CREATED).json({ genre });
});

exports.getUpcomingEvents = catchAsyncError(async (req, res, next) => {
  const { userId } = req;

  const upcomingEvents = await eventModel.findAll({
    where: {
      [Op.or]: [{}, {}],
    },
  });
});

exports.getRecommendedEvents = catchAsyncError(async (req, res, next) => {

  const { userId } = req
  // Fetch all events ordered by createdAt in descending order
  const allEvents = await eventModel.findAll({
    order: [["createdAt", "DESC"]],
    include: [
      { model: genreModel, as: "genre", attributes: ["id", "name", "thumbnail"] },
      { model: userModel, as: "creator", attributes: ["id", "username", "avatar"], where: { deletedAt: null } },
    ],
  });

  const eventsWithWishlist = await Promise.all(allEvents.map(async (event) => {
    const isWishlisted = await Wishlist.findOne({
      where: { userId, eventId: event.id, isWishlisted: true },
    });

    const isLiked = await Wishlist.findOne({
      where: { userId, eventId: event.id, liked: true },
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
      likes_count: likesCount,
      dislikes_count: dislikesCount,
    };
  }));

  res.status(StatusCodes.OK).json({ recommendedEvents: eventsWithWishlist });
})

exports.getEvents = catchAsyncError(async (req, res, next) => {
  const { status, page_number, page_size, genre, wishlisted, search_query } = req.query;
  const { userId } = req;

  let where = {};
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
    order: [['createdAt', 'DESC']],
  };

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

    const eventIds = wishlistEvents.map((wishlistEvent) => wishlistEvent.eventId);

    where.id = { [Op.in]: eventIds };
  }

  if (search_query) {
    where[Op.or] = [
      { title: { [Op.iLike]: `%${search_query}%` } },
      { host: { [Op.iLike]: `%${search_query}%` } },
    ];
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
  const eventsWithWishlist = await Promise.all(events.map(async (event) => {
    const isWishlisted = await Wishlist.findOne({
      where: { userId, eventId: event.id, isWishlisted: true },
    });

    const isLiked = await Wishlist.findOne({
      where: { userId, eventId: event.id, liked: true },
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
      likes_count: likesCount,
      dislikes_count: dislikesCount,
    };
  }));

  res.status(200).json({ success: true, events: eventsWithWishlist });
});


exports.getFollowingEvents = catchAsyncError(async (req, res, next) => {
  const { userId } = req;
  const { page_number, page_size, status, search_query } = req.query;

  let query = {
    order: [["createdAt", "DESC"]], // Order events by creation date in descending order
  };

  if (status) {
    query.where = {
      status,
    };
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
          WHERE "follower_user_id" = ${userId}
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
  const formattedEvents = await Promise.all(following_events.map(async (event) => {
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
      likes_count: likesCount,
      dislikes_count: dislikesCount,
    };
  }));

  res.status(StatusCodes.OK).json({ following_events: formattedEvents });
});




exports.getGenres = catchAsyncError(async (req, res) => {

  const genres = await genreModel.findAll({
    attributes: ['id', 'name', 'thumbnail'], // Select only id and name fields
  });
  res.status(200).json({ success: true, genres });

});

exports.getMyUpcomingEvents = catchAsyncError(async (req, res, next) => {
  const { userId } = req; // Assuming user ID is stored in req.user
  const { page_number, page_size } = req.query;

  const today = new Date();
  const formattedToday = today.toISOString().split('T')[0];
  console.log(formattedToday)
  const currentPage = parseInt(page_number, 10) || 1;
  const limit = parseInt(page_size, 10) || 10;
  const offset = (currentPage - 1) * limit;

  const myUpcomingEvents = await eventModel.findAll({
    where: {
      userId: userId,
      event_date: { [Op.gt]: today },
    },
    attributes: ["id", "title", "event_date", "thumbnail"],
    order: [['event_date', 'ASC']], // Order by event date ascending
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
      [Op.or]: [
        { username: { [Op.iLike]: `%${search_query}%` } },
      ],

    },
    ...query,
    attributes: ['id', 'avatar', 'username'],
  });

  // Search genres based on the search query
  const genres = await genreModel.findAll({
    where: {
      name: { [Op.iLike]: `%${search_query}%` },
    },
    ...query,
    attributes: ['id', 'name', 'thumbnail'],
  });

  // Search events based on the search query
  const events = await eventModel.findAll({
    where: {
      title: { [Op.iLike]: `%${search_query}%` },
    },
    ...query,
    attributes: ['id', 'title', 'event_date', "thumbnail", "host", "status",],
    include: [
      {
        model: genreModel,
        as: 'genre',
        attributes: ["id", "name", "thumbnail"],
      },
      {
        model: userModel,
        as: "creator",
        attributes: ["id", "username", "avatar"],
        where: { deletedAt: null }
      }
    ],
  });

  const eventsWithWishlist = await Promise.all(events.map(async (event) => {
    const isWishlisted = await Wishlist.findOne({
      where: { userId, eventId: event.id, isWishlisted: true },
    });

    const isLiked = await Wishlist.findOne({
      where: { userId, eventId: event.id, liked: true },
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
      likes_count: likesCount,
      dislikes_count: dislikesCount,
    };
  }));

  const userFollowing = await userModel.findAll({
    where: {
      id: {
        [Op.in]: db.literal(`(
          SELECT "following_user_id" 
          FROM "Follow" 
          WHERE "follower_user_id" = ${userId}
        )`)
      },
    },
  })

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

exports.getStreamedEvents = catchAsyncError(async (req, res, next) => {
  console.log("Get Streamed Events");
  const { page_number, page_size, name } = req.query;
  const { userId } = req.params;

  let where = {
    userId: userId,
    status: "Completed",
  };

  if (name) {
    where.title = { [Op.iLike]: `%${name}%` };
  }

  const query = {
    where,
    attributes: ["id", "title", "thumbnail"],
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

  res.status(StatusCodes.OK).json({ streamedEvents: events });
});

exports.getStreamedDetails = catchAsyncError(async (req, res, next) => {
  const { eventId } = req.params;

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
    return res.status(StatusCodes.NOT_FOUND).json({ message: "Event not found" });
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
  res.status(StatusCodes.OK).json({ eventDetails: event });
});
