const Product = require("../models/Product");
const { validationResult } = require("express-validator");
const cloudinary = require("../config/cloudinary");

exports.getProducts = (req, res) => {
  res.status(200).json({ message: "Admin Products will be here" });
};

exports.createProduct = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res
        .status(422)
        .json({ errors: errors.array(), message: "Validation failed" });
    }
    if (!req.file) {
      return res.status(422).json({ message: "Image file is required" });
    }

    const uploadResult = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { folder: "products" },
        (error, result) => {
          if (error) return reject(error);
          resolve(result);
        },
      );
      stream.end(req.file.buffer);
    });
    const { title, price, description, category, brand, stock } = req.body;

    const product = new Product({
      title,
      price,
      description,
      images: [uploadResult.secure_url],
      category,
      brand,
      stock,
      imagePublicId: uploadResult.public_id,
    });

    const saved = await product.save();
    return res.status(201).json({
      message: "Product created successfully",
      data: saved,
      cloudinary: {
        public_id: uploadResult.public_id,
        secure_url: uploadResult.secure_url,
      },
    });
  } catch (err) {
    console.error("Error creating product:", err);
    return res.status(500).json({ message: "Creating product failed" });
  }
};
