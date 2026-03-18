const jwt = require("jsonwebtoken");
const User = require("../models/User");

module.exports = async (req, res, next) => {
  try {
    const authHeader = req.get("Authorization");
    if (!authHeader) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    const token = authHeader.split(" ")[1];
    if (!token) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    let decodedToken;
    try {
      decodedToken = jwt.verify(token, process.env.JWT_Secret);
    } catch (err) {
      return res.status(401).json({ message: "Invalid or expired token" });
    }

    if (!decodedToken || !decodedToken.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    const user = await User.findById(decodedToken.userId).select("_id role");
    if (!user) {
      return res.status(401).json({ message: "User no longer exists" });
    }

    req.userId = user._id.toString();
    req.userRole = user.role;
    next();
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Authentication failed" });
  }
};
