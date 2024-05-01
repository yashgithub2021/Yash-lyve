const secret_key = process.env.STRIPE_SECRET_KEY;
const stripe = require("stripe")(secret_key);
const Transaction = require("../src/transactions/transaction.model");
const express = require("express");
const router = express.Router();

// create customer on stripe
const createStripeCustomer = async (email, username) => {
  const stripeAddress = {
    line1: "asdsadsad",
    line2: "dasadsads",
    city: "userAddress.city",
    country: "US",
    postal_code: "123456",
    state: "userAddress.state",
  };

  try {
    const stripeCustomer = await stripe.customers.create({
      email: email,
      name: username,
      description: "userData.description",
      phone: "1234567890",
      address: stripeAddress,
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
        eventId: event.id,
        userId: user.id,
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
        "pk_test_51P3eQNSC6KKmQtB0fXyW286m0IuEF8ysClpkXKMQVVFqdRf34q5EgmbviuGVDt07FlNshVFU10edbjZmaF2OJ1VM00Z2x46noC",
    };
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
            createTransaction(customer, data, "");
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

// Create transaction model
const createTransaction = async (customer, data, paid) => {
  // const Items = JSON.parse(customer.metadata.cart);
  try {
    const transaction = await Transaction.create({
      userId: data.metadata.userId,
      eventId: data.metadata.eventId,
      customer_id: data.customer,
      transaction_id: data.id,
      payment_gateway: data.payment_method_types[0],
      payment_amount: data.amount,
      payment_status: data.status,
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
  email,
  customerId
) => {
  try {
    const token = await await stripe.tokens.create({
      bank_account: {
        object: "bank_account",
        account_holder_name: account_holder_name,
        account_holder_type: account_holder_type,
        account_number: account_number,
        routing_number: routing_number,
        country: country,
        currency: currency,
      },
    });

    const bankAccount = await stripe.customers.createSource(customerId, {
      source: token.id,
    });

    await stripe.customers.verifySource(customerId, bankAccount.id, {
      amounts: [32, 45],
    });

    const connect = await stripe.accounts.create({
      type: "custom",
      country: "US", // Specify 'IN' for India
      email: email, // Email associated with the account
      // external_account: token.id,
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
        id_number: "123-45-6789",
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
        ssn_last_4: "6789",
      },
    });

    console.log(connect);

    // return connect.id;
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
    const deleted = await stripe.accounts.del("acct_1PBEK6PvLSSJTNsF");

    return deleted;
  } catch (error) {
    console.log(error);
    throw new Error(error.message);
  }
};

// pay 60% commission to content creator
const payCommission = async (totalAmount, accountId) => {
  // console.log(totalAmount, accountId);
  try {
    // const payout = await stripe.payouts.create({
    //   amount: 100,
    //   currency: "usd",
    //   destination: "ba_1PBGuFQ12BoTcOAKH7PFnvYz",
    // });
    // console.log("Payout successful:", payout);
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

// pay refund to the users
const payRefund = async (totalAmount, accountId) => {
  // console.log(totalAmount, accountId);
  try {
    const refund = await stripe.refunds.create({
      amount: totalAmount,
      currency: "usd",
      destination: accountId,
      description: "refund to event creator",
    });
    return refund;
  } catch (error) {
    console.error("Error creating refund:", error);
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
  payRefund,
  router,
};
