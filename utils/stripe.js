const secret_key = process.env.STRIPE_SECRET_KEY;
const stripe = require("stripe")(secret_key);
const Transaction = require("../src/transactions/transaction.model");
const express = require("express");
const router = express.Router();

// create customer on stripe
const createStripeCustomer = async (email, username) => {
  try {
    const stripeCustomer = await stripe.customers.create({
      email: email,
      name: username,
    });
    return stripeCustomer.id;
  } catch (error) {
    console.error("Error creating Stripe customer:", error);
    throw new Error(error.message);
  }
};

// Add payment Intent
const createPaymentIntent = async (event, user) => {
  // console.log("Datavalues", event.dataValues);
  const amount = event.entry_fee;
  const title = event.title;
  const accountId = event.dataValues.creator.dataValues.bank_account_id;

  try {
    // const session = await stripe.checkout.sessions.create({
    //   payment_method_types: ["card"],
    //   billing_address_collection: "required",
    //   customer: user.customerId,
    //   line_items: [
    //     {
    //       price_data: {
    //         currency: "usd",
    //         product_data: {
    //           name: title,
    //           images: [event.thumbnail],
    //         },
    //         unit_amount: amount * 100,
    //       },
    //       quantity: 1,
    //     },
    //   ],
    //   mode: "payment",
    //   success_url: `http://localhost:5000`,
    //   cancel_url: `http://localhost:5000`,
    //   metadata: {
    //     eventId: event.id,
    //     userId: user.id,
    //     amount: event.entry_fee,
    //     customerName: user.username,
    //     accountId: accountId,
    //     // bank_account_id: user.user.bank_account_id
    //   },
    // });
    // return { session };
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amount * 100, // Amount in cents
      currency: "usd",
      description: title,
      customer: user.customerId,
      metadata: {
        eventId: event.id,
        userId: user.id,
        amount: event.entry_fee,
        customerName: user.username,
        customerId: user.customerId,
        accountId: accountId,
      },
      payment_method_types: ["card"],
    });
    return { client_secret: paymentIntent.client_secret };
  } catch (error) {
    console.log(error);
    throw Error("Unable to create client secret", error.message);
  }
};

