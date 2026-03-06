const Product = require("../models/Product");

exports.getAllProducts = (req, res) => {
  Product.fetchAll()
    .then((products) => {
      res.json(products);
    })
    .catch((err) => {
      console.error("Error fetching products:", err);
      res.status(500).json({ error: "Failed to fetch products" });
    });
};

exports.getProduct = (req, res, next) => {
  const prodId = req.params.productId;
  Product.findById(prodId)
    .then((product) => {
      if (!product) {
        return res.status(404).json({ error: "Product not found" });
      }
      res.json(product);
    })
    .catch((err) => {
      console.error("Error fetching product:", err);
      res.status(500).json({ error: "Failed to fetch product" });
    });
};
