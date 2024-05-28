const secret_key = process.env.STRIPE_SECRET_KEY;
const stripe = require("stripe")(secret_key);
const { eventModel } = require("../src/events/event.model");
const { userModel } = require("../src/user/index");
const Transaction = require("../src/transactions/transaction.model");
const express = require("express");
const { firebase } = require("./firebase");
const messaging = firebase.messaging();

const router = express.Router();

// create customer on stripe
const createStripeCustomers = async (email, username) => {
  const stripeAddress = {
    line1: "asdsadsad",
    line2: "dasadsads",
    city: "userAddress.city",
    country: "US",
    postal_code: "123456",
    state: "userAddress.state",
  };

  return new Promise(async (resolve, reject) => {
    try {
      const stripeCustomer = await stripe.customers.create({
        email: email,
        name: username,
        description: "userData.description",
        phone: "1234567890",
        address: stripeAddress,
      });
      resolve(stripeCustomer.id);
    } catch (error) {
      reject(error.message);
    }
  });
};

// Add payment Intent
const createPaymentIntent = async (event, user) => {
  // console.log("Datavalues", event.dataValues);
  const amount = event.entry_fee;
  const title = event.title;
  const accountId = event.creator.bank_account_id;

  try {
    const ephemeralKey = await stripe.ephemeralKeys.create(
      { customer: user.customerId },
      { apiVersion: "2024-04-10" }
    );

    const paymentIntent = await stripe.paymentIntents.create({
      amount: amount * 100, // Amount in cents
      currency: "usd",
      description: "Software development services",
      customer: user.customerId,
      metadata: {
        eventName: title,
        eventDate: event.event_date,
        eventTime: event.event_time,
        eventId: event.id,
        userId: user.id,
        thumbnail: event.thumbnail,
        amount: event.entry_fee,
        customerName: user.username,
        customerId: user.customerId,
        accountId: accountId,
      },
      payment_method_types: ["card"],
    });
    return {
      client_secret: paymentIntent.client_secret,
      ephemeral_keys: ephemeralKey.secret,
      customer: user.customerId,
      pusblishable_secret:
        "pk_test_51P9MZeLb055EzjLnwkZnATncBINTCbGXltCKhAyWhgnLmcaY4PehxuQaKhk5DQned7SPmCzdgRZfj4MTux0INRSg00vOH5uxP4",
    };
  } catch (error) {
    console.log(error);
    throw Error("Unable to create client secret", error.message);
  }
};

//Webhook route
router.post(
  "/webhook",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    let data;
    let eventType;

    // Check if webhook signing is configured.
    let webhookSecret;
    webhookSecret = process.env.WEBHOOK_SECRET;

    if (webhookSecret) {
      // Retrieve the event by verifying the signature using the raw body and secret.
      let event;
      let signature = req.headers["stripe-signature"];
      const payload = req.body;

      try {
        event = stripe.webhooks.constructEvent(
          payload,
          signature,
          webhookSecret
        );

        console.log("webhook verified", event);
      } catch (err) {
        return res.status(400).json({ error: `Webhook Error: ${err.message}` });
      }
      // Extract the object from the event.
      data = event.data.object;
      eventType = event.type;
    } else {
      // Webhook signing is recommended, but if the secret is not configured in `config.js`,
      // retrieve the event data directly from the request body.
      data = req.body.data.object;
      eventType = req.body.type;
    }

    // Handle the payment_intent.succeeded event
    if (eventType === "payment_intent.succeeded") {
      stripe.customers
        .retrieve(data.customer)
        .then(async (customer) => {
          try {
            // CREATE ORDER
            createTransaction(customer, data, "");
            console.log("da", data);
            console.log("userrrrrrridddd", data.metadata.userId);
            userId = data.metadata.userId;
            user = await userModel.findByPk(userId);
            let token = user.fcm_token;
            const fcmMessage = {
              notification: {
                title: "Payment Confirmation",
                body: `Your payment for the live event has been successfully processed. Enjoy the stream!`,
              },
              token,
              data: {
                type: "Payment Confirmation",
              },
            };

            try {
              await messaging.send(fcmMessage);
              console.log("Push notification sent successfully.");
            } catch (error) {
              // Handle error if FCM token is expired or invalid
              console.error("Error sending push notification:", error);
              // Log the error and proceed with the follow operation
            }
          } catch (err) {
            console.log(err);
          }
        })
        .catch((err) => console.log(err.message));
    }

    // Handle the payment_intent.canceled event
    if (eventType === "payment_intent.canceled") {
      stripe.customers
        .retrieve(data.customer)
        .then(async (customer) => {
          try {
            // CREATE ORDER
            createTransaction(customer, data, "");
            // console.log("data", data);
          } catch (err) {
            console.log(err);
          }
        })
        .catch((err) => console.log(err.message));
    }

    // Handle the payment_intent.processing event
    if (eventType === "payment_intent.processing") {
      stripe.customers
        .retrieve(data.customer)
        .then(async (customer) => {
          try {
            createTransaction(customer, data, "");
            // console.log("data", data);
          } catch (err) {
            console.log(err);
          }
        })
        .catch((err) => console.log(err.message));
    }
    res.status(200).end();
  }
);

// ====================== Bank details methods ========================

