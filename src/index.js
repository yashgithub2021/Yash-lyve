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
    customer_id: "cus_Q4fMSgjkSa2Dsl",
    transaction_id: "pi_3PEmzeLb055EzjLn2CdTRIcz",
    payment_amount: 10000,
    payment_gateway: "card",
    payment_status: "succeeded",
    charge: "",
    bank_account_id: "acct_1PEWCmPrFCpD1elt",
    createdAt: "2024-05-10 06:32:14.813+00",
    updatedAt: "2024-05-10 06:32:14.813+00",
    eventId: "04575056-e26f-4f35-931d-a44c54b2c929",
    userId: "8bc5106d-6f48-4275-ac9c-f7354d8be375",
  });
};

// (async () => {
//   await insertQuery();
// })();

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
