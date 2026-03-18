const Cart = require("../models/cart.model");
const Product = require("../models/Product");
const mongoose = require("mongoose");

exports.addToCart = async (req, res) => {
  try {
    const userId = req.userId;
    const { productId, quantity } = req.body;

    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({ message: "Invalid productId" });
    }
    if (!Number.isInteger(quantity) || quantity < 1) {
      return res
        .status(400)
        .json({
          message: "Quantity must be an integer greater than or equal to 1",
        });
    }
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    } else if (product.stock < quantity) {
      return res
        .status(400)
        .json({
          message: "Insufficient stock available for the requested quantity",
        });
    }
    let cart = await Cart.findOne({ user: userId });
    if (!cart) {
      cart = new Cart({ user: userId, items: [], totalPrice: 0 });
    }
    const itemIndex = cart.items.findIndex(
      (item) => item.product.toString() === productId,
    );
    if (itemIndex === -1) {
      cart.items.push({ product: productId, quantity, price: product.price });
    } else {
      cart.items[itemIndex].quantity = quantity;
      cart.items[itemIndex].price = product.price;
    }
    cart.totalPrice = cart.items.reduce(
      (total, item) => total + (item.price || 0) * item.quantity,
      0,
    );
    await cart.save();
    const updatedCart = await Cart.findOne({ user: userId })
      .populate("user", "name")
      .populate("items.product", "title images price");
    res
      .status(200)
      .json({
        message: "Product added to cart successfully",
        data: updatedCart,
      });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error" });
  }
};

exports.getCart = async (req, res) => {
  try {
    const userId = req.userId;
    const cart = await Cart.findOne({ user: userId })
      .populate("user", "name")
      .populate("items.product", "title images price");
    if (!cart) {
      return res.status(404).json({ message: "Cart not found" });
    }
    res.status(200).json(cart);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error" });
  }
};

exports.updateCartItem = async (req, res) => {
  try {
    const userId = req.userId;
    const { productId, quantity } = req.body;

    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({ message: "Invalid productId" });
    }

    if (!Number.isInteger(quantity) || quantity < 1) {
      return res
        .status(400)
        .json({
          message: "Quantity must be an integer greater than or equal to 1",
        });
    }

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }
    if (product.stock < quantity) {
      return res
        .status(400)
        .json({
          message: "Insufficient stock available for the requested quantity",
        });
    }

    const cart = await Cart.findOne({ user: userId });
    if (!cart) {
      return res.status(404).json({ message: "Cart not found" });
    }
    const itemIndex = cart.items.findIndex(
      (item) => item.product.toString() === productId,
    );
    if (itemIndex === -1) {
      return res.status(404).json({ message: "Product not found in cart" });
    }

    cart.items[itemIndex].quantity = quantity;
    cart.items[itemIndex].price = product.price;

    cart.totalPrice = cart.items.reduce(
      (total, item) => total + (item.price || 0) * item.quantity,
      0,
    );
    await cart.save();
    const updatedCart = await Cart.findOne({ user: userId })
      .populate("user", "name")
      .populate("items.product", "title images price");
    res
      .status(200)
      .json({ message: "Cart updated successfully", data: updatedCart });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error" });
  }
};

exports.removeCartItem = async (req, res) => {
  try {
    const userId = req.userId;
    const { productId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({ message: "Invalid productId" });
    }

    const cart = await Cart.findOne({ user: userId });
    if (!cart) {
      return res.status(404).json({ message: "Cart not found" });
    }
    const itemIndex = cart.items.findIndex(
      (item) => item.product.toString() === productId,
    );
    if (itemIndex === -1) {
      return res.status(404).json({ message: "Product not found in cart" });
    }

    cart.items.splice(itemIndex, 1);
    cart.totalPrice = cart.items.reduce(
      (total, item) => total + (item.price || 0) * item.quantity,
      0,
    );

    await cart.save();
    const updatedCart = await Cart.findOne({ user: userId })
      .populate("user", "name")
      .populate("items.product", "title images price");
    res.status(200).json({
      message: "Product removed from cart successfully",
      data: updatedCart,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error" });
  }
};

exports.clearCart = async (req, res) => {
  // Implementation for clearing the cart
};
