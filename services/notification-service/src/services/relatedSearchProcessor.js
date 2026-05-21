import cron from "node-cron";
import { NotificationLog } from "../models/index.js";

const defaultJobSearchUrl = "http://localhost:3001";
const defaultJobPostingUrl = "http://localhost:3004";

function getJobSearchBaseUrl() {
  return process.env.JOB_SEARCH_SERVICE_URL || defaultJobSearchUrl;
}

function getJobPostingBaseUrl() {
  return process.env.JOB_POSTING_SERVICE_URL || defaultJobPostingUrl;
}

function getInternalHeaders() {
  return {
    "x-internal-service-key": process.env.INTERNAL_SERVICE_KEY || ""
  };
}

function buildQuery(params) {
  const query = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value) {
      query.set(key, value);
    }
  }

  return query.toString();
}

async function internalGet(baseUrl, path) {
  const response = await fetch(`${baseUrl}${path}`, {
    headers: getInternalHeaders()
  });

  if (!response.ok) {
    throw new Error("Internal service request failed.");
  }

  return response.json();
}

async function getRecentSearchHistory() {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const query = buildQuery({ page: "1", limit: "50", since });
  const data = await internalGet(getJobSearchBaseUrl(), `/api/v1/internal/search-history/recent?${query}`);
  return data.items || [];
}

async function getRelatedJobs(search) {
  const query = buildQuery({
    position: search.position,
    city: search.city,
    country: search.country,
    limit: "5"
  });
  const data = await internalGet(getJobPostingBaseUrl(), `/api/v1/internal/jobs/related-search?${query}`);
  return data.items || [];
}

async function createRelatedSearchNotification(search, job) {
  try {
    await NotificationLog.create({
      userId: search.userId,
      jobId: job._id,
      alertId: search._id,
      title: job.title,
      message: "Aramana uygun yeni ilanlar bulundu.",
      type: "related-search"
    });
    return 1;
  } catch (error) {
    if (error.code === 11000) {
      return 0;
    }

    throw error;
  }
}

export async function processRelatedSearchNotifications() {
  const searches = await getRecentSearchHistory();
  let notificationCount = 0;

  for (const search of searches) {
    const jobs = await getRelatedJobs(search);

    for (const job of jobs) {
      notificationCount += await createRelatedSearchNotification(search, job);
    }
  }

  return {
    searches: searches.length,
    notifications: notificationCount
  };
}

export function startRelatedSearchNotificationTask() {
  cron.schedule("*/15 * * * *", () => {
    processRelatedSearchNotifications().catch(() => {
      process.stderr.write("Related search notification processing failed.\n");
    });
  });
}
