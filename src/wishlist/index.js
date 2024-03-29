const { Wishlist } = require("./wishlist.model");
const wishlistController = require("./wishlist.controller");
const wishlistRoute = require("./wishlist.route");
module.exports = { Wishlist, wishlistController, wishlistRoute };