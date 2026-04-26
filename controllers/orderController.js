const Order = require("../models/order.model");
const Cart = require("../models/cart.model");
const Product = require("../models/Product");
const mongoose = require("mongoose");
const crypto = require("crypto");
const Stripe = require("stripe");
const orderService = require("../config/order.servise");

const createOrderNumber = () =>
  `ORD-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;

const getStripeClient = () => {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error("STRIPE_SECRET_KEY is not configured");
  }

  return new Stripe(process.env.STRIPE_SECRET_KEY);
};

exports.getUserOrders = async (req, res) => {
  try {
    const userId = req.userId;
    const orders = await Order.find({ user: userId }).populate(
      "items.product",
      "title price images",
    );
    if (!orders || orders.length === 0) {
      return res.status(404).json({ message: "No orders found" });
    }
    res
      .status(200)
      .json({ message: "Orders retrieved successfully", data: orders });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error" });
  }
};

exports.getOrderById = async (req, res) => {
  try {
    const userId = req.userId;
    const orderId = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      return res.status(400).json({ message: "Invalid order ID" });
    }
    const order = await Order.findOne({ _id: orderId, user: userId })
      .populate("user", "name")
      .populate("items.product", "title price images");
    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }
    res
      .status(200)
      .json({ message: "Order retrieved successfully", data: order });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error" });
  }
};

exports.getAllOrders = async (req, res) => {
  try {
    const orders = await Order.find()
      .populate("user", "name")
      .populate("items.product", "title price");
    res
      .status(200)
      .json({ message: "Orders retrieved successfully", data: orders });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error" });
  }
};

exports.updateOrderStatus = async (req, res) => {
  try {
    const orderId = req.params.id;
    const { orderStatus } = req.body;

    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      return res.status(400).json({ message: "Invalid order ID" });
    }

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    order.orderStatus = orderStatus;
    await order.save();
    res.status(200).json({ message: "Order status updated successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error" });
  }
};

exports.deleteOrder = async (req, res) => {
  try {
    const orderId = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      return res.status(400).json({ message: "Invalid order ID" });
    }

    const order = await Order.findByIdAndDelete(orderId);
    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }
    res.status(200).json({ message: "Order deleted successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error" });
  }
};

exports.checkout = async (req, res) => {
  try {
    const userId = req.userId;
    const { shippingAddress } = req.body;

    const session = await orderService.createCheckoutSession(
      userId,
      shippingAddress,
    );

    res.status(200).json({ url: session.url });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error" });
  }
};

exports.handleStripeWebhook = async (req, res) => {
  const sig = req.headers["stripe-signature"];
  const stripe = getStripeClient();

  let event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET,
    );
  } catch (err) {
    console.error("Webhook signature verification failed:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // 🔥 HANDLE EVENTS
  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;

        const orderId = session.metadata.orderId;

        const order = await Order.findById(orderId);

        if (!order) {
          console.error("Order not found:", orderId);
          return res.json({ received: true });
        }

        // 🔥 prevent duplicate execution (VERY IMPORTANT)
        if (order.paymentStatus === "paid") {
          return res.json({ received: true });
        }

        // 1. update order
        order.paymentStatus = "paid";
        order.orderStatus = "processing";
        order.paymentIntentId = session.payment_intent;

        await order.save();

        // 2. reduce stock safely
        for (const item of order.items) {
          const updatedProduct = await Product.findOneAndUpdate(
            {
              _id: item.product,
              stock: { $gte: item.quantity },
            },
            {
              $inc: { stock: -item.quantity },
            },
            { new: true },
          );

          if (!updatedProduct) {
            console.error(`Stock issue for product ${item.product}`);
            // You could mark order as failed here if needed
          }
        }

        // 3. clear cart (optional but recommended)
        await Cart.findOneAndUpdate(
          { user: order.user },
          { $set: { items: [] } },
        );

        break;
      }

      case "checkout.session.async_payment_failed": {
        const session = event.data.object;

        const orderId = session.metadata.orderId;

        const order = await Order.findById(orderId);

        if (order) {
          order.paymentStatus = "failed";
          order.orderStatus = "cancelled";
          await order.save();
        }

        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    res.json({ received: true });
  } catch (error) {
    console.error("Webhook handling error:", error);
    res.status(500).json({ message: "Webhook handler failed" });
  }
};
