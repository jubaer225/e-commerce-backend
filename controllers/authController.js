const User = require("../models/User");
const { validationResult } = require("express-validator");
const bcrypt = require("bcryptjs");
const cloudinary = require("../config/cloudinary");

exports.postSignup = async (req, res) => {
  try {
    const { name, email, password, phone } = req.body;

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json({
        message: "Validation failed",
        errors: errors.array(),
      });
    }

    let uploadResult;
    if (req.file) {
      uploadResult = await new Promise((resolve, rejected) => {
        const stream = cloudinary.uploader.upload_stream(
          { folder: "users" },
          (error, result) => {
            if (error) return rejected(error);
            resolve(result);
          },
        );
        stream.end(req.file.buffer);
      });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const user = new User({
      name,
      email,
      password: hashedPassword,
      phone,
      image: uploadResult ? uploadResult.secure_url : undefined,
      imagePublicId: uploadResult ? uploadResult.public_id : undefined,
    });

    const savedUser = await user.save();
    res.status(201).json({
      message: "User created successfully",
      data: {
        id: savedUser._id,
        name: savedUser.name,
        email: savedUser.email,
        phone: savedUser.phone,
        image: savedUser.image,
        imagePublicId: savedUser.imagePublicId,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      message: "An error occurred while creating the user",
    });
  }
};

exports.postLogin = async (req, res) => {
  // Login logic will be implemented here
};
