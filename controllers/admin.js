const Product = require("../models/Product");

exports.getAddProduct = (req, res) => {
  res.send(
    '<form action="/admin/add-product" method="POST"><div><label for="title">Title</label><input type="text" id="title" name="title" required></div><div><label for="image">Image URL</label><input type="url" id="image" name="image" required></div><div><label for="description">Description</label><textarea id="description" name="description" rows="4" required></textarea></div><div><label for="price">Price</label><input type="number" id="price" name="price" min="0" step="0.01" required></div><button type="submit">Add Product</button></form>',
  );
};

exports.postAddProduct = (req, res) => {
  const { title, price, description, image } = req.body;

  const product = new Product(title, price, description, image);
  product.save().then(() => {
    console.log("product saved successfully");
    res.redirect("/");
  });
};
