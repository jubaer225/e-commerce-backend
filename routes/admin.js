const express = require("express");
const { body } = require("express-validator");
const upload = require("../middleware/upload");
const isAuth = require("../config/isAuth");
const isAdmin = require("../config/isAdmin");
const router = express.Router();
const adminController = require("../controllers/adminController");
const categoryController = require("../controllers/categoryController");
const orderController = require("../controllers/orderController");

router.use(isAuth, isAdmin);

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

router.put(
  "/edit-product/:id",
  upload.single("images"),
  [
    body("title").notEmpty().withMessage("Title is required"),
    body("price")
      .isFloat({ gt: 0 })
      .withMessage("Price must be a positive number"),
    body("description").notEmpty().withMessage("Description is required"),
  ],
  adminController.editProduct,
);

router.delete("/delete-product/:id", adminController.deleteProduct);

router.post("/categories", categoryController.createCategory);

router.get("/categories/:id", categoryController.getCategoryById);

router.put("/categories/:id", categoryController.editCategory);

router.delete("/categories/:id", categoryController.deleteCategory);

router.get("/orders", orderController.getAllOrders);
router.get("/orders/:id", orderController.getOrderById);
router.patch("/orders/:id/status", orderController.updateOrderStatus);
router.delete("/orders/:id", orderController.deleteOrder);

module.exports = router;
