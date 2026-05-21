import mongoose from "mongoose";

const jobApplicationSchema = new mongoose.Schema(
  {
    jobId: { type: mongoose.Schema.Types.ObjectId, ref: "JobPosting", required: true },
    userId: { type: String, required: true, trim: true },
    fullName: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    appliedAt: { type: Date, default: Date.now }
  },
  {
    versionKey: false
  }
);

jobApplicationSchema.index({ jobId: 1, userId: 1 }, { unique: true });

export const JobApplication = mongoose.model("JobApplication", jobApplicationSchema);
