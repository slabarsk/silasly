import mongoose from "mongoose";

export async function connectMongoDB() {
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    return null;
  }

  return mongoose.connect(uri);
}
