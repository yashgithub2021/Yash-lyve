const { DataTypes } = require("sequelize");
const { db } = require("../../config/database");

//user and event
const Subscription = db.define(
  "Subscription",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4, // Use UUIDV4 to generate UUID
      primaryKey: true,
    },
    status: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = Subscription;
