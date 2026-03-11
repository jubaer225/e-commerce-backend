const express = require("express");
const { body } = require("express-validator");
const shopController = require("../controllers/shopController");

const router = express.Router();

router.get("/products", shopController.getAllProducts);
router.get("/products/:id", shopController.getSingleProduct);

module.exports = router;
