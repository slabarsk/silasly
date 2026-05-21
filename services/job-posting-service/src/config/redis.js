import { createClient } from "redis";

let client;

export async function connectRedis() {
  const url = process.env.REDIS_URL;

  if (!url) {
    return null;
  }

  client = createClient({ url });
  client.on("error", () => {});
  await client.connect();
  return client;
}

export function getRedisClient() {
  return client;
}

export function formatJobDetail(job) {
  const data = typeof job.toObject === "function" ? job.toObject() : job;

  return {
    _id: data._id,
    title: data.title,
    companyName: data.companyName,
    country: data.country,
    city: data.city,
    town: data.town,
    workType: data.workType,
    positionLevel: data.positionLevel,
    department: data.department,
    description: data.description,
    requirements: data.requirements,
    lastUpdatedAt: data.lastUpdatedAt,
    applicationCount: data.applicationCount,
    isActive: data.isActive
  };
}

export async function cacheJob(job) {
  if (!client) {
    return null;
  }

  const data = formatJobDetail(job);
  return client.set(`jobs:${data._id}`, JSON.stringify(data));
}

export async function getCachedJob(jobId) {
  if (!client) {
    return null;
  }

  const data = await client.get(`jobs:${jobId}`);

  if (!data) {
    return null;
  }

  try {
    return JSON.parse(data);
  } catch {
    await removeCachedJob(jobId);
    return null;
  }
}

export async function removeCachedJob(jobId) {
  if (!client) {
    return null;
  }

  return client.del(`jobs:${jobId}`);
}
