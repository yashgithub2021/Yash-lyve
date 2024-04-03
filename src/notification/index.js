const notificationModel = require('./notification.model');
const { getAllNotification, getNotification, updateNotification, deleteNotification } = require('./notification.controller');
const notificationRoute = require('./notification.route');

module.exports = { notificationModel, getAllNotification, getNotification, updateNotification, deleteNotification, notificationRoute };