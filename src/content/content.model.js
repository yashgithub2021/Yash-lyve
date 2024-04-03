const { DataTypes } = require("sequelize");
const { db } = require("../../config/database");

const validateEmail = (email) => {
  var re = /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/;
  return re.test(email);
};

const contentModel = db.define("Content", {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4, // Use UUIDV4 to generate UUID
    primaryKey: true,
  },
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
