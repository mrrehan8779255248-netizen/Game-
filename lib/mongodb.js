import { MongoClient } from "mongodb";

const uri = process.env.MONGODB_URI;
const options = {
  // Vercel runs many short-lived instances; reuse warm connections and keep initial pools small.
  maxPoolSize: 5,
  minPoolSize: 0,
  serverSelectionTimeoutMS: 5000
};

let clientPromise;

if (!uri) {
  clientPromise = null;
} else {
  if (process.env.NODE_ENV !== "production") {
    if (!global._islandArenaMongoClientPromise) {
      const client = new MongoClient(uri, options);
      global._islandArenaMongoClientPromise = client.connect();
    }
    clientPromise = global._islandArenaMongoClientPromise;
  } else {
    const client = new MongoClient(uri, options);
    clientPromise = client.connect();
  }
}

export async function getGameDatabase() {
  if (!clientPromise) {
    throw new Error("MongoDB is not configured. Set MONGODB_URI in the server environment.");
  }
  const client = await clientPromise;
  return client.db(process.env.MONGODB_DB || "islandarena");
}
