const { DataTypes } = require("sequelize");
const { db } = require("../../config/database");

const Wishlist = db.define("Wishlist", {
  isWishlisted: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  liked: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  disliked: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  paymentStatus: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
}, {
  timestamps: true,
  tableName: "wishlist"
}
);

module.exports = { Wishlist };
