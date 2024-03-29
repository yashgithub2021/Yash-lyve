const { db } = require("../../config/database");
const { DataTypes } = require("sequelize");

const isDate = (date) => {
  return (
    date instanceof Date &&
    new Date(date) !== "Invalid Date" &&
    !isNaN(new Date(date))
  );
};

function isTime(time) {
  // Regular expression to match the time format HH:MM:SS
  const timeRegex = /^(?:[01]\d|2[0-3]):(?:[0-5]\d):(?:[0-5]\d)$/;

  // Check if the time matches the regex pattern
  if (!timeRegex.test(time)) {
    return false; // Time format is invalid
  }

  // Split the time string into hours, minutes, and seconds
  const [hours, minutes, seconds] = time.split(":");

  // Convert hours, minutes, and seconds to integers
  const hoursInt = parseInt(hours, 10);
  const minutesInt = parseInt(minutes, 10);
  const secondsInt = parseInt(seconds, 10);

  // Check if hours, minutes, and seconds are within valid ranges
  if (
    hoursInt < 0 ||
    hoursInt > 23 ||
    minutesInt < 0 ||
    minutesInt > 59 ||
    secondsInt < 0 ||
    secondsInt > 59
  ) {
    return false; // Time values are out of range
  }

  return true; // Time is valid
}

const eventModel = db.define(
  "Event",
  {
    title: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        notNull: { msg: "Event title can't Be null" },
        notEmpty: { msg: "Event title can't Be null" },
      },
    },
    host: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        notNull: { msg: "Host name can't be null" },
        notEmpty: { msg: "Host name can't be null" },
      },
    },
    event_date: {
      type: DataTypes.DATE,
      allowNull: false,
      validate: {
        isValidDate: function (value) {
          if (!value || !isDate(value)) {
            throw new Error("Empty or invalid event date");
          }
        },
      },
    },
    event_time: {
      type: DataTypes.TIME,
      allowNull: false,
      validate: {
        isValidTime: function (value) {
          if (!value || !isTime(value)) {
            throw new Error("Invalid time");
          }
        },
      },
    },
    spots: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    entry_fee: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: {
        notNull: { msg: "Spots can't be null" },
        notEmpty: { msg: "Spots can't be null" },
      },
    },
    status: {
      type: DataTypes.ENUM("Upcoming", "Live", "Completed"),
      allowNull: false,
      validate: {
        isIn: {
          args: [["Upcoming", "Live", "Completed"]],
          msg: "Status must be one of: Upcoming, Live or Completed",
        },
      },
    },
    event_duration: {
      type: DataTypes.TIME,
      allowNull: false,
      validate: {
        isValidTime: function (value) {
          if (!value || !isTime(value)) {
            throw new Error("Invalid time");
          }
        },
      },
    },
    thumbnail: {
      type: DataTypes.STRING,
      defaultValue: "none",
    },
  },
  { timestamps: true }
);

const genreModel = db.define("Genre", {
  name: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: {
      args: true,
      msg: "Genre name should be unique",
    },
    validate: {
      notNull: { msg: "Genre name can't be empty" },
      notEmpty: { msg: "Genre name can't be empty" },
    },
  },
  thumbnail: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      notNull: { msg: "Thumbnail can't be empty" },
      notEmpty: { msg: "Thumbnail can't be empty" },
    },
  },
});

genreModel.hasMany(eventModel, { foreignKey: "Genre", as: "event" });
eventModel.belongsTo(genreModel, { foreignKey: "Genre", as: "genre" });

module.exports = { eventModel, genreModel };
