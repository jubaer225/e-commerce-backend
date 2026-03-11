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

exports.editProduct = async (req, res) => {
  const productId = req.params.id;
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res
        .status(422)
        .json({ errors: errors.array(), message: "Validation failed" });
    }

    const product = await Product.findById(productId);

    if (!product) {
      return res.status(404).json({ message: "product not found" });
    }
    const { title, price, description, category, brand, stock } = req.body;

    // Only touch Cloudinary if a new image was actually uploaded
    if (req.file) {
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

      // Delete old image from Cloudinary only after new one is uploaded
      if (product.imagePublicId) {
        await cloudinary.uploader.destroy(product.imagePublicId);
      }

      product.images = [uploadResult.secure_url];
      product.imagePublicId = uploadResult.public_id;
    }

    product.title = title;
    product.price = price;
    product.description = description;
    product.category = category;
    product.brand = brand;
    product.stock = stock;

    const updatedProduct = await product.save();
    return res.status(200).json({
      message: "Product updated successfully",
      data: updatedProduct,
    });
  } catch (err) {
    console.error("Error editing product:", err);
    return res.status(500).json({ message: "Editing product failed" });
  }
};

exports.deleteProduct = async (req, res) => {
  const productId = req.params.id;
  try {
    const product = await Product.findById(productId);

    if (!product) {
      return res.status(404).json({ message: "product is not found" });
    }

    if (product.imagePublicId) {
      await cloudinary.uploader.destroy(product.imagePublicId);
    }

    await Product.findByIdAndDelete(productId);
    return res.status(200).json({ message: "Product deleted Successfully" });
  } catch (err) {
    console.error("Error deleting product:", err);
    return res.status(500).json({ message: "Deleting product failed" });
  }
};
