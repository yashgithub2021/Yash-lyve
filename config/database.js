const { Sequelize } = require("sequelize");
const database = process.env.DATABASE;
const username = process.env.USER;
const password = process.env.PASSWORD;
const dialect = process.env.DIALECT;
const host = process.env.HOST;
console.log({ database, username, password, host, dialect });

// const sequelize = new Sequelize(process.env.URI);
const sequelize = new Sequelize(database, username, password, {
  host,
  dialect,
});
// const sequelize = new Sequelize({
//   dialect: "sqlite",
//   storage: "../employee.db",
// });

module.exports = {
  connectDatabase: async () => {
    try {
      sequelize.sync();
      // sequelize.sync({ force: true });
      // await sequelize.authenticate();
      console.log("Connection has been established successfully.");
    } catch (error) {
      console.error("Unable to connect to the database:", error);
    }
  },
  db: sequelize,
};
