const Stripe = require("stripe");
const Order = require("../models/order.model");
const Cart = require("../models/cart.model");
const Product = require("../models/Product");
const crypto = require("crypto");

const createOrderNumber = () =>
  `ORD-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;

const getStripeClient = () => {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error("STRIPE_SECRET_KEY is not configured");
  }

  return new Stripe(process.env.STRIPE_SECRET_KEY);
};

const getClientBaseUrl = () => {
  if (!process.env.CLIENT_URL) {
    throw new Error("CLIENT_URL is not configured");
  }

  return process.env.CLIENT_URL.replace(/\/+$/, "");
};

exports.createCheckoutSession = async (userId, shippingAddress) => {
  const stripe = getStripeClient();
  const clientBaseUrl = getClientBaseUrl();
  const cart = await Cart.findOne({ user: userId }).populate("items.product");

  if (!cart || cart.items.length === 0) {
    throw new Error("Cart is empty");
  }

  const ordersItems = [];
  let totalPrice = 0;

  for (const item of cart.items) {
    const product = item.product;

    if (!product) {
      throw new Error(`Product with ID ${item.product} not found`);
    }
    if (product.stock < item.quantity) {
      throw new Error(`Insufficient stock for product ${product.name}`);
    }
    const itemTotal = product.price * item.quantity;

    ordersItems.push({
      product: product._id,
      quantity: item.quantity,
      name: product.title,
      price: product.price,
    });
    totalPrice += itemTotal;
  }

  const order = await Order.create({
    orderNumber: createOrderNumber(),
    user: userId,
    items: ordersItems,
    totalPrice: totalPrice,
    shippingAddress: shippingAddress,
    paymentMethod: "stripe",
    paymentStatus: "pending",
    orderStatus: "pending",
  });

  const session = await stripe.checkout.sessions.create({
    payment_method_types: ["card"],
    mode: "payment",

    line_items: ordersItems.map((item) => ({
      price_data: {
        currency: "bdt",
        product_data: {
          name: item.name,
        },
        unit_amount: Math.round(item.price * 100),
      },
      quantity: item.quantity,
    })),

    success_url: `${clientBaseUrl}/order-success?orderId=${order._id}`,
    cancel_url: `${clientBaseUrl}/cart`,

    metadata: {
      orderId: order._id.toString(),
    },
  });

  order.stripeSessionId = session.id;
  await order.save();

  return {
    url: session.url,
  };
};
