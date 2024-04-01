const contentModel = require("./content.model");
const { createUpdateContent, getContent } = require("./content.controller");
const contentRoute = require("./content.route");

module.exports = { contentModel, getContent, createUpdateContent, contentRoute };
