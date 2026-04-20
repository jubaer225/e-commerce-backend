const mongoose = require("mongoose");

const ImageSchema = new mongoose.Schema({
  url: {
    type: String,
    required: true,
  },
  publicId: {
    type: String,
    required: true,
  },
});

const productSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
    },
    price: {
      type: Number,
      required: true,
    },
    description: {
      type: String,
      required: true,
    },
    images: [ImageSchema],
    category: {
      type: String,
    },
    averageRating: {
      type: Number,
      default: 0,
    },
    numberOfReviews: {
      type: Number,
      default: 0,
    },
    brand: {
      type: String,
    },
    stock: {
      type: Number,
    },
    imagePublicId: {
      type: String,
    },
  },
  { timestamps: true },
);

productSchema.index({ title: "text", description: "text" });
productSchema.index({ category: 1, createdAt: -1, _id: -1 });
productSchema.index({ category: 1, price: 1, _id: 1 });
productSchema.index({ category: 1, title: 1, _id: 1 });
productSchema.index({ price: 1, _id: 1 });
productSchema.index({ title: 1, _id: 1 });
productSchema.index({ averageRating: -1, _id: -1 });

module.exports = mongoose.model("product", productSchema);
