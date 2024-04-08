const secret_key = process.env.STRIPE_SECRET_KEY;
const stripe = require('stripe')(secret_key);

const createStripeCustomer = async (email, username) => {
    try {
        const stripeCustomer = await stripe.customers.create({
            email: email,
            name: username, // Update with the user's name if available
            description: 'Customer for your app', // Add description if needed
            // Add more fields as needed
        });
        return stripeCustomer.id;
    } catch (error) {
        console.error('Error creating Stripe customer:', error);
        throw new Error('Error creating Stripe customer');
    }
};

const createStripeToken = async (country, currency, account_holder_name, account_holder_type, routing_number, account_number) => {

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
        console.error('Error creating Stripe customer:', error);
        throw new Error('Error creating Stripe customer');
    }
}

const addBankDetails = async (cust_Id, token) => {

    try {

        const customerSource = await stripe.customers.createSource(
            cust_Id,
            {
                source: token,
            }
        );
        return customerSource;
    } catch (error) {
        console.error('Error creating Stripe customer:', error);
        throw new Error('Error creating Stripe customer');
    }
}

module.exports = {
    createStripeCustomer,
    createStripeToken,
    addBankDetails
};