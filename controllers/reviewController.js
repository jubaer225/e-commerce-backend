const Review = require("../models/review.model");
const Product = require("../models/Product");
const mongoose = require("mongoose");
const Order = require("../models/order.model");

const updateProductRatingSummary = async (productId) => {
  const [summary] = await Review.aggregate([
    { $match: { product: new mongoose.Types.ObjectId(productId) } },
    {
      $group: {
        _id: "$product",
        averageRating: { $avg: "$rating" },
        numberOfReviews: { $sum: 1 },
      },
    },
  ]);

  await Product.findByIdAndUpdate(productId, {
    averageRating: summary ? summary.averageRating : 0,
    numberOfReviews: summary ? summary.numberOfReviews : 0,
  });
};

exports.postReview = async (req, res) => {
  try {
    const userId = req.userId;
    const { productId } = req.params;
    const { orderId, rating, comment } = req.body;

    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({ message: "Invalid productId" });
    }

    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      return res.status(400).json({ message: "Invalid orderId" });
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

    const order = await Order.findOne({
      _id: orderId,
      user: userId,
      "items.product": productId,
    });

    if (!order) {
      return res.status(400).json({
        message: "The selected order does not include this product",
      });
    }
    const review = new Review({
      user: userId,
      product: productId,
      order: orderId,
      rating,
      comment,
    });
    await review.save();
    await updateProductRatingSummary(productId);
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
    await updateProductRatingSummary(review.product);
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
    await updateProductRatingSummary(review.product);
    res.status(200).json({ message: "Review deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Internal server error" });
  }
};
