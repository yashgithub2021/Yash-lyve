const secret_key = process.env.STRIPE_SECRET_KEY;
const stripe = require("stripe")(secret_key);
const Transaction = require("../src/transactions/transaction.model");
const express = require("express");
const appHook = express();

appHook.use(express.raw({ type: "*/*" }));

const createCheckout = async (event, user) => {
  // console.log("Datavalues", event.dataValues);
  const amount = event.entry_fee;
  const title = event.title;
  const email = user.email;

  try {
    const customer = await stripe.customers.create({
      metadata: {
        userId: user.id,
        user: user.username,
        eventId: event.id,
        event_name: event.title,
        event_thubmnail: event.thumbnail,
      },
    });

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: title,
            },
            unit_amount: amount * 100,
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: `http://localhost:5000`,
      cancel_url: `http://localhost:5000`,
      // customer_email: email,
      customer: customer.id,
      // metadata: customer,
    });
    return { session };
  } catch (e) {
    console.log(e);
  }
};

// Capture payments
const captureStripePayment = async (session_id) => {
  try {
    const session = await stripe.checkout.sessions.retrieve(session_id);

    if (!session) {
      throw new Error("Session not found");
    }

    return session;
  } catch (e) {
    console.log(e.message);
  }
};

// Create transaction not working yet
const createTransaction = async (customer, data) => {
  // const Items = JSON.parse(customer.metadata.cart);
  try {
    const transaction = await Transaction.create({
      userId: customer.metadata.userId,
      event_id: data.metadata.eventId,
      customer_id: data.customer,
      transaction_id: data.object.id,
      payment_gateway: data.payment_method_types[0],
      payment_amount: data.amount_total,
      payment_status: data.payment_status,
      metadata: customer.metadata,
    });
    console.log("Processed Order:", transaction);
  } catch (err) {
    console.log(err);
  }
};

//Webhook route not working yet
appHook.post(
  "/webhook",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    let data;
    let eventType;

    // Check if webhook signing is configured.
    let webhookSecret;
    webhookSecret =
      "whsec_baa566e628b46819c0be536920fa0d74dc4706710e62e1143febf9506fbf6602";

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
        console.error("Webhook Error:", err);
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

    // Handle the checkout.session.completed event
    if (eventType === "checkout.session.completed") {
      stripe.customers
        .retrieve(data.customer)
        .then(async (customer) => {
          try {
            // CREATE ORDER
            createTransaction(customer, data);
            console.log("data", data);
          } catch (err) {
            console.log(err);
          }
        })
        .catch((err) => console.log(err.message));
    }
    res.status(200).end();
  }
);

// not working yet
const createStripeCustomer = async (email, username) => {
  try {
    const stripeCustomer = await stripe.customers.create({
      email: email,
      name: username, // Update with the user's name if available
      description: "Customer for your app", // Add description if needed
      // Add more fields as needed
    });
    return stripeCustomer.id;
  } catch (error) {
    console.error("Error creating Stripe customer:", error);
    throw new Error("Error creating Stripe customer");
  }
};

const createStripeToken = async (
  country,
  currency,
  account_holder_name,
  account_holder_type,
  routing_number,
  account_number
) => {
  try {
    const token = await stripe.tokens.create({
      country: country,
      currency: currency,
      account_holder_name: account_holder_name,
      account_holder_type: account_holder_type,
      routing_number: routing_number,
      account_number: account_number,
    });

    return token;
  } catch (error) {
    console.error("Error creating Stripe customer:", error);
    throw new Error("Error creating Stripe customer");
  }
};

//not working yet
const addBankDetails = async (cust_Id, token) => {
  try {
    const customerSource = await stripe.customers.createSource(cust_Id, {
      source: token,
    });
    return customerSource;
  } catch (error) {
    console.error("Error creating Stripe customer:", error);
    throw new Error("Error creating Stripe customer");
  }
};

module.exports = {
  createStripeCustomer,
  createStripeToken,
  addBankDetails,
  createCheckout,
  captureStripePayment,
  appHook,
};
