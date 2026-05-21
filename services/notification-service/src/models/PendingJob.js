import mongoose from "mongoose";

const pendingJobSchema = new mongoose.Schema(
  {
    jobId: { type: String, required: true, trim: true },
    payload: { type: Object, required: true },
    status: { type: String, default: "pending", enum: ["pending", "failed", "processed"] },
    retryCount: { type: Number, default: 0, min: 0 },
    lastError: { type: String, trim: true },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
  },
  {
    versionKey: false
  }
);

export const PendingJob = mongoose.model("PendingJob", pendingJobSchema);
