const Product = require("../models/Product");
const { validationResult } = require("express-validator");

exports.getAllProducts = async (req, res) => {
  const currentPage = parseInt(req.query.page) || 1;
  const itemsPerPage = parseInt(req.query.limit) || 10;
  const skip = (currentPage - 1) * itemsPerPage;
  let totalItems;
  try {
    totalItems = await Product.countDocuments();
    const products = await Product.find().skip(skip).limit(itemsPerPage);
    res.status(200).json({
      data: products,
      message: "Products retrieved successfully",
      pagination: {
        currentPage,
        itemsPerPage,
        totalItems,
        totalPages: Math.ceil(totalItems / itemsPerPage),
      },
    });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error retrieving products", error: error.message });
  }
};

exports.getSingleProduct = async (req, res) => {
  try {
    const productId = req.params.id;
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ message: "product not found" });
    }
    res
      .status(200)
      .json({ data: product, message: "Product retrieved successfully" });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error retrieving product", error: error.message });
  }
};
