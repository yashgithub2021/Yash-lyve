const { userRoute, userModel } = require("./user");
const { bankRoute } = require("./bank");
const { eventModel, eventRouter } = require("./events");
const { adminRouter } = require("./admin");
const { wishlistRoute, Wishlist } = require("./wishlist");
const { contentRoute } = require("./content");
const { notificationModel, notificationRoute } = require("./notification");
const { subscriptionRoute } = require("./subscription");
const Subscription = require("./subscription/subscription.model");
const { transactionRoute } = require("./transactions");
const Transaction = require("./transactions/transaction.model");

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

userModel.hasMany(Subscription, { foreignKey: "userId", as: "user" });
Subscription.belongsTo(userModel, { foreignKey: "userId", as: "subscriber" });

eventModel.hasMany(Subscription, { foreignKey: "eventId", as: "event" });
Subscription.belongsTo(eventModel, {
  foreignKey: "eventId",
  as: "subscribed_event",
});

eventModel.hasMany(Transaction, { foreignKey: "eventId", as: "Transaction" });
Transaction.belongsTo(eventModel, { foreignKey: "eventId", as: "event" });

userModel.hasMany(Transaction, { foreignKey: "userId", as: "Transaction" });
Transaction.belongsTo(userModel, { foreignKey: "userId", as: "user" });
// userModel.hasMany(Transaction, { foreignKey: "userId", as: "user" });
// Transaction.belongsTo(userModel, {
//   foreignKey: "userId",
//   as: "user_transactions",
// });

// eventModel.hasMany(Transaction, { foreignKey: "eventId", as: "event" });
// Transaction.belongsTo(eventModel, { foreignKey: "eventId", as: "transaction" });

const insertQuery = async () => {
  // create admin
  // await userModel.create({
  //   email: "yashbarge@gmail.com",
  //   password: "password",
  //   username: "Yashbarge",
  //   mobile_no: "7667826351",
  //   country: "India",
  //   dob: "2002-04-30",
  //   isVerified: true,
  //   role: "User",
  //   gender: "Male",
  //   avatar:
  //     "https://jeff-truck.s3.amazonaws.com/biz/1710496638163-user-logo.jpg",
  // });

  await Transaction.create({
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
  transactionRoute,
};
