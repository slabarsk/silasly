import cron from "node-cron";
import { JobAlert, NotificationLog, PendingJob } from "../models/index.js";

function normalize(value) {
  return String(value || "").trim().toLocaleLowerCase("tr-TR");
}

function fieldMatches(alertValue, jobValue) {
  if (!alertValue) {
    return true;
  }

  return normalize(alertValue) === normalize(jobValue);
}

function keywordsMatch(keywords, job) {
  if (!keywords || keywords.length === 0) {
    return true;
  }

  const text = normalize(`${job.title || ""} ${job.description || ""} ${job.department || ""}`);
  return keywords.some((keyword) => text.includes(normalize(keyword)));
}

function matchesAlert(alert, job) {
  return (
    keywordsMatch(alert.keywords, job) &&
    fieldMatches(alert.country, job.country) &&
    fieldMatches(alert.city, job.city) &&
    fieldMatches(alert.town, job.town) &&
    fieldMatches(alert.workType, job.workType)
  );
}

function getJobId(job) {
  return String(job?._id || job?.jobId || "");
}

export async function savePendingJob(job, error = null) {
  const jobId = getJobId(job);

  if (!jobId) {
    return null;
  }

  return PendingJob.findOneAndUpdate(
    { jobId },
    {
      $set: {
        payload: job,
        status: error ? "failed" : "pending",
        lastError: error ? "Job notification processing failed." : "",
        updatedAt: new Date()
      },
      $inc: { retryCount: error ? 1 : 0 },
      $setOnInsert: { createdAt: new Date() }
    },
    { new: true, upsert: true }
  );
}

export async function processJobForAlerts(job) {
  if (!getJobId(job) || job.isActive === false) {
    return 0;
  }

  const alerts = await JobAlert.find({ isActive: true });
  let createdCount = 0;

  for (const alert of alerts) {
    if (!matchesAlert(alert, job)) {
      continue;
    }

    try {
      await NotificationLog.create({
        userId: alert.userId,
        jobId: getJobId(job),
        alertId: alert._id,
        title: job.title,
        message: `${job.title} ilanı iş alarmı kriterlerinle eşleşti.`,
        type: "job_alert"
      });
      createdCount += 1;
    } catch (error) {
      if (error.code !== 11000) {
        throw error;
      }
    }
  }

  return createdCount;
}

export async function processPendingJobs() {
  const pendingJobs = await PendingJob.find({ status: { $in: ["pending", "failed"] } })
    .sort({ updatedAt: 1 })
    .limit(25);
  let notificationCount = 0;
  let processedCount = 0;

  for (const pendingJob of pendingJobs) {
    try {
      notificationCount += await processJobForAlerts(pendingJob.payload);
      pendingJob.status = "processed";
      pendingJob.updatedAt = new Date();
      await pendingJob.save();
      processedCount += 1;
    } catch (error) {
      pendingJob.status = "failed";
      pendingJob.retryCount += 1;
      pendingJob.lastError = "Job notification processing failed.";
      pendingJob.updatedAt = new Date();
      await pendingJob.save();
    }
  }

  return {
    jobs: processedCount,
    notifications: notificationCount
  };
}

export function startScheduledAlertTask() {
  cron.schedule("*/5 * * * *", () => {
    processPendingJobs().catch(() => {
      process.stderr.write("Job notification processing failed.\n");
    });
  });
}
