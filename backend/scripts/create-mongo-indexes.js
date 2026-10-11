import { loadConfig } from "../config.js";
import { ensureMongoIndexes } from "../store/mongoCollections.js";

const config = loadConfig();

if (!config.mongodbUri) {
  console.error("MONGODB_URI is required to create MongoDB indexes.");
  process.exit(1);
}

const { MongoClient } = await import("mongodb");
const client = new MongoClient(config.mongodbUri);

try {
  await client.connect();
  await ensureMongoIndexes(client.db(config.mongodbDb));
  console.log(`MongoDB indexes are ready for database "${config.mongodbDb}".`);
} finally {
  await client.close();
}
