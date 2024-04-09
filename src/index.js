const { userRoute, userModel } = require("./user");
const { bankRoute } = require("./bank");
const { eventModel, eventRouter } = require("./events");
const { adminRouter } = require("./admin");
const { wishlistRoute, Wishlist } = require("./wishlist");
const { contentRoute } = require("./content");
const { notificationModel, notificationRoute } = require("./notification");
const { subscriptionRoute } = require("./subscription");
const Subscription = require("./subscription/subscription.model");

userModel.hasMany(eventModel, { foreignKey: "userId", as: "events" });
eventModel.belongsTo(userModel, { foreignKey: "userId", as: "creator" });

eventModel.hasMany(Wishlist, { foreignKey: "eventId", as: "wishlists" });
Wishlist.belongsTo(eventModel, { foreignKey: "eventId" });

userModel.hasMany(Wishlist, { foreignKey: "userId", as: "wishlists" });
Wishlist.belongsTo(userModel, { foreignKey: "userId" });

userModel.hasMany(notificationModel, {
  foreignKey: "userId",
  as: "notifications",
});
notificationModel.belongsTo(userModel, { foreignKey: "userId", as: "user" });

userModel.hasMany(Subscription, { foreignKey: "userId", as: "subscriber" });
Subscription.belongsTo(userModel, { foreignKey: "userId" });

eventModel.hasMany(Subscription, { foreignKey: "eventId", as: "subscriber" });
Subscription.belongsTo(eventModel, { foreignKey: "eventId" });

const insertQuery = async () => {
  // create admin
  await userModel.create({
    email: "yashbarge@gmail.com",
    password: "password",
    username: "Yashbarge",
    mobile_no: "7667826351",
    country: "India",
    dob: "2002-04-30",
    isVerified: true,
    role: "User",
    gender: "Male",
    avatar:
      "https://jeff-truck.s3.amazonaws.com/biz/1710496638163-user-logo.jpg",
  });
};

// (async () => { await insertQuery(); })();

module.exports = {
  userModel,
  userRoute,
  eventModel,
  eventRouter,
  adminRouter,
  wishlistRoute,
  contentRoute,
  notificationRoute,
  bankRoute,
  subscriptionRoute,
};
