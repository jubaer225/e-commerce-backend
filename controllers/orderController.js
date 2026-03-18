const Order = require("../models/order.model");
const Cart = require("../models/cart.model");
const Product = require("../models/Product");
const mongoose = require("mongoose");

exports.createOrder = async (req, res) => {
  try {
    const userId = req.userId;
    const { shippingAddress, paymentMethod } = req.body;
    const cart = await Cart.findOne({ user: userId }).populate(
      "items.product",
      "title price stock",
    );
    if (!cart || cart.items.length === 0) {
      return res.status(400).json({ message: "Cart is empty" });
    }
    const orderItems = cart.items.map((item) => {
      if (item.product.stock < item.quantity) {
        return res.status(400).json({
          message: `Not enough stock for product ${item.product.title}`,
        });
      }
      return {
        product: item.product._id,
        quantity: item.quantity,
        price: item.price,
      };
    });
    const totalPrice = orderItems.reduce(
      (total, item) => total + item.price * item.quantity,
      0,
    );
    const order = new Order({
      user: userId,
      items: orderItems,
      totalPrice: totalPrice,
      shippingAddress: shippingAddress,
      paymentMethod: paymentMethod,
    });
    await order.save();
    await Cart.deleteOne({ user: userId });
    res.status(201).json({ message: "Order created successfully", order });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error" });
  }
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
