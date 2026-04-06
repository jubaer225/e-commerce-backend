module.exports = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.userRole) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    if (!allowedRoles.includes(req.userRole)) {
      return res.status(403).json({ message: "Not authorized" });
    }
    next();
  };
};
