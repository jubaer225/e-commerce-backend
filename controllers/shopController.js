const Product = require("../models/Product");
const { validationResult } = require("express-validator");
const User = require("../models/User");
const cloudinary = require("../config/cloudinary");
const mongoose = require("mongoose");

exports.getAllProducts = async (req, res) => {
  const { cursor, limit = 20, search, category, sort } = req.query;

  const parseNumber = (value) => {
    if (value === undefined || value === null || value === "") {
      return null;
    }
    const numberValue = Number(value);
    return Number.isFinite(numberValue) ? numberValue : null;
  };

  const normalizeText = (value) => {
    if (value === undefined || value === null) {
      return "";
    }
    return String(value).trim();
  };

  const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  const encodeCursor = (cursorData) => {
    return Buffer.from(JSON.stringify(cursorData)).toString("base64url");
  };

  const decodeCursor = (cursorToken) => {
    try {
      return JSON.parse(Buffer.from(cursorToken, "base64url").toString("utf8"));
    } catch (error) {
      return null;
    }
  };

  const getSortConfig = (sortValue) => {
    switch (normalizeText(sortValue).toLowerCase()) {
      case "az":
        return { field: "title", direction: 1 };
      case "za":
        return { field: "title", direction: -1 };
      case "lowtohigh":
        return { field: "price", direction: 1 };
      case "hightolow":
        return { field: "price", direction: -1 };
      case "oldest":
        return { field: "createdAt", direction: 1 };
      default:
        return { field: "createdAt", direction: -1 };
    }
  };

  const buildQuerySignature = (filters) => {
    return JSON.stringify({
      search: normalizeText(filters.search).toLowerCase(),
      category: normalizeText(filters.category).toLowerCase(),
      minPrice: parseNumber(filters.minPrice),
      maxPrice: parseNumber(filters.maxPrice),
      minRating: parseNumber(filters.minRating),
      sort: normalizeText(filters.sort).toLowerCase(),
    });
  };

  const buildCursorQuery = ({
    sortField,
    sortDirection,
    cursorToken,
    signature,
  }) => {
    if (!cursorToken) {
      return null;
    }

    const decodedCursor = decodeCursor(cursorToken);
    if (!decodedCursor) {
      const error = new Error("Invalid cursor token");
      error.statusCode = 400;
      throw error;
    }

    if (
      decodedCursor.field !== sortField ||
      decodedCursor.direction !== sortDirection ||
      decodedCursor.signature !== signature
    ) {
      const error = new Error(
        "Cursor does not match the current search, filter, or sort options",
      );
      error.statusCode = 400;
      throw error;
    }

    const cursorId = new mongoose.Types.ObjectId(decodedCursor.id);
    const cursorValue = decodedCursor.value;
    const comparisonOperator = sortDirection === 1 ? "$gt" : "$lt";

    return {
      $or: [
        { [sortField]: { [comparisonOperator]: cursorValue } },
        {
          [sortField]: cursorValue,
          _id: { [comparisonOperator]: cursorId },
        },
      ],
    };
  };

  const query = {};
  const searchText = normalizeText(search);
  const categoryText = normalizeText(category);
  const minPriceValue = parseNumber(req.query.minPrice ?? req.query.minprice);
  const maxPriceValue = parseNumber(req.query.maxPrice ?? req.query.maxprice);
  const minRatingValue = parseNumber(
    req.query.minRating ?? req.query.minrating,
  );
  const pageSize = Math.min(Math.max(parseNumber(limit) || 20, 1), 100);
  const sortConfig = getSortConfig(sort);
  const signature = buildQuerySignature({
    search: searchText,
    category: categoryText,
    minPrice: minPriceValue,
    maxPrice: maxPriceValue,
    minRating: minRatingValue,
    sort,
  });

  if (searchText) {
    const safeSearch = escapeRegex(searchText);
    query.$or = [
      { title: { $regex: safeSearch, $options: "i" } },
      { description: { $regex: safeSearch, $options: "i" } },
      { category: { $regex: safeSearch, $options: "i" } },
      { brand: { $regex: safeSearch, $options: "i" } },
    ];
  }

  if (categoryText) {
    query.category = {
      $regex: `^${escapeRegex(categoryText)}$`,
      $options: "i",
    };
  }

  if (minPriceValue !== null || maxPriceValue !== null) {
    query.price = {};
    if (minPriceValue !== null) query.price.$gte = minPriceValue;
    if (maxPriceValue !== null) query.price.$lte = maxPriceValue;
  }

  if (minRatingValue !== null && minRatingValue > 0) {
    query.averageRating = { $gte: minRatingValue };
  }

  try {
    const cursorQuery = buildCursorQuery({
      sortField: sortConfig.field,
      sortDirection: sortConfig.direction,
      cursorToken: cursor,
      signature,
    });

    if (cursorQuery) {
      query.$and = query.$and || [];
      query.$and.push(cursorQuery);
    }

    const sortOption = {
      [sortConfig.field]: sortConfig.direction,
      _id: sortConfig.direction,
    };

    const products = await Product.find(query)
      .sort(sortOption)
      .limit(pageSize + 1);

    let hasMore = false;
    if (products.length > pageSize) {
      hasMore = true;
      products.pop();
    }

    const nextCursor = hasMore
      ? encodeCursor({
          field: sortConfig.field,
          direction: sortConfig.direction,
          value: products[products.length - 1][sortConfig.field],
          id: products[products.length - 1]._id.toString(),
          signature,
        })
      : null;

    res.status(200).json({
      data: products,
      message: "Products retrieved successfully",
      nextCursor,
      hasMore,
    });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({
        message: error.message,
      });
    }

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
