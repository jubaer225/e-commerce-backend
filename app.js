const express = require("express");

const adminRoutes = require("./routes/admin");
const shopRoutes = require("./routes/shop");

const app = express();
const { connectToDB } = require("./util/database");

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use("/admin", adminRoutes);

app.use(shopRoutes);

app.use((req, res, next) => {
  res.status(404).json({ message: "Route not found" });
});

connectToDB()
  .then(() => {
    app.listen(3000, () => {
      console.log("Server is running on port 3000");
    });
  })
  .catch((err) => {
    console.error("Failed to connect to database", err);
  });
