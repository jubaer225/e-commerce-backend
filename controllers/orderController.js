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

const getStripeWebhookSecret = () => {
  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    throw new Error("STRIPE_WEBHOOK_SECRET is not configured");
  }

  return process.env.STRIPE_WEBHOOK_SECRET;
};

const finalizePaidOrder = async (order, paymentIntentId) => {
  if (order.paymentStatus === "paid") {
    return;
  }

  order.paymentStatus = "paid";
  order.orderStatus = "processing";
  order.paymentIntentId = paymentIntentId || order.paymentIntentId;
  await order.save();

  for (const item of order.items) {
    const updatedProduct = await Product.findOneAndUpdate(
      {
        _id: item.product,
        stock: { $gte: item.quantity },
      },
      {
        $inc: { stock: -item.quantity },
      },
      { returnDocument: "after" },
    );

    if (!updatedProduct) {
      console.error(`Stock issue for product ${item.product}`);
    }
  }

  await Cart.findOneAndUpdate({ user: order.user }, { $set: { items: [] } });
};

const reconcileStripeOrderPayment = async (order) => {
  if (
    !order ||
    order.paymentMethod !== "stripe" ||
    order.paymentStatus === "paid" ||
    !order.stripeSessionId
  ) {
    return order;
  }

  const stripe = getStripeClient();
  const session = await stripe.checkout.sessions.retrieve(
    order.stripeSessionId,
  );

  if (session && session.payment_status === "paid") {
    await finalizePaidOrder(order, session.payment_intent);
  }

  return order;
};

const refundStripePaymentForOrder = async (order) => {
  if (
    !order ||
    order.paymentMethod !== "stripe" ||
    order.paymentStatus !== "paid"
  ) {
    return { attempted: false };
  }

  const stripe = getStripeClient();
  let paymentIntentId = order.paymentIntentId;

  if (!paymentIntentId && order.stripeSessionId) {
    const session = await stripe.checkout.sessions.retrieve(
      order.stripeSessionId,
    );
    paymentIntentId = session?.payment_intent || null;
  }

  if (!paymentIntentId) {
    throw new Error("Missing Stripe payment intent for refund");
  }

  const existingRefunds = await stripe.refunds.list({
    payment_intent: paymentIntentId,
    limit: 1,
  });

  if (existingRefunds.data.length > 0) {
    const existingRefund = existingRefunds.data[0];
    return {
      attempted: true,
      alreadyRefunded: true,
      refundId: existingRefund.id,
      refundStatus: existingRefund.status,
      paymentIntentId,
    };
  }

  const refund = await stripe.refunds.create({
    payment_intent: paymentIntentId,
    metadata: {
      orderId: String(order._id),
      orderNumber: order.orderNumber || "",
    },
  });

  return {
    attempted: true,
    alreadyRefunded: false,
    refundId: refund.id,
    refundStatus: refund.status,
    paymentIntentId,
  };
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

    await reconcileStripeOrderPayment(order);

    res
      .status(200)
      .json({ message: "Order retrieved successfully", data: order });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error" });
  }
};

