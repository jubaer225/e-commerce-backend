const express = require("express");
const { body } = require("express-validator");
const router = express.Router();
const upload = require("../middleware/upload");

const User = require("../models/User");
const authController = require("../controllers/authController");

router.post(
  "/signup",
  upload.single("image"),
  [
    body("name").not().isEmpty().withMessage("Name is required"),
    body("email")
      .custom(async (value, { req }) => {
        return User.findOne({ email: value }).then((userDoc) => {
          if (userDoc) {
            return Promise.reject("E-Mail address already exists!");
          }
        });
      })
      .isEmail()
      .withMessage("Please enter a valid email address"),
    body("password")
      .isLength({ min: 6 })
      .withMessage("Password must be at least 6 characters long"),
    body("phone")
      .optional()
      .isNumeric()
      .withMessage("Phone number must be a valid number"),
  ],
  authController.postSignup,
);

router.post("/login", authController.postLogin);

module.exports = router;
