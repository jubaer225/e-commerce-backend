const Review = require("../models/review.model");
const Product = require("../models/Product");
const mongoose = require("mongoose");
const Order = require("../models/order.model");

exports.postReview = async (req, res) => {
  try {
    const userId = req.userId;
    const { productId, rating, comment } = req.body;

    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({ message: "Invalid productId" });
    }

    const existingReview = await Review.findOne({
      user: userId,
      product: productId,
    });
    if (existingReview) {
      return res
        .status(400)
        .json({ message: "You have already reviewed this product" });
    }

    // check if the user has purchased the product before allowing them to review
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    const hasPurchased = await Order.exists({
      user: userId,
      "items.product": productId,
    });
    if (!hasPurchased) {
      return res.status(400).json({
        message: "You must purchase this product before reviewing it",
      });
    }
    const review = new Review({
      user: userId,
      product: productId,
      rating,
      comment,
    });
    await review.save();
    res
      .status(201)
      .json({ message: "Review submitted successfully", data: review });
  } catch (error) {
    res.status(500).json({ message: "Internal server error" });
  }
};

exports.getReviewsByProduct = async (req, res) => {
  try {
    const { productId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({ message: "Invalid productId" });
    }

    const reviews = await Review.find({ product: productId })
      .populate("user", "name profileImage")
      .sort({ createdAt: -1 });
    res
      .status(200)
      .json({ message: "Reviews retrieved successfully", data: reviews });
  } catch (error) {
    res.status(500).json({ message: "Internal server error" });
  }
};

exports.updateReview = async (req, res) => {
  try {
    const userId = req.userId;
    const { id } = req.params;
    const { rating, comment } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid review id" });
    }

    const review = await Review.findById(id);
    if (!review) {
      return res.status(404).json({ message: "Review not found" });
    }
    review.rating = rating || review.rating;
    review.comment = comment || review.comment;
    await review.save();
    res
      .status(200)
      .json({ message: "Review updated successfully", data: review });
  } catch (error) {
    res.status(500).json({ message: "Internal server error" });
  }
};

exports.deleteReview = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid review id" });
    }
    const review = await Review.findById(id);
    if (!review) {
      return res.status(404).json({ message: "Review not found" });
    }
    await review.remove();
    res.status(200).json({ message: "Review deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Internal server error" });
  }
};
