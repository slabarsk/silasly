import mongoose from "mongoose";

const jobPostingSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    companyName: { type: String, required: true, trim: true },
    country: { type: String, required: true, trim: true },
    city: { type: String, required: true, trim: true },
    town: { type: String, trim: true },
    workType: {
      type: String,
      required: true,
      trim: true,
      enum: ["Full-time", "Part-time", "Remote", "Hybrid", "On-site"]
    },
    positionLevel: { type: String, trim: true },
    department: { type: String, trim: true },
    description: { type: String, required: true, trim: true },
    requirements: { type: [String], default: [] },
    lastUpdatedAt: { type: Date, default: Date.now },
    applicationCount: { type: Number, default: 0, min: 0 },
    isActive: { type: Boolean, default: true },
    createdAt: { type: Date, default: Date.now }
  },
  {
    versionKey: false
  }
);

export const JobPosting = mongoose.model("JobPosting", jobPostingSchema);
