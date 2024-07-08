const cron = require('node-cron');
const { Op, Sequelize } = require('sequelize');
const { eventModel, userModel } = require('../src/index');
const { firebase } = require("./firebase");
const messaging = firebase.messaging();
const moment = require('moment-timezone');
const { notificationModel } = require('../src/notification');

const createNotification = async (userId, text, title, thumbnail) => {
    await notificationModel.create({ userId, text, title, thumbnail });
    console.log("Notification created successfully");
};

async function sendNotification() {
    try {
        // Set the timezone to Indian Standard Time
        const timezone = 'Asia/Kolkata';
        const currentTime = moment().tz(timezone);
        const targetTime = currentTime.clone().add(30, 'minutes');

        const targetTimeTime = targetTime.format('HH:mm:ss');
        const formattedCurrentTime = currentTime.format('YYYY-MM-DD HH:mm:ss');
        const formattedTargetTime = targetTime.format('YYYY-MM-DD HH:mm:ss');

        console.log(`Current Time: ${formattedCurrentTime} ${timezone}`);
        console.log(`Target Time: ${formattedTargetTime} ${timezone}`);

        // Fetch upcoming events that are exactly 30 minutes away
        const upcomingEvents = await eventModel.findAll({
            where: {
                status: 'Upcoming',
                event_date: {
                    [Op.gte]: moment().subtract(1, 'days').toDate()
                },
                event_time: targetTimeTime
            },
            include: [{
                model: userModel,
                as: 'creator',
                attributes: ['id', 'fcm_token'],
                where: {
                    fcm_token: {
                        [Op.not]: null
                    }
                }
            }]
        });

        if (upcomingEvents.length === 0) {
            console.log('No events starting in exactly 30 minutes.');
            return;
        }

        const notifications = upcomingEvents.map(event => {
            const message = {
                notification: {
                    title: 'Event Reminder!',
                    body: `Don't forget to go live! Your event ${event.title} starts in 30 minutes.`
                },
                token: event.creator.fcm_token
            };
            return messaging.send(message).then(() => {
                return createNotification(event.userId, message.notification.body, message.notification.title, event.thumbnail);
            });
        });

        await Promise.all(notifications);
        console.log('Notifications sent for events starting in exactly 30 minutes.');
    } catch (error) {
        console.error('Error sending notifications:', error);
    }
}
// Schedule the job to run every minute
exports.cronJobs = () => {
    cron.schedule('* * * * *', () => {
        console.log('Running the notification job...');
        sendNotification();
    });
}
