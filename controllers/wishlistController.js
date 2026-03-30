const Wishlist = require("../models/wishlist.model");
const Product = require("../models/Product");
const mongoose = require("mongoose");

exports.addToWishlist = async (req, res) => {
  try {
    const userId = req.userId;
    const { productId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({ message: "Invalid productId" });
    }
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }
    // if wishlist already exists for the user, add the product to the existing wishlist
    let wishlist = await Wishlist.findOne({ user: userId });
    if (wishlist) {
      if (
        wishlist.items.some((item) => item.product.toString() === productId)
      ) {
        return res
          .status(400)
          .json({ message: "Product is already in the wishlist" });
      }
      wishlist.items.push({ product: productId });
      await wishlist.save();
    } else {
      // Create a new wishlist for the user
      wishlist = new Wishlist({
        user: userId,
        items: [{ product: productId }],
      });
      await wishlist.save();
    }
    res
      .status(201)
      .json({ message: "Product added to wishlist", data: wishlist });
  } catch (error) {
    res.status(500).json({ message: "Internal server error" });
  }
};

exports.getWishlist = async (req, res) => {
  try {
    const userId = req.userId;
    const wishlist = await Wishlist.findOne({ user: userId }).populate(
      "items.product",
      "title images price",
    );
    if (!wishlist) {
      return res.status(404).json({ message: "Wishlist not found" });
    }

    res
      .status(200)
      .json({ message: "Wishlist retrieved successfully", data: wishlist });
  } catch (error) {
    res.status(500).json({ message: "Internal server error" });
  }
};

exports.removeFromWishlist = async (req, res) => {
  try {
    const userId = req.userId;
    const { productId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({ message: "Invalid productId" });
    }

    const wishlist = await Wishlist.findOne({ user: userId });
    if (!wishlist) {
      return res.status(404).json({ message: "Wishlist not found" });
    }

    const itemIndex = wishlist.items.findIndex(
      (item) => item.product.toString() === productId,
    );
    if (itemIndex === -1) {
      return res.status(404).json({ message: "Product not found in wishlist" });
    }
    wishlist.items.splice(itemIndex, 1);
    await wishlist.save();
    res
      .status(200)
      .json({ message: "Product removed from wishlist", data: wishlist });
  } catch (error) {
    res.status(500).json({ message: "Internal server error" });
  }
};

exports.clearWishlist = async (req, res) => {
  try {
    const userId = req.userId;
    const wishlist = await Wishlist.findOne({ user: userId });
    if (!wishlist) {
      return res.status(404).json({ message: "Wishlist not found" });
    } else {
      wishlist.items = [];
      await wishlist.save();
    }
    res
      .status(200)
      .json({ message: "Wishlist cleared successfully", data: wishlist });
  } catch (error) {
    res.status(500).json({ message: "Internal server error" });
  }
};
