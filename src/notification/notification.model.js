const { DataTypes } = require("sequelize");
const { db } = require("../../config/database");

const notificationModel = db.define(
  "Notification",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    title: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        notEmpty: { msg: "Notification title can't be empty." },
        notNull: { msg: "Notification title can't be null." },
      },
    },
    text: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        notEmpty: { msg: "Notification Text can't be empty." },
        notNull: { msg: "Notification Text can't be null." },
      },
    },
    date: {
      type: DataTypes.DATE,
      defaultValue: () => new Date(Date.now() + 330 * 60 * 1000),
    },
    userAvatar: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    seen: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
  },
  { timestamps: true }
);

module.exports = notificationModel;
