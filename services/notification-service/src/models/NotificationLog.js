import mongoose from "mongoose";

const notificationLogSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, trim: true },
    jobId: { type: mongoose.Schema.Types.ObjectId, required: true },
    alertId: { type: mongoose.Schema.Types.ObjectId, ref: "JobAlert", required: true },
    title: { type: String, required: true, trim: true },
    message: { type: String, required: true, trim: true },
    sentAt: { type: Date, default: Date.now },
    readAt: { type: Date, default: null },
    type: { type: String, default: "job_alert", trim: true }
  },
  {
    versionKey: false
  }
);

notificationLogSchema.index({ jobId: 1, alertId: 1 }, { unique: true });
notificationLogSchema.index({ userId: 1, jobId: 1, type: 1 }, { unique: true });

export const NotificationLog = mongoose.model("NotificationLog", notificationLogSchema);
