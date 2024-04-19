const firebase = require("firebase-admin");
const serviceAccount = require("./story-telling-5b135-firebase-adminsdk-mhpd4-a957a3193a.json");

firebase.initializeApp({
    credential: firebase.credential.cert(serviceAccount)
});

module.exports = { firebase };