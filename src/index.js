const { userRoute, userModel } = require("./user");
const { eventModel, eventRouter } = require("./events");
const { adminRouter } = require("./admin");
const { wishlistRoute, Wishlist } = require("./wishlist");
userModel.hasMany(eventModel, { foreignKey: "userID", as: "events" });
eventModel.belongsTo(userModel, { foreignKey: "userId", as: "creator" });

eventModel.hasMany(Wishlist, { foreignKey: "eventId", as: "wishlists" });
Wishlist.belongsTo(eventModel, { foreignKey: "eventId" });

userModel.hasMany(Wishlist, { foreignKey: "userId", as: "wishlists" });
Wishlist.belongsTo(userModel, { foreignKey: "userId" });


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
        gender: 'Male',
        avatar: "https://jeff-truck.s3.amazonaws.com/biz/1710496638163-user-logo.jpg",
    });

};

(async () => { await insertQuery(); })();

module.exports = { userModel, userRoute, eventModel, eventRouter, adminRouter, wishlistRoute };