exports.syncStripePaymentStatus = async (req, res) => {
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

    await reconcileStripeOrderPayment(order);

    return res.status(200).json({
      message: "Payment status synchronized successfully",
      data: order,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error" });
  }
};

exports.getAllOrders = async (req, res) => {
  const { cursor, limit = 20, search } = req.query;
  const parsedLimit = Number.parseInt(limit, 10);
  const pageSize = Number.isNaN(parsedLimit)
    ? 20
    : Math.min(Math.max(parsedLimit, 1), 100);
  try {
    let query = {};

    if (search) {
      query.$or = [
        { orderNumber: { $regex: search, $options: "i" } },
        { orderStatus: { $regex: search, $options: "i" } },
      ];
    }

    if (cursor) {
      if (!mongoose.Types.ObjectId.isValid(cursor)) {
        return res.status(400).json({ message: "Invalid cursor" });
      }
      query._id = { $lt: new mongoose.Types.ObjectId(cursor) };
    }

    const orders = await Order.find(query)
      .sort({ _id: -1 })
      .limit(pageSize + 1)
      .populate("user", "name email")
      .populate("items.product", "title price")
      .lean();

    const hasMore = orders.length > pageSize;
    const results = hasMore ? orders.slice(0, pageSize) : orders;
    const nextCursor =
      results.length > 0 ? results[results.length - 1]._id : null;

    res.status(200).json({
      success: true,
      count: results.length,
      data: results,
      nextCursor,
      hasMore,
    });
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
    res.status(200).json({ message: "Order status updated successfully", data: order });
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

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    await Order.findByIdAndDelete(orderId);
    res.status(200).json({ message: "Order deleted successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error" });
  }
};

exports.cancelOrder = async (req, res) => {
  try {
    const userId = req.userId;
    const orderId = req.params.id;

    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      return res.status(400).json({ message: "Invalid order ID" });
    }

    const order = await Order.findOne({ _id: orderId, user: userId });
    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    if (order.orderStatus === "cancelled") {
      return res.status(400).json({ message: "Order is already cancelled" });
    }

    if (order.orderStatus === "shipped" || order.orderStatus === "delivered") {
      return res.status(400).json({
        message: "Cannot cancel an order that has already been shipped or delivered",
      });
    }

    let refundResult = { attempted: false };

    if (order.paymentMethod === "stripe" && order.paymentStatus === "paid") {
      try {
        refundResult = await refundStripePaymentForOrder(order);
      } catch (refundError) {
        console.error("Stripe refund failed:", refundError.message);
        return res.status(400).json({
          message:
            "Order cancellation failed because Stripe refund could not be processed",
        });
      }
    }

    order.orderStatus = "cancelled";
    await order.save();

    if (refundResult.attempted) {
      return res.status(200).json({
        message: "Order cancelled and Stripe refund processed",
        refund: {
          id: refundResult.refundId,
          status: refundResult.refundStatus,
          alreadyRefunded: refundResult.alreadyRefunded,
        },
      });
    }

    res.status(200).json({ message: "Order cancelled successfully" });
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
  if (!sig) {
    return res
      .status(400)
      .send("Webhook Error: Missing stripe-signature header");
  }

  let stripe;
  let webhookSecret;

  try {
    stripe = getStripeClient();
    webhookSecret = getStripeWebhookSecret();
  } catch (err) {
    console.error("Stripe webhook configuration error:", err.message);
    return res
      .status(500)
      .send("Webhook Error: Stripe webhook is not configured");
  }

  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
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

        await finalizePaidOrder(order, session.payment_intent);

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

      case "payment_intent.succeeded": {
        const paymentIntent = event.data.object;

        // Try to find order by paymentIntentId
        let order = await Order.findOne({ paymentIntentId: paymentIntent.id });

        // If not found, try to find a checkout session linked to this payment intent
        if (!order) {
          try {
            const sessions = await stripe.checkout.sessions.list({
              payment_intent: paymentIntent.id,
              limit: 1,
            });
            const session = sessions.data[0];
            if (session && session.metadata && session.metadata.orderId) {
              order = await Order.findById(session.metadata.orderId);
            }
          } catch (err) {
            console.error(
              "Error finding session for payment_intent:",
              err.message,
            );
          }
        }

        if (order) {
          await finalizePaidOrder(order, paymentIntent.id);
        }

        break;
      }

      case "charge.succeeded":
      case "charge.updated": {
        const charge = event.data.object;

        // Only act on succeeded charges
        if (charge.status !== "succeeded") break;

        const paymentIntentId = charge.payment_intent;
        if (!paymentIntentId) break;

        // Try to find order by paymentIntentId
        let order = await Order.findOne({ paymentIntentId: paymentIntentId });

        // Fallback: find session and then order
        if (!order) {
          try {
            const sessions = await stripe.checkout.sessions.list({
              payment_intent: paymentIntentId,
              limit: 1,
            });
            const session = sessions.data[0];
            if (session && session.metadata && session.metadata.orderId) {
              order = await Order.findById(session.metadata.orderId);
            }
          } catch (err) {
            console.error("Error finding session for charge:", err.message);
          }
        }

        if (order) {
          await finalizePaidOrder(order, paymentIntentId);
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
