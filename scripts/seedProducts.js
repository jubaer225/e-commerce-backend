require("dotenv").config();
const mongoose = require("mongoose");
const slugify = require("slugify");
const cloudinary = require("../config/cloudinary");

const Product = require("../models/Product");
const Category = require("../models/Category");

const categoryNames = [
  "Electronics",
  "Fashion",
  "Home & Kitchen",
  "Beauty",
  "Sports",
  "Books",
  "Toys",
  "Groceries",
];

const brandsByCategory = {
  Electronics: ["NovaTech", "PixelWare", "VoltEdge"],
  Fashion: ["UrbanNest", "Threadly", "North Lane"],
  "Home & Kitchen": ["Cookora", "Nestify", "HomeGrid"],
  Beauty: ["GlowMint", "PureAura", "SkinBloom"],
  Sports: ["ActiveCore", "SprintLab", "PeakMove"],
  Books: ["Readora", "PageCraft", "Inkline"],
  Toys: ["PlayMatic", "FunForge", "KidSpark"],
  Groceries: ["FreshFields", "DailyHarvest", "GreenCart"],
};

const CLOUDINARY_FOLDER = "seed-products";

function pickRandom(array) {
  return array[Math.floor(Math.random() * array.length)];
}

function randomPrice(category) {
  const ranges = {
    Electronics: [120, 1999],
    Fashion: [20, 300],
    "Home & Kitchen": [30, 600],
    Beauty: [8, 120],
    Sports: [15, 450],
    Books: [5, 60],
    Toys: [10, 140],
    Groceries: [2, 40],
  };

  const [min, max] = ranges[category] || [10, 200];
  return Number((Math.random() * (max - min) + min).toFixed(2));
}

function randomImageCount() {
  return pickRandom([3, 3, 4, 4, 5, 5, 6, 6]);
}

function buildSourceImageUrl(productNumber, imageNumber, randomSuffix) {
  return `https://picsum.photos/seed/product-${productNumber}-${imageNumber}-${randomSuffix}/1000/1000`;
}

async function uploadImageToCloudinary(productNumber, imageNumber) {
  const randomSuffix = `${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
  const sourceUrl = buildSourceImageUrl(
    productNumber,
    imageNumber,
    randomSuffix,
  );
  const publicId = `product-${productNumber}-${imageNumber}-${randomSuffix}`;

  const uploadResult = await cloudinary.uploader.upload(sourceUrl, {
    folder: CLOUDINARY_FOLDER,
    public_id: publicId,
    resource_type: "image",
  });

  return {
    secureUrl: uploadResult.secure_url,
    publicId: uploadResult.public_id,
  };
}

async function mapWithConcurrency(items, limit, mapper) {
  const results = new Array(items.length);
  let currentIndex = 0;

  async function worker() {
    while (currentIndex < items.length) {
      const indexToProcess = currentIndex;
      currentIndex += 1;
      results[indexToProcess] = await mapper(
        items[indexToProcess],
        indexToProcess,
      );
    }
  }

  const workers = Array.from({ length: Math.min(limit, items.length) }, () =>
    worker(),
  );
  await Promise.all(workers);
  return results;
}

async function clearSeedImagesFromCloudinary() {
  let nextCursor;

  do {
    const response = await cloudinary.api.resources({
      type: "upload",
      prefix: `${CLOUDINARY_FOLDER}/`,
      max_results: 100,
      next_cursor: nextCursor,
    });

    const publicIds = (response.resources || []).map(
      (resource) => resource.public_id,
    );
    if (publicIds.length > 0) {
      await cloudinary.api.delete_resources(publicIds, {
        type: "upload",
        resource_type: "image",
      });
    }

    nextCursor = response.next_cursor;
  } while (nextCursor);

  try {
    await cloudinary.api.delete_folder(CLOUDINARY_FOLDER);
  } catch (error) {
    if (error && error.http_code === 404) {
      return;
    }
    throw error;
  }
}

async function seedCategories() {
  for (const name of categoryNames) {
    const slug = slugify(name, { lower: true, strict: true });
    await Category.findOneAndUpdate(
      { name },
      {
        $set: { slug },
        $setOnInsert: { name },
      },
      { upsert: true },
    );
  }
}

async function buildProducts(totalProducts) {
  const indexes = Array.from({ length: totalProducts }, (_, index) => index);

  return mapWithConcurrency(indexes, 4, async (index) => {
    const category = categoryNames[index % categoryNames.length];
    const brand = pickRandom(brandsByCategory[category]);
    const productNumber = index + 1;
    const imageCount = randomImageCount();

    const images = [];
    const imagePublicIds = [];
    for (let imageNumber = 1; imageNumber <= imageCount; imageNumber += 1) {
      const uploadedImage = await uploadImageToCloudinary(
        productNumber,
        imageNumber,
      );
      images.push(uploadedImage.secureUrl);
      imagePublicIds.push(uploadedImage.publicId);
    }

    return {
      title: `${category} Product ${productNumber}`,
      price: randomPrice(category),
      description: `High quality ${category.toLowerCase()} item ${productNumber} by ${brand}. Great for everyday use and ideal for demo pagination.`,
      images,
      imagePublicId: imagePublicIds[0],
      category,
      brand,
      stock: Math.floor(Math.random() * 90) + 10,
    };
  });
}

async function seedProducts(totalProducts = 100) {
  await seedCategories();
  console.log("Cleaning old Cloudinary seed images...");
  await clearSeedImagesFromCloudinary();
  console.log(
    "Uploading product images to Cloudinary. This can take a few minutes...",
  );
  const products = await buildProducts(totalProducts);

  await Product.deleteMany({});
  await Product.insertMany(products);

  console.log(
    `Seeded ${products.length} products across ${categoryNames.length} categories.`,
  );
}

async function run() {
  try {
    await mongoose.connect(process.env.Mongodb_Uri, {
      dbName: process.env.Database_Name,
    });

    const totalFromArg = Number(process.argv[2]);
    const totalProducts =
      Number.isInteger(totalFromArg) && totalFromArg > 0 ? totalFromArg : 100;

    await seedProducts(totalProducts);
  } catch (error) {
    console.error("Seeding failed:", error.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

run();
