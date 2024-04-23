const secret_key = process.env.STRIPE_SECRET_KEY;
const stripe = require("stripe")(secret_key);
const Transaction = require("../src/transactions/transaction.model");
const express = require("express");
const router = express.Router();

// Add payment checkout session
const createCheckout = async (event, user) => {
  // console.log("Datavalues", event.dataValues);
  const amount = event.entry_fee;
  const title = event.title;
  const accountId = event.dataValues.creator.dataValues.bank_account_id;

  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      billing_address_collection: "required",
      customer: user.customerId,
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: title,
              images: [event.thumbnail],
            },
            unit_amount: amount * 100,
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: `http://localhost:5000`,
      cancel_url: `http://localhost:5000`,
      metadata: {
        eventId: event.id,
        userId: user.id,
        amount: event.entry_fee,
        customerName: user.username,
        accountId: accountId,
        // bank_account_id: user.user.bank_account_id
      },
    });
    return { session };
  } catch (e) {
    console.log(e);
  }
};

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
      // metadata: customer.metadata,
    });
    console.log("Processed Order:", transaction);
  } catch (err) {
    console.log(err);
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
      console.log("ppppaid");
      stripe.customers
        .retrieve(data.customer)
        .then(async (customer) => {
          try {
            // CREATE ORDER
            createTransaction(customer, data, "paid");
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
  customerId
) => {
  try {
    const account = await stripe.tokens.create({
      bank_account: {
        // object: "bank_account",
        account_holder_name: account_holder_name,
        account_holder_type: account_holder_type,
        account_number: account_number,
        routing_number: routing_number,
        country: country,
        currency: currency,
      },
    });

    const bankAccount = await stripe.customers.createSource(customerId, {
      source: account.id,
    });
    return bankAccount.id;
  } catch (error) {
    console.error("Error creating Stripe customer:", error);
    throw new Error(error.message);
  }
};

// Verify bank account on stripe
const verifyBankAccount = async (customerId, bankAccountId) => {
  try {
    const verifybankAccount = await stripe.customers.verifySource(
      customerId,
      bankAccountId,
      {
        amounts: [32, 45],
      }
    );

    if (verifybankAccount.status !== "verified") {
      await deleteBankDetails(customerId, bankAccountId);
    }

    return verifybankAccount.status;
  } catch (error) {
    console.log(error);
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
    const customerSource = await stripe.customers.deleteSource(
      customerId,
      bankAccountId
    );

    return customerSource;
  } catch (error) {
    console.log(error);
    throw new Error(error.message);
  }
};

// pay 60% to the content creator
const payInterest = async (totalAmount, accountId) => {
  console.log(totalAmount, accountId);
  try {
    const transfer = await stripe.transfers.create({
      amount: 5000, // $50.00 in cents
      currency: "usd",
      destination: "ba_1P8NnRSC6KKmQtB0rBH3bQzO", // Test bank account ID
      description: "Transfer to event creator",
    });
    return transfer;
  } catch (error) {
    console.error("Error creating transfer:", error);
    throw new Error(error.message);
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

//not working yet
// const addBankDetails = async (cust_Id, token) => {
//   try {
//     const customerSource = await stripe.customers.createSource(cust_Id, {
//       source: token,
//     });
//     return customerSource;
//   } catch (error) {
//     console.error("Error creating Stripe customer:", error);
//     throw new Error("Error creating Stripe customer");
//   }
// };

module.exports = {
  createStripeCustomer,
  addCardDetails,
  deleteCardDetails,
  updateCardDetails,
  addBankDetails,
  verifyBankAccount,
  updateBankAccount,
  deleteBankDetails,
  createCheckout,
  captureStripePayment,
  payInterest,
  router,
};
