const { DataTypes } = require("sequelize");
const { db } = require("../../config/database");

const validateEmail = (email) => {
  var re = /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/;
  return re.test(email);
};

const contentModel = db.define("Content", {
  title: {
    type: DataTypes.ENUM("TERMS_AND_CONDITIONS", "PRIVACY_POLICY"),
    allowNull: false
  },
  desc: {
    type: DataTypes.TEXT,
    allowNull: false
  }
}, { timestamps: true });

module.exports = contentModel;
