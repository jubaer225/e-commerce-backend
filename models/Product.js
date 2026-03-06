const { getDB } = require("../util/database");
const { ObjectId } = require("mongodb");

class Product {
  constructor(title, price, description, imageUrl) {
    this.title = title;
    this.price = price;
    this.description = description;
    this.imageUrl = imageUrl;
  }

  save() {
    const db = getDB();
    return db.collection("products").insertOne(this);
  }

  static fetchAll() {
    const db = getDB();
    return db.collection("products").find().toArray();
  }

  static findById(prodId) {
    const db = getDB();
    return db.collection("products").findOne({ _id: new ObjectId(prodId) });
  }
}

module.exports = Product;
