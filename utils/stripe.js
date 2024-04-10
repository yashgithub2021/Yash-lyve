const secret_key = process.env.STRIPE_SECRET_KEY;
const stripe = require("stripe")(secret_key);

const createCheckout = async (event, email) => {
  console.log("Datavalues", event.dataValues)
  const amount = event.entry_fee
  const title = event.title
  try {
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
      customer_email: email,
    });
    return { session };
  } catch (e) {
    console.log(e);
  }
};

const captureStripePayment = async (session_id) => {
  // console.log(event_data.entry_fee);

  try {
    const session = await stripe.checkout.sessions.retrieve(session_id);
    const paymentStatus = session.payment_status;
    if (!paymentStatus) {
      throw new Error("Payment was not confirmed");
    }
    console.log(paymentStatus);
    return paymentStatus;
  } catch (e) {
    console.log(e.message);
  }
};

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
      bank_account: {
        country: country,
        currency: currency,
        account_holder_name: account_holder_name,
        account_holder_type: account_holder_type,
        routing_number: routing_number,
        account_number: account_number,
      },
    });
    return token;
  } catch (error) {
    console.error("Error creating Stripe customer:", error);
    throw new Error("Error creating Stripe customer");
  }
};

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
};
