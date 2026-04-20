const Product = require("../models/Product");
const { validationResult } = require("express-validator");
const cloudinary = require("../config/cloudinary");

const uploadFileToCloudinary = (file) => {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: "products" },
      (error, result) => {
        if (error) return reject(error);
        resolve({
          publicId: result.public_id,
          url: result.secure_url,
        });
      },
    );
    stream.end(file.buffer);
  });
};

const getProductPublicIds = (product) => {
  const imagePublicIds = Array.isArray(product.images)
    ? product.images
        .map((image) => image && (image.publicId || image.public_id))
        .filter(Boolean)
    : [];

  if (product.imagePublicId) {
    imagePublicIds.push(product.imagePublicId);
  }

  return [...new Set(imagePublicIds)];
};

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
    if (!req.files || req.files.length === 0) {
      return res.status(422).json({ message: "Image file is required" });
    }

    const images = await Promise.all(req.files.map(uploadFileToCloudinary));

    const { title, price, description, category, brand, stock } = req.body;

    const product = new Product({
      title,
      price,
      description,
      images,
      imagePublicId: images[0]?.publicId,
      category,
      brand,
      stock,
    });

    const saved = await product.save();
    return res.status(201).json({
      message: "Product created successfully",
      data: saved,
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
    if (req.files && req.files.length > 0) {
      const uploadedImages = await Promise.all(
        req.files.map(uploadFileToCloudinary),
      );

      // Delete old images only after the new ones are safely uploaded.
      const previousPublicIds = getProductPublicIds(product);
      await Promise.all(
        previousPublicIds.map((publicId) =>
          cloudinary.uploader.destroy(publicId),
        ),
      );

      product.images = uploadedImages;
      product.imagePublicId = uploadedImages[0]?.publicId;
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

    const publicIds = getProductPublicIds(product);
    await Promise.all(
      publicIds.map((publicId) => cloudinary.uploader.destroy(publicId)),
    );

    await Product.findByIdAndDelete(productId);
    return res.status(200).json({ message: "Product deleted Successfully" });
  } catch (err) {
    console.error("Error deleting product:", err);
    return res.status(500).json({ message: "Deleting product failed" });
  }
};
