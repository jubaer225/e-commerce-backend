const express = require("express");
const { body } = require("express-validator");
const upload = require("../middleware/upload");
const router = express.Router();
const adminController = require("../controllers/adminController");

router.get("/products", adminController.getProducts);
router.post(
  "/add-product",
  upload.single("images"),
  [
    body("title").notEmpty().withMessage("Title is required"),
    body("price")
      .isFloat({ gt: 0 })
      .withMessage("Price must be a positive number"),
    body("description").notEmpty().withMessage("Description is required"),
  ],
  adminController.createProduct,
);

module.exports = router;
