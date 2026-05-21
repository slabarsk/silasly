import mongoose from "mongoose";

let searchHistoryConnection;

export async function connectMongoDB() {
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    return null;
  }

  const primaryConnection = await mongoose.connect(uri);
  const searchHistoryUri = process.env.JOB_SEARCH_HISTORY_MONGODB_URI;

  if (searchHistoryUri && searchHistoryUri !== uri) {
    searchHistoryConnection = await mongoose.createConnection(searchHistoryUri).asPromise();
  } else {
    searchHistoryConnection = mongoose.connection;
  }

  return primaryConnection;
}

export function getSearchHistoryConnection() {
  return searchHistoryConnection || mongoose.connection;
}
