const { DataTypes } = require("sequelize");
const { db } = require("../../config/database");
const { userModel } = require("../user");
const { eventModel } = require("../events/event.model");

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
    tableName: "subscription",
  }
);

// Define associations
Subscription.hasMany(userModel); // Each subscription belongs to a user
Subscription.hasMany(eventModel); // Each subscription belongs to an event

module.exports = Subscription;
