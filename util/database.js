const { MongoClient } = require("mongodb");
require("dotenv").config();

let _db;
const db_name = process.env.Database_Name;
const uri = process.env.MONGODB_URI;
const client = new MongoClient(uri);

async function connectToDB() {
  if (_db) {
    return _db;
  }

  if (!uri) {
    throw new Error("Missing MONGODB_URI in .env");
  }

  if (!db_name) {
    throw new Error("Missing Database_Name in .env");
  }

  try {
    await client.connect();
    _db = client.db(db_name);
    return _db;
  } catch (err) {
    console.error("Failed to connect to database", err);
    throw err;
  }
}

function getDB() {
  if (!_db) {
    throw new Error("Database not connected. Call connectToDB() first.");
  }
  return _db;
}

module.exports = {
  connectToDB,
  getDB,
};
