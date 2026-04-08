const User = require("../models/User");
const { validationResult } = require("express-validator");
const bcrypt = require("bcryptjs");
const cloudinary = require("../config/cloudinary");
const jwt = require("jsonwebtoken");
require("dotenv").config();
const { sendEmail } = require("../config/sendEmails");
const crypto = require("crypto");

const isProduction = process.env.NODE_ENV === "production";
const refreshCookieOptions = {
  httpOnly: true,
  secure: isProduction,
  sameSite: isProduction ? "none" : "lax",
};

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
    const verificationToken = crypto.randomBytes(32).toString("hex");
    const verificationTokenExpiry = Date.now() + 24 * 60 * 60 * 1000; // 24 hours

    const user = new User({
      name,
      email,
      password: hashedPassword,
      phone,
      image: uploadResult ? uploadResult.secure_url : undefined,
      imagePublicId: uploadResult ? uploadResult.public_id : undefined,
      verificationToken,
      verificationTokenExpiry,
    });

    const savedUser = await user.save();

    const varifyableUrl = `http://localhost:5173/verify-email?token=${verificationToken}`;
    const emailHtml = `
      <h1>Email Verification</h1>
      <p>Click the link below to verify your email:</p>
      <a href="${varifyableUrl}">Verify Email</a>
    `;

    await sendEmail(user.email, "Email Verification", emailHtml);

    res.status(201).json({
      message:
        "User registered, Please check your email to verify your account",
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
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email: email });
    if (!user) {
      return res
        .status(401)
        .json({ message: "There are no user with that email" });
    }

    if (!user.isVerified) {
      return res.status(401).json({ message: "Email is not verified" });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ message: "Invalid password" });
    }

    const accessToken = jwt.sign(
      { userId: user._id.toString(), role: user.role },
      process.env.JWT_Secret,
      { expiresIn: "1h" },
    );

    const refreshToken = jwt.sign(
      { userId: user._id.toString(), email: user.email },
      process.env.JWT_Refresh_Secret,
      { expiresIn: "30d" },
    );

    res.cookie("refreshToken", refreshToken, refreshCookieOptions);

    res.status(200).json({
      message: "Login successfull",
      accessToken: accessToken,
      user: {
        userId: user._id.toString(),
        email: user.email,
        role: user.role,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      message: "An error occurred while logging in",
    });
  }
};

exports.verifyEmail = async (req, res) => {
  try {
    const token = req.params.token || req.query.token || req.body.token;

    if (!token) {
      return res
        .status(400)
        .json({ message: "Verification token is required" });
    }

    const user = await User.findOne({ verificationToken: token });
    if (!user) {
      return res.status(400).json({ message: "Invalid verification token" });
    }

    if (user.verificationTokenExpiry < Date.now()) {
      return res
        .status(400)
        .json({ message: "Verification token has expired" });
    }

    user.isVerified = true;
    user.verificationToken = undefined;
    user.verificationTokenExpiry = undefined;
    await user.save();

    res.status(200).json({ message: "Email verified successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      message: "An error occurred while verifying the email",
    });
  }
};

exports.resendVerificationEmail = async (req, res) => {
  try {
    const { email } = req.body;

    const user = await User.findOne({ email: email });
    if (!user) {
      return res
        .status(404)
        .json({ message: "There are no user with that email" });
    }

    if (user.isVerified) {
      return res.status(400).json({ message: "Email is already verified" });
    }

    const verificationToken = crypto.randomBytes(32).toString("hex");
    user.verificationToken = verificationToken;
    user.verificationTokenExpiry = Date.now() + 24 * 60 * 60 * 1000;
    await user.save();

    const varifyableUrl = `http://localhost:5173/verify-email?token=${verificationToken}`;
    const emailHtml = `
      <h1>Email Verification</h1>
      <p>Click the link below to verify your email:</p>
      <a href="${varifyableUrl}">Verify Email</a>
    `;

    await sendEmail(user.email, "Email Verification", emailHtml);

    res.status(200).json({ message: "Verification email sent successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      message: "An error occurred while resending the verification email",
    });
  }
};

exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    const user = await User.findOne({ email: email });
    if (!user) {
      return res
        .status(404)
        .json({ message: "There are no user with that email" });
    }

    const resetToken = crypto.randomBytes(32).toString("hex");
    user.resetPasswordToken = resetToken;
    user.resetPasswordTokenExpiry = Date.now() + 60 * 60 * 1000;

    await user.save();

    const resetUrl = `http://localhost:5173/reset-password?token=${resetToken}`;
    const emailHtml = `
      <h1>Password Reset</h1>
      <p>Click the link below to reset your password:</p>
      <a href="${resetUrl}">Reset Password</a>
    `;
    await sendEmail(user.email, "Password Reset", emailHtml);

    res
      .status(200)
      .json({ message: "Check your email for reset instructions" });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      message: "An error occurred while processing the forgot password request",
    });
  }
};

exports.resetPassword = async (req, res) => {
  try {
    const { token } = req.params;
    const { password, confirmpassword } = req.body;

    const user = await User.findOne({ resetPasswordToken: token });
    if (!user) {
      return res.status(400).json({ message: "Invalid reset token" });
    }

    if (user.resetPasswordTokenExpiry < Date.now()) {
      return res.status(400).json({ message: "Reset token has expired" });
    }

    if (password !== confirmpassword) {
      return res.status(400).json({ message: "Passwords do not match" });
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    user.password = hashedPassword;
    user.resetPasswordToken = undefined;
    user.resetPasswordTokenExpiry = undefined;
    await user.save();

    res.status(200).json({ message: "Password reset successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      message: "An error occurred while resetting the password",
    });
  }
};

exports.changePassword = async (req, res) => {
  try {
    const userId = req.userId || req.params.userId;
    const { currentPassword, newPassword, confirmNewPassword } = req.body;

    if (!userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const isCurrentPasswordValid = await bcrypt.compare(
      currentPassword,
      user.password,
    );
    if (!isCurrentPasswordValid) {
      return res.status(400).json({ message: "Current password is incorrect" });
    }

    if (newPassword !== confirmNewPassword) {
      return res
        .status(400)
        .json({ message: "New passwords and confirm password do not match" });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 12);
    user.password = hashedPassword;
    await user.save();

    res.status(200).json({ message: "Password changed successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      message: "An error occurred while changing the password",
    });
  }
};

exports.refreshToken = async (req, res) => {
  try {
    const refreshToken = req.cookies.refreshToken;
    if (!refreshToken) {
      return res.status(401).json({ message: "No refresh token provided" });
    }
    jwt.verify(
      refreshToken,
      process.env.JWT_Refresh_Secret,
      async (err, decoded) => {
        if (err) {
          return res.status(401).json({ message: "Invalid refresh token" });
        }
        const user = await User.findById(decoded.userId);
        if (!user) {
          return res.status(401).json({ message: "User not found" });
        }
        const accessToken = jwt.sign(
          { userId: user._id.toString(), role: user.role },
          process.env.JWT_Secret,
          { expiresIn: "1h" },
        );
        res.status(200).json({
          message: "Token refreshed successfully",
          accessToken,
          user: {
            userId: user._id.toString(),
            email: user.email,
            role: user.role,
          },
        });
      },
    );
  } catch (err) {
    console.error(err);
    res.status(500).json({
      message: "An error occurred while refreshing the token",
    });
  }
};

exports.logout = async (req, res) => {
  try {
    res.clearCookie("refreshToken", refreshCookieOptions);
    res.status(200).json({ message: "Logged out successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      message: "An error occurred while logging out",
    });
  }
};
