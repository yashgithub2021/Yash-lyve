const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const { db } = require("../../config/database");
const { DataTypes } = require("sequelize");

const validateEmail = (email) => {
  var re = /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/;
  return re.test(email);
};

const isDate = (date) => {
  return (
    date instanceof Date &&
    new Date(date) !== "Invalid Date" &&
    !isNaN(new Date(date))
  );
};

const random_profile = () => {
  const img_urls = [
    "https://cdn2.iconfinder.com/data/icons/avatars-60/5985/2-Boy-512.png",
    "https://cdn2.iconfinder.com/data/icons/avatars-60/5985/4-Writer-1024.png",
    "https://cdn2.iconfinder.com/data/icons/avatars-60/5985/40-School_boy-512.png",
    "https://cdn2.iconfinder.com/data/icons/avatars-60/5985/12-Delivery_Man-128.png",
    "https://cdn1.iconfinder.com/data/icons/user-pictures/100/boy-512.png",
  ];

  const idx = Math.floor(Math.random() * img_urls.length);
  return img_urls[idx];
};
const userModel = db.define(
  "User",
  {
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        notNull: { msg: "Email is required" },
        notEmpty: { msg: "Email is required" },
        isEmail: function (value) {
          if (value !== "" && !validateEmail(value)) {
            throw new Error("Invalid Email Address");
          }
        },
        isUnique: async function (value) {
          const existingUser = await userModel.findOne({
            where: {
              email: value,
              deletedAt: null,
            },
          });
          if (existingUser) {
            throw new Error("Email already in use!");
          }
        },
      },
    },
    password: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        len: {
          args: [8],
          msg: "Password must be at least 8 characters long",
        },
        notNull: { msg: "Password is Required" },
        notEmpty: { msg: "Password is Required" },
      },
    },
    username: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        notNull: { msg: "Username is required" },
        notEmpty: { msg: "Username is required" },
      },
    },
    mobile_no: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        notNull: { msg: "Phone is required" },
        notEmpty: { msg: "Phone is required" },
        isUnique: async function (value) {
          const existingUser = await userModel.findOne({
            where: {
              mobile_no: value,
              deletedAt: null,
            },
          });
          if (existingUser) {
            throw new Error("Email already in use!");
          }
        },
      },
    },
    country: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        notNull: { msg: "Country is required" },
        notEmpty: { msg: "Country is required" },
      },
    },
    dob: {
      type: DataTypes.DATE,
      validate: {
        isValidDate: function (value) {
          if (!value || !isDate(value)) {
            throw new Error("Empty or invalid date of birth.");
          }
        },
      },
    },
    isVerified: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    role: {
      type: DataTypes.ENUM("User", "Admin"),
      allowNull: false,
      validate: {
        isIn: {
          args: [["User", "Admin"]],
          msg: "Role must be one of: User, or Admin",
        },
      },
    },
    gender: {
      type: DataTypes.ENUM("Male", "Female"),
      allowNull: false,
      validate: {
        notNull: { msg: "Gender is required" },
        notEmpty: { msg: "Gender is required" },
      },
    },
    avatar: {
      type: DataTypes.STRING,
      defaultValue: random_profile(),
    },
  },
  {
    timestamps: true,
    paranoid: true,
    defaultScope: {
      attributes: { exclude: ["password"] },
    },
    scopes: {
      withPassword: {
        attributes: { include: ["password"] },
      },
    },
  }
);

userModel.beforeSave(async (user, options) => {
  if (user.changed("password")) {
    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(user.password, salt);
  }
});

userModel.prototype.getJWTToken = function () {
  return jwt.sign({ userId: this.id }, process.env.JWT_SECRET);
};

userModel.prototype.comparePassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

userModel.getUpdateFields = function (userData) {
  const attributes = Object.keys(this.getAttributes());
  const defaultFields = [
    "id",
    "createdAt",
    "updatedAt",
    "deletedAt",
    "password",
    "isVerified",
    "role",
  ];
  const updateFields = attributes.filter(
    (attribute) => !defaultFields.includes(attribute)
  );

  return Object.fromEntries(
    Object.entries(userData).filter(([key, value]) =>
      updateFields.includes(key)
    )
  );
};

const otpModel = db.define(
  "OTP",
  {
    otp: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        notNull: { msg: "OTP cannot be null." },
        notEmpty: { msg: "OTP cannot be empty." },
      },
    },
  },
  { timestamps: true }
);

otpModel.prototype.isValid = async function (givenOTP) {
  const user = await userModel.findByPk(this.userId);
  if (!user) return false;

  const otpValidityDuration = 15 * 60 * 1000;
  const currentTime = new Date().getTime();
  const otpCreationTime = new Date(this.createdAt).getTime();

  // Calculate the time difference between current time and OTP creation time
  const timeDifference = currentTime - otpCreationTime;

  // Check if the time difference is within the OTP validity duration
  return timeDifference <= otpValidityDuration;
};

userModel.hasOne(otpModel, { foreignKey: "userId", as: "otp" });
otpModel.belongsTo(userModel, { foreignKey: "userId", as: "user" });

userModel.belongsToMany(userModel, {
  foreignKey: "following_user_id",
  as: "followers",
  through: "Follow",
});
userModel.belongsToMany(userModel, {
  foreignKey: "follower_user_id",
  as: "following",
  through: "Follow",
});

module.exports = { userModel, otpModel };
