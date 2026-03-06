const express = require("express");

const router = express.Router();

const shopController = require("../controllers/shop");

router.get("/products", shopController.getAllProducts);
router.get("/products/:productId", shopController.getProduct);

module.exports = router;