// Add bank details on stripe
const addBankDetails = async (country, email, customerId) => {
  try {
    const connect = await stripe.accounts.create({
      country: country,
      metadata: {
        customerId: customerId,
      },
      individual: {
        email: email,
      },
      type: "express",
      capabilities: {
        card_payments: {
          requested: true,
        },
        transfers: {
          requested: true,
        },
      },
      business_type: "individual",
      business_profile: {
        url: "https://lyvechat.com",
      },
    });

    await stripe.accounts.listExternalAccounts(connect.id);

    const account = await stripe.accountLinks.create({
      account: connect.id,
      refresh_url: "https://example.com/reauth",
      return_url: "https://example.com/return",
      type: "account_onboarding",
    });

    return {
      accountId: connect.id,
      accountLink: account,
    };
  } catch (error) {
    console.error("Error creating account:", error);
    throw new Error(error.message);
  }
};

// Get bank details
const getBankDetails = async () => {
  try {
    const retrieveBank = await stripe.accounts.list();

    if (!retrieveBank) {
      throw new Error("Bank account does not exist");
    }

    return retrieveBank;
  } catch (error) {
    console.log(error);
    throw new Error(error.message);
  }
};

// Delete bank details on stripe
const deleteBankDetails = async (bankAccountId) => {
  try {
    const deleted = await stripe.accounts.del(bankAccountId);

    return deleted;
  } catch (error) {
    console.log(error);
    throw new Error(error.message);
  }
};

// Generate login link stripe
const generateLoginLink = async (bankAccountId) => {
  try {
    const login = await stripe.accounts.createLoginLink(bankAccountId);

    return login;
  } catch (error) {
    console.log(error);
    throw new Error(error.message);
  }
};

// pay 60% commission to the creator
const payCommission = async (
  totalAmount,
  accountId,
  eventId,
  title,
  event_thumbnail,
  event_date,
  event_time,
  event_status,
  userId,
  username,
  avatar
) => {
  return new Promise(async (resolve, reject) => {
    // console.log("idd", accountId, typeof accountId);
    try {
      const transfer = await stripe.transfers.create({
        amount: totalAmount,
        currency: "usd",
        destination: accountId,
        description: "Transfer to event creator",
        metadata: {
          eventId: eventId,
          eventName: title,
          thumbnail: event_thumbnail,
          eventDate: event_date,
          eventTime: event_time,
          eventStatus: event_status,
          userId: userId,
          userName: username,
          avatar: avatar,
          amount: totalAmount,
        },
      });
      resolve(transfer);
    } catch (error) {
      console.error("Error creating transfer:", error);
      reject(error.message);
    }
  });
};

// Function to retrieve Payment Intents associated with a customer
const getPaymentIntentsByCustomer = async (customerId, eventId) => {
  return new Promise(async (resolve, reject) => {
    try {
      const paymentIntents = await stripe.paymentIntents.list({
        customer: customerId,
      });

      let amount;
      // let intentId;
      let paymentIntentId;

      paymentIntents.data.forEach(async (paymentIntent) => {
        if (
          paymentIntent &&
          paymentIntent.metadata.eventId === eventId &&
          paymentIntent.status === "succeeded"
        ) {
          paymentIntentId = paymentIntent.id;
          amount = paymentIntent.amount;
        }
      });

      // const charges = await stripe.charges.list({
      //   payment_intent: intentId,
      // });

      // charges.data.forEach((charge) => {
      //   if (!charge.refunded && charge.metadata.eventId === eventId) {
      //     paymentIntentId = charge.payment_intent;
      //     amount = charge.amount;
      //     console.log(charge.payment_intent, charge.amount);
      //   }
      // });

      resolve({
        amount,
        paymentIntentId,
      });
    } catch (error) {
      reject(error.message);
    }
  });
};

// pay refund to the users
const payRefund = async (refundAmount, paymentIntentId, next) => {
  return new Promise(async (resolve, reject) => {
    try {
      const refund = await stripe.refunds.create({
        payment_intent: paymentIntentId,
        amount: refundAmount, // The amount to refund in cents (or smallest currency unit)
      });
      resolve(refund);
    } catch (error) {
      reject(error.message);
    }
  });
};

// Create transaction model
const createTransaction = async (customer, data, paid) => {
  try {
    await Transaction.create({
      userId: data.metadata.userId,
      eventId: data.metadata.eventId,
      customer_id: data.customer,
      transaction_id: data.id,
      payment_gateway: data.payment_method_types[0],
      payment_amount: data.amount,
      payment_status:
        data.status === "requires_payment_method" ? "failed" : data.status,
      charge: paid,
      bank_account_id: data.metadata.accountId,
    });
    updateEventSpots(data.metadata.eventId);
  } catch (error) {
    throw new Error(error.message);
  }
};

// Number of spots left for the event
const updateEventSpots = async (eventId) => {
  try {
    const event = await eventModel.findByPk(eventId);

    if (!event) {
      throw new Error("Event not found");
    }

    let updatedSpots = {};

    updatedSpots.spots = event.spots - 1;

    await event.update(updatedSpots);
  } catch (error) {
    throw new Error(error.message);
  }
};

module.exports = {
  createStripeCustomers,
  addBankDetails,
  getBankDetails,
  deleteBankDetails,
  generateLoginLink,
  createPaymentIntent,
  getPaymentIntentsByCustomer,
  payCommission,
  payRefund,
  router,
};
