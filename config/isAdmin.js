module.exports = (req, res, next) => {
  if (!req.userId) {
    return res.status(401).json({ message: "Not authenticated" });
  }

  if (!["admin", "superadmin"].includes(req.userRole)) {
    return res.status(403).json({ message: "Not authorized" });
  }

  next();
};
