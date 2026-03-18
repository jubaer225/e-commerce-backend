const Category = require("../models/Category");
const mongoose = require("mongoose");

const buildCategoryTree = (categories) => {
  const categoryMap = new Map();
  const roots = [];

  categories.forEach((category) => {
    categoryMap.set(category._id.toString(), {
      _id: category._id,
      name: category.name,
      slug: category.slug,
      parentCategory: category.parentCategory,
      isActive: category.isActive,
      children: [],
    });
  });

  categoryMap.forEach((node) => {
    const parentId = node.parentCategory
      ? node.parentCategory.toString()
      : null;

    if (!parentId || !categoryMap.has(parentId)) {
      roots.push(node);
      return;
    }

    categoryMap.get(parentId).children.push(node);
  });

  const sortTree = (nodes) => {
    nodes.sort((a, b) => a.name.localeCompare(b.name));
    nodes.forEach((node) => sortTree(node.children));
  };

  sortTree(roots);
  return roots;
};

const createsCategoryCycle = async (categoryId, proposedParentId) => {
  let currentParentId = proposedParentId;

  while (currentParentId) {
    if (currentParentId.toString() === categoryId.toString()) {
      return true;
    }

    const parentCategory = await Category.findById(currentParentId)
      .select("parentCategory")
      .lean();

    if (!parentCategory || !parentCategory.parentCategory) {
      return false;
    }

    currentParentId = parentCategory.parentCategory;
  }

  return false;
};

/////////////////////////////////////////////////////////////////////////////
////////// Public Controllers for Categories
/////////////////////////////////////////////////////////////////////////////

exports.getAllCategories = async (req, res) => {
  try {
    const categories = await Category.find();
    res
      .status(200)
      .json({ message: "Categories retrieved successfully", data: categories });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error retrieving categories", error: error.message });
  }
};

exports.getCategoryBySlug = async (req, res) => {
  try {
    const slug = req.params.slug;
    const category = await Category.findOne({ slug: slug });
    res
      .status(200)
      .json({ message: "Category retrieved successfully", data: category });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error retrieving category", error: error.message });
  }
};

exports.getCategoryTree = async (req, res) => {
  try {
    const categories = await Category.find()
      .select("name slug parentCategory isActive")
      .lean();

    const categoryTree = buildCategoryTree(categories);

    res.status(200).json({
      message: "Category tree retrieved successfully",
      data: categoryTree,
    });
  } catch (error) {
    res.status(500).json({
      message: "Error retrieving category tree",
      error: error.message,
    });
  }
};

/////////////////////////////////////////////////////////////////////////////////////// Admin Controllers for Categories
///////////////////////////////////////////////////////////////////////////////////

exports.createCategory = async (req, res) => {
  try {
    const { name, parentCategory, isActive } = req.body;

    const normalizedName = typeof name === "string" ? name.trim() : "";
    if (!normalizedName) {
      return res.status(422).json({ message: "Name is required" });
    }

    let normalizedParentCategory = null;
    if (
      parentCategory !== undefined &&
      parentCategory !== null &&
      parentCategory !== ""
    ) {
      if (!mongoose.Types.ObjectId.isValid(parentCategory)) {
        return res.status(422).json({ message: "Invalid parent category id" });
      }

      const parentExists = await Category.exists({ _id: parentCategory });
      if (!parentExists) {
        return res.status(404).json({ message: "Parent category not found" });
      }

      normalizedParentCategory = parentCategory;
    }

    const existingCategory = await Category.findOne({
      name: normalizedName,
    }).collation({ locale: "en", strength: 2 });
    if (existingCategory) {
      return res
        .status(409)
        .json({ message: "Category with this name already exists" });
    }

    const category = new Category({
      name: normalizedName,
      parentCategory: normalizedParentCategory,
      isActive: typeof isActive === "boolean" ? isActive : undefined,
    });

    await category.save();

    res
      .status(201)
      .json({ message: "Category created successfully", data: category });
  } catch (error) {
    if (error.code === 11000) {
      return res
        .status(409)
        .json({ message: "Category already exists", error: error.message });
    }

    res
      .status(500)
      .json({ message: "Error creating category", error: error.message });
  }
};

exports.getCategoryById = async (req, res) => {
  try {
    const categoryId = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(categoryId)) {
      return res.status(422).json({ message: "Invalid category id" });
    }
    const category = await Category.findById(categoryId);
    if (!category) {
      return res.status(404).json({ message: "Category not found" });
    }
    res
      .status(200)
      .json({ message: "Category retrieved successfully", data: category });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error retrieving category", error: error.message });
  }
};

exports.editCategory = async (req, res) => {
  try {
    const categoryId = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(categoryId)) {
      return res.status(422).json({ message: "Invalid category id" });
    }
    const category = await Category.findById(categoryId);
    if (!category) {
      return res.status(404).json({ message: "Category not found" });
    }
    const { name, parentCategory, isActive } = req.body;

    if (name !== undefined) {
      const normalizedName = typeof name === "string" ? name.trim() : "";
      if (!normalizedName) {
        return res.status(422).json({ message: "Name cannot be empty" });
      }
      const existingCategory = await Category.findOne({
        name: normalizedName,
        _id: { $ne: categoryId },
      }).collation({ locale: "en", strength: 2 });
      if (existingCategory) {
        return res
          .status(409)
          .json({ message: "Category with this name already exists" });
      }
      category.name = normalizedName;
    }

    if (parentCategory !== undefined) {
      if (parentCategory !== null && parentCategory !== "") {
        if (!mongoose.Types.ObjectId.isValid(parentCategory)) {
          return res
            .status(422)
            .json({ message: "Invalid parent category id" });
        }

        if (parentCategory === categoryId) {
          return res
            .status(422)
            .json({ message: "Category cannot be its own parent" });
        }

        const parentExists = await Category.exists({ _id: parentCategory });
        if (!parentExists) {
          return res.status(404).json({ message: "Parent category not found" });
        }

        const wouldCreateCycle = await createsCategoryCycle(
          categoryId,
          parentCategory,
        );
        if (wouldCreateCycle) {
          return res.status(422).json({
            message: "Cannot assign a descendant category as parent",
          });
        }

        category.parentCategory = parentCategory;
      } else {
        category.parentCategory = null;
      }
    }

    if (isActive !== undefined) {
      category.isActive = !!isActive;
    }

    await category.save();

    res
      .status(200)
      .json({ message: "Category updated successfully", data: category });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error editing category", error: error.message });
  }
};

exports.deleteCategory = async (req, res) => {
  try {
    const categoryId = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(categoryId)) {
      return res.status(422).json({ message: "Invalid category id" });
    }
    const category = await Category.findByIdAndDelete(categoryId);
    if (!category) {
      return res.status(404).json({ message: "Category not found" });
    }
    res
      .status(200)
      .json({ message: "Category deleted successfully", data: category });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error deleting category", error: error.message });
  }
};
