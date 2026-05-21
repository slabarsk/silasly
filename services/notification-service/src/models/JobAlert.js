import mongoose from "mongoose";

const jobAlertSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, trim: true },
    keywords: { type: [String], default: [] },
    country: { type: String, trim: true },
    city: { type: String, trim: true },
    town: { type: String, trim: true },
    workType: { type: String, trim: true },
    isActive: { type: Boolean, default: true },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
  },
  {
    versionKey: false
  }
);

export const JobAlert = mongoose.model("JobAlert", jobAlertSchema);
