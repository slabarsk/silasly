import mongoose from "mongoose";
import { getSearchHistoryConnection } from "../config/mongodb.js";

const jobSearchHistorySchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, trim: true },
    position: { type: String, trim: true },
    city: { type: String, trim: true },
    country: { type: String, trim: true },
    createdAt: { type: Date, default: Date.now }
  },
  {
    versionKey: false
  }
);

export function getJobSearchHistoryModel() {
  const connection = getSearchHistoryConnection();
  return connection.models.JobSearchHistory || connection.model("JobSearchHistory", jobSearchHistorySchema);
}
