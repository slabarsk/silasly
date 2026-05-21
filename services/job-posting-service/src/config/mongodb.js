import mongoose from "mongoose";

export async function connectMongoDB() {
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    return null;
  }

  return mongoose.connect(uri, {
    serverSelectionTimeoutMS: Number.parseInt(process.env.MONGODB_SERVER_SELECTION_TIMEOUT_MS, 10) || 5000
  });
}
