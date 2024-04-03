const catchAsyncError = require("../../utils/catchAsyncError");
const { Wishlist } = require("./wishlist.model");
const { notificationModel } = require("../notification");
const { eventModel } = require("../events/event.model");
const { userModel } = require("../user");
const { StatusCodes } = require("http-status-codes");


const createNotification = async (userId, text, title) => {
    await notificationModel.create({ userId, text, title });
    console.log("Notification created successfully");
};


const addLikeToEvent = async (userId, eventId) => {
    try {
        // Check if the user has already liked the event
        const existingLike = await Wishlist.findOne({
            where: {
                userId,
                eventId,
            },
        });
        console.log(userId, eventId, existingLike)

        // If the user has already liked the event, do nothing
        if (existingLike) {
            if (!existingLike.liked) {
                // Create or update the like status in the Wishlist table
                existingLike.liked = true;
                existingLike.disliked = false;

                await existingLike.save()
            }
        }
        else {
            await Wishlist.create({ userId, eventId, liked: true, disliked: false })
        }

        console.log("Like added to event successfully");
    } catch (error) {
        console.error("Error adding like to event:", error);
        throw new Error(error.message);
    }
};
const addDislikeToEvent = async (userId, eventId) => {
    try {
        // Check if the user has already liked the event
        const existingLike = await Wishlist.findOne({
            where: {
                userId,
                eventId,
            },
        });
        console.log(userId, eventId, existingLike)

        // If the user has already liked the event, do nothing
        if (existingLike) {
            if (!existingLike.disliked) {
                // Create or update the like status in the Wishlist table
                existingLike.liked = false;
                existingLike.disliked = true;

                await existingLike.save()
            }
        }
        else {
            await Wishlist.create({ userId, eventId, liked: false, disliked: true })
        }

        console.log("Dislike added to event successfully");
    } catch (error) {
        console.error("Error adding like to event:", error);
        throw new Error(error.message);
    }
};
const handleEventWishlist = async (userId, eventId) => {
    try {
        // Check if the user has already added the event to their wishlist
        const existingWishlist = await Wishlist.findOne({
            where: {
                userId,
                eventId,
            },
        });

        let isWishlisted = true; // Default to true, meaning adding to wishlist
        if (existingWishlist) {
            // If the event is already wishlisted, remove it
            isWishlisted = !existingWishlist.isWishlisted;
            existingWishlist.isWishlisted = isWishlisted;
            await existingWishlist.save();
        } else {
            // If no entry exists, create a new entry in the Wishlist table
            await Wishlist.create({ userId, eventId, isWishlisted });
        }

        if (isWishlisted) {
            console.log("Event added to wishlist successfully");
        } else {
            console.log("Event removed from wishlist successfully");
        }
    } catch (error) {
        console.error("Error updating event wishlist status:", error);
        throw new Error(error.message);
    }
};

exports.likeEvent = catchAsyncError(async (req, res) => {
    const { userId } = req;
    const { eventId } = req.params;

    // Get the event details to find its creator
    const event = await eventModel.findByPk(eventId);
    console.log("Event:", event);

    if (!event || event === undefined) {
        return res.status(StatusCodes.NOT_FOUND).json({ message: "Event not found" });
    }
    const user = await userModel.findByPk(userId);
    if (!user) {
        return res.status(StatusCodes.NOT_FOUND).json({ message: "User not found" });
    }
    await addLikeToEvent(userId, eventId);

    const eventCreatorId = event.userId;
    const message = `${user.username} liked your event: ${event.title}`;
    await createNotification(eventCreatorId, message, "like");

    res.status(StatusCodes.OK).json({ success: true, message: "Like added to event" });
});


exports.wishlistEvent = catchAsyncError(async (req, res) => {
    const { userId } = req;
    const { eventId } = req.params;

    await handleEventWishlist(userId, eventId);
    res.status(200).json({ success: true, message: "Event Wishlist Updated" });

});

exports.dislikeEvent = catchAsyncError(async (req, res) => {
    const { userId } = req;
    const { eventId } = req.params;

    await addDislikeToEvent(userId, eventId);
    res.status(200).json({ success: true, message: "Event Disliked" });

});

