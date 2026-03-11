const express = require("express");
const mongoose = require("mongoose");
require("dotenv").config();

const app = express();

const adminRoutes = require("./routes/admin");
const shopRoutes = require("./routes/shop");
const authRoutes = require("./routes/auth");

app.use(express.json());

app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET, POST, PUT, PATCH, DELETE",
  );
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  next();
});

app.use("/admin", adminRoutes);
app.use("/shop", shopRoutes);
app.use("/auth", authRoutes);

app.use((error, req, res, next) => {
  if (error && error.code === "LIMIT_FILE_SIZE") {
    return res
      .status(413)
      .json({ message: "File is too large. Max size is 5MB" });
  }

  if (error) {
    return res.status(400).json({ message: error.message || "Request failed" });
  }

  next();
});

mongoose
  .connect(process.env.Mongodb_Uri, {
    dbName: process.env.Database_Name,
  })
  .then((result) => {
    app.listen(8080);
    console.log("the Server is running on port 8080");
  })
  .catch((err) => {
    console.error("Error connecting to MongoDB:", err);
  });
