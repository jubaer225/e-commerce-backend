const express = require("express");
const { body } = require("express-validator");
const shopController = require("../controllers/shopController");
const categoryController = require("../controllers/categoryController");
const cartController = require("../controllers/cartController");
const orderController = require("../controllers/orderController");
const addressController = require("../controllers/addressController");
const reviewController = require("../controllers/reviewController");
const wishlistController = require("../controllers/wishlistController");
const isAuth = require("../config/isAuth");
const upload = require("../middleware/upload");

const router = express.Router();

router.get("/products", shopController.getAllProducts);
router.get("/products/:id", shopController.getSingleProduct);
router.get("/users/me", isAuth, shopController.getSingleUser);

const updateProfileValidators = [
  body("name").optional().notEmpty().withMessage("Name must not be empty"),
  body("email")
    .optional()
    .isEmail()
    .withMessage("Please enter a valid email address"),
  body("phone")
    .optional()
    .isNumeric()
    .withMessage("Phone number must be a valid number"),
];

router.post(
  "/users/me",
  isAuth,
  upload.single("profileImage"),
  updateProfileValidators,
  shopController.updateUserProfile,
);

router.put(
  "/users/me",
  isAuth,
  upload.single("profileImage"),
  updateProfileValidators,
  shopController.updateUserProfile,
);

router.get("/categories", categoryController.getAllCategories);
router.get("/categories/tree", categoryController.getCategoryTree);
router.get("/categories/:slug", categoryController.getCategoryBySlug);

router.post("/add-to-cart", isAuth, cartController.addToCart);
router.get("/cart", isAuth, cartController.getCart);
router.put("/cart/update", isAuth, cartController.updateCartItem);
router.delete("/cart/remove/:productId", isAuth, cartController.removeCartItem);
router.delete("/cart/clear", isAuth, cartController.clearCart);

router.post("/checkout", isAuth, orderController.checkout);

router.get("/orders", isAuth, orderController.getUserOrders);
router.get("/orders/:id", isAuth, orderController.getOrderById);

router.post("/addresses", isAuth, addressController.createAddress);
router.get("/addresses", isAuth, addressController.getUserAddresses);
router.get("/addresses/:id", isAuth, addressController.getAddressById);
router.put("/addresses/:id", isAuth, addressController.updateAddress);
router.delete("/addresses/:id", isAuth, addressController.deleteAddress);
router.patch(
  "/addresses/:id/default",
  isAuth,
  addressController.setDefaultAddress,
);

router.post("/reviews", isAuth, reviewController.postReview);
router.get("/reviews/:productId", reviewController.getReviewsByProduct);

router.post("/wishlist/:productId", isAuth, wishlistController.addToWishlist);
router.get("/wishlist", isAuth, wishlistController.getWishlist);
router.delete(
  "/wishlist/remove/:productId",
  isAuth,
  wishlistController.removeFromWishlist,
);
router.delete("/wishlist/clear", isAuth, wishlistController.clearWishlist);

module.exports = router;
