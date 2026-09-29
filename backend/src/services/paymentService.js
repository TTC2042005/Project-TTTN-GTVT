const stripe = require('stripe');

const stripeClient = process.env.STRIPE_SECRET_KEY ? new stripe(process.env.STRIPE_SECRET_KEY) : null;

async function createCheckoutSession({ orderId, amount, currency = 'usd', successUrl, cancelUrl }) {
  if (!stripeClient) {
    return {
      provider: 'demo',
      checkoutUrl: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/orders`,
      paymentIntentId: null,
      clientSecret: null,
      amount,
      currency,
      mode: 'demo',
    };
  }

  const session = await stripeClient.checkout.sessions.create({
    mode: 'payment',
    success_url: successUrl || `${process.env.FRONTEND_URL || 'http://localhost:3000'}/orders`,
    cancel_url: cancelUrl || `${process.env.FRONTEND_URL || 'http://localhost:3000'}/orders`,
    line_items: [
      {
        price_data: {
          currency,
          product_data: {
            name: `Film Lab Order ${orderId}`,
          },
          unit_amount: currency.toLowerCase() === 'vnd' ? Math.round(amount) : Math.round(amount * 100),
        },
        quantity: 1,
      },
    ],
    metadata: { orderId },
  });

  return {
    provider: 'stripe',
    checkoutUrl: session.url,
    paymentIntentId: session.payment_intent,
    clientSecret: session.client_secret,
    sessionId: session.id,
    amount,
    currency,
    mode: 'live',
  };
}

module.exports = { createCheckoutSession };