//Webhook route not working yet
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

    // Handle the payment_intent.succeeded event
    if (eventType === "payment_intent.succeeded") {
      stripe.customers
        .retrieve(data.customer)
        .then(async (customer) => {
          try {
            // CREATE ORDER
            createTransaction(customer, data, "success");
            // console.log("data", data);
          } catch (err) {
            console.log(err);
          }
        })
        .catch((err) => console.log(err.message));
    }

    // Handle the payment_intent.payment_failed event
    if (eventType === "payment_intent.payment_failed") {
      stripe.customers
        .retrieve(data.customer)
        .then(async (customer) => {
          try {
            // CREATE ORDER
            createTransaction(customer, data, "failed");
            // console.log("data", data);
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
            createTransaction(customer, data, "canceled");
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

// Create transaction model
const createTransaction = async (customer, data, paid) => {
  // const Items = JSON.parse(customer.metadata.cart);
  // console.log("trrrrr", data);
  try {
    const transaction = await Transaction.create({
      userId: data.metadata.userId,
      eventId: data.metadata.eventId,
      customer_id: data.customer,
      transaction_id: data.id,
      payment_gateway: data.payment_method_types[0],
      payment_amount: data.amount_total,
      payment_status: data.payment_status,
      charge: paid,
      bank_account_id: data.metadata.accountId,
    });
    console.log("Processed Order:", transaction);
  } catch (err) {
    console.log(err);
  }
};

// ==================== Card details methods ==========================

// Attach card to customer on stripe
const addCardDetails = async (paymentMethodId, customerId) => {
  // console.log(paymentMethodId, customerId);
  try {
    const paymentMethod = await stripe.paymentMethods.attach(paymentMethodId, {
      customer: customerId,
    });

    return paymentMethod.id;
  } catch (error) {
    console.error("Error addind payment method on stripe:", error);
    throw new Error(error.message);
  }
};

// update attached card to customer on stripe
const updateCardDetails = async (
  paymentMethodId,
  name,
  email,
  line1,
  line2,
  city,
  state,
  postal_code,
  country,
  exp_month,
  exp_year
) => {
  // console.log(paymentMethodId, customerId);
  try {
    const paymentMethod = await stripe.paymentMethods.update(paymentMethodId, {
      billing_details: {
        name: name,
        email: email,
        address: {
          line1: line1,
          line2: line2,
          city: city,
          state: state,
          postal_code: postal_code,
          country: country,
        },
      },
      card: {
        exp_month: exp_month,
        exp_year: exp_year,
      },
    });

    return paymentMethod.id;
  } catch (error) {
    console.error("Error addind payment method on stripe:", error);
    throw new Error(error.message);
  }
};

// Delete attached card to customer on stripe
const deleteCardDetails = async (paymentMethodId) => {
  // console.log(paymentMethodId, customerId);
  try {
    const paymentMethod = await stripe.paymentMethods.detach(paymentMethodId);

    return paymentMethod;
  } catch (error) {
    console.error("Error addind payment method on stripe:", error);
    throw new Error(error.message);
  }
};

// ====================== Bank details methods ========================

// Add bank details on stripe
const addBankDetails = async (
  country,
  currency,
  account_holder_name,
  account_holder_type,
  routing_number,
  account_number,
  email
) => {
  try {
    const connect = await stripe.accounts.create({
      type: "custom",
      country: "US", // Specify 'IN' for India
      email: email, // Email associated with the account
      business_type: "individual",
      business_profile: {
        mcc: "5734", // Merchant category code for retail
        url: "https://lyvechat.com", // Business website URL
      },
      tos_acceptance: {
        date: 1609798905,
        ip: "8.8.8.8", // IP address of the connected account owner
      },
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true },
      },
      individual: {
        address: {
          city: "new york",
          line1: "new york",
          postal_code: "10011",
          state: "new york",
        },
        dob: {
          day: "09",
          month: "03",
          year: "2002",
        },
        email: email,
        first_name: "Kuldeep",
        last_name: "Panwar",
        phone: "8349040873",
        ssn_last_4: "1111",
      },
    });

    const account = await stripe.accounts.createExternalAccount(connect.id, {
      external_account: {
        object: "bank_account",
        account_holder_name: account_holder_name,
        account_holder_type: account_holder_type,
        account_number: account_number,
        routing_number: routing_number,
        country: country,
        currency: currency,
      },
    });

    return account;
  } catch (error) {
    console.error("Error creating Stripe customer:", error);
    throw new Error(error.message);
  }
};

// Update bank account details on stripe not working
const updateBankAccount = async (customerId, bankAccountId) => {
  try {
    const updateAccount = await stripe.customers.updateSource(
      customerId,
      bankAccountId
    );

    return updateAccount;
  } catch (error) {
    console.log(error);
    throw new Error(error.message);
  }
};

// Delete bank details on stripe
const deleteBankDetails = async (customerId, bankAccountId) => {
  try {
    // const customerSource = await stripe.customers.deleteSource(
    //   customerId,
    //   bankAccountId
    // );
    const deleted = await stripe.accounts.del("acct_1P9Qy1PwJe7MSMAc");

    return deleted;
  } catch (error) {
    console.log(error);
    throw new Error(error.message);
  }
};

// pay 60% to the content creator
const payCommission = async (totalAmount, accountId) => {
  // console.log(totalAmount, accountId);
  try {
    // const payout = await stripe.payouts.create({
    //   amount: 2000,
    //   currency: "usd",
    //   destination: "acct_1P9R4qQ1N2RA0yRm",
    // });
    const transfer = await stripe.transfers.create({
      amount: totalAmount,
      currency: "usd",
      destination: accountId,
      description: "Transfer to event creator",
    });
    return transfer;
  } catch (error) {
    console.error("Error creating transfer:", error);
    throw new Error(error.message);
  }
};

module.exports = {
  createStripeCustomer,
  addCardDetails,
  deleteCardDetails,
  updateCardDetails,
  addBankDetails,
  updateBankAccount,
  deleteBankDetails,
  createPaymentIntent,
  payCommission,
  router,
};
