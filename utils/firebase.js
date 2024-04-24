const firebase = require("firebase-admin");
const serviceAccount = require("./lyvechat-ad622-firebase-adminsdk-v265h-92afa42a40.json");

firebase.initializeApp({
    credential: firebase.credential.cert(serviceAccount)
});

module.exports = { firebase };