const Product = require("../models/Product");
const { validationResult } = require("express-validator");
const User = require("../models/User");
const cloudinary = require("../config/cloudinary");

exports.getAllProducts = async (req, res) => {
  const { cursor, limit = 20 } = req.query;
  let query = {};

  if (cursor) {
    query = { _id: { $lt: cursor } };
  }
  try {
    const products = await Product.find(query)
      .sort({ _id: -1 })
      .limit(Number(limit) + 1);

    let hasMore = false;
    if (products.length > limit) {
      hasMore = true;
      products.pop();
    }

    const nextCursor = hasMore ? products[products.length - 1]._id : null;

    res.status(200).json({
      data: products,
      message: "Products retrieved successfully",
      nextCursor,
      hasMore,
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

exports.getSingleUser = async (req, res) => {
  try {
    const userId = req.userId;
    const user = await User.findById(userId).select("-password");
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    res
      .status(200)
      .json({ message: "User retrieved successfully", data: user });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error retrieving user", error: error.message });
  }
};

exports.updateUserProfile = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json({
        message: "Validation failed",
        errors: errors.array(),
      });
    }

    const userId = req.userId;
    const { name, email, phone } = req.body;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (email && email !== user.email) {
      const existingUser = await User.findOne({ email, _id: { $ne: userId } });
      if (existingUser) {
        return res
          .status(409)
          .json({ message: "E-Mail address already exists" });
      }
      user.email = email;
      user.isVerified = false;
      user.verificationToken = undefined;
      user.verificationTokenExpiry = undefined;
    }

    if (name !== undefined) user.name = name;
    if (phone !== undefined) user.phone = phone;

    if (req.file) {
      if (user.imagePublicId) {
        await cloudinary.uploader.destroy(user.imagePublicId);
      }
      const uploadResult = await new Promise((resolve, rejected) => {
        const stream = cloudinary.uploader.upload_stream(
          { folder: "users" },
          (error, result) => {
            if (error) return rejected(error);
            return resolve(result);
          },
        );
        stream.end(req.file.buffer);
      });
      user.imagePublicId = uploadResult.public_id;
      user.image = uploadResult.secure_url;
    }

    const updatedUser = await user.save();
    const userData = updatedUser.toObject();
    delete userData.password;
    delete userData.verificationToken;
    delete userData.verificationTokenExpiry;
    delete userData.resetPasswordToken;
    delete userData.resetPasswordTokenExpiry;

    res.status(200).json({
      message: "User profile updated successfully",
      data: userData,
    });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error updating user profile", error: error.message });
  }
};
