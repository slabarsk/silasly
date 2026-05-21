import { Router } from "express";
import mongoose from "mongoose";
import { requireRole, verifyFirebaseToken } from "../config/firebase.js";
import { enqueueNotificationJob } from "../config/notification.js";
import { publishJobCreated } from "../config/rabbitmq.js";
import { cacheJob, formatJobDetail, getCachedJob, removeCachedJob } from "../config/redis.js";
import { Company, JobApplication, JobPosting } from "../models/index.js";

export const apiRoutes = Router();

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function createSearchFilter(query) {
  const filter = { isActive: true };

  if (query.position) {
    filter.title = { $regex: escapeRegExp(query.position), $options: "i" };
  }

  for (const field of ["city", "country", "town", "workType"]) {
    if (query[field]) {
      filter[field] = { $regex: `^${escapeRegExp(query[field])}$`, $options: "i" };
    }
  }

  return filter;
}

function verifyInternalRequest(req, res, next) {
  const expectedKey = process.env.INTERNAL_SERVICE_KEY;
  const requestKey = req.headers["x-internal-service-key"];

  if (!expectedKey || requestKey !== expectedKey) {
    return res.status(401).json({ message: "Unauthorized request" });
  }

  return next();
}

function uniqueValues(values) {
  const seen = new Set();
  const items = [];

  for (const value of values) {
    if (typeof value !== "string" || !value.trim()) {
      continue;
    }

    const item = value.trim();
    const key = item.normalize("NFC").toLocaleLowerCase("tr-TR");

    if (!seen.has(key)) {
      seen.add(key);
      items.push(item);
    }
  }

  return items;
}

function requireDatabaseConnection(req, res, next) {
  if (mongoose.connection.readyState !== 1) {
    return res.status(503).json({ message: "Database connection is not ready" });
  }

  return next();
}

function getPagination(query, defaultLimit = 10) {
  const page = Math.max(Number.parseInt(query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(Number.parseInt(query.limit, 10) || defaultLimit, 1), 50);

  return {
    page,
    limit,
    skip: (page - 1) * limit
  };
}

async function readCachedJob(jobId) {
  try {
    return await getCachedJob(jobId);
  } catch {
    return null;
  }
}

async function writeCachedJob(job) {
  try {
    await cacheJob(job);
  } catch {
    return null;
  }

  return true;
}

async function deleteCachedJob(jobId) {
  try {
    await removeCachedJob(jobId);
  } catch {
    return null;
  }

  return true;
}

apiRoutes.get("/health", (req, res) => {
  res.json({ service: "job-posting-service", status: "ok" });
});

apiRoutes.use(requireDatabaseConnection);

apiRoutes.get("/jobs", async (req, res, next) => {
  try {
    const page = Math.max(Number.parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(Number.parseInt(req.query.limit, 10) || 10, 1), 50);
    const skip = (page - 1) * limit;
    const filter = createSearchFilter(req.query);
    const [items, total] = await Promise.all([
      JobPosting.find(filter).sort({ lastUpdatedAt: -1, createdAt: -1 }).skip(skip).limit(limit),
      JobPosting.countDocuments(filter)
    ]);

    res.json({
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    });
  } catch (error) {
    next(error);
  }
});

apiRoutes.get("/jobs/autocomplete/positions", async (req, res, next) => {
  try {
    const search = req.query.search?.trim() || "";
    const filter = { isActive: true };

    if (search) {
      filter.title = { $regex: escapeRegExp(search), $options: "i" };
    }

    const values = await JobPosting.distinct("title", filter);
    const items = uniqueValues(values)
      .sort((a, b) => a.localeCompare(b, "tr-TR"))
      .slice(0, 8);

    res.json({ items });
  } catch (error) {
    next(error);
  }
});

apiRoutes.get("/jobs/autocomplete/cities", async (req, res, next) => {
  try {
    const search = req.query.search?.trim() || "";
    const filter = { isActive: true };

    if (search) {
      filter.city = { $regex: escapeRegExp(search), $options: "i" };
    }

    const values = await JobPosting.distinct("city", filter);
    const items = uniqueValues(values)
      .sort((a, b) => a.localeCompare(b, "tr-TR"))
      .slice(0, 8);

    res.json({ items });
  } catch (error) {
    next(error);
  }
});

apiRoutes.get("/internal/jobs/related-search", verifyInternalRequest, async (req, res, next) => {
  try {
    const limit = Math.min(Math.max(Number.parseInt(req.query.limit, 10) || 5, 1), 20);
    const filter = { isActive: true };

    if (req.query.position) {
      filter.title = { $regex: escapeRegExp(req.query.position), $options: "i" };
    }

    for (const field of ["city", "country"]) {
      if (req.query[field]) {
        filter[field] = { $regex: `^${escapeRegExp(req.query[field])}$`, $options: "i" };
      }
    }

    const items = await JobPosting.find(filter).sort({ lastUpdatedAt: -1 }).limit(limit);

    return res.json({ items: items.map(formatJobDetail) });
  } catch (error) {
    return next(error);
  }
});

apiRoutes.post(
  "/jobs",
  verifyFirebaseToken,
  requireRole(["admin", "company"]),
  async (req, res, next) => {
    try {
      const job = await JobPosting.create({
        ...req.body,
        lastUpdatedAt: new Date()
      });

      await writeCachedJob(job);
      await publishJobCreated(job);
      await enqueueNotificationJob(job);

      res.status(201).json({ job });
    } catch (error) {
      next(error);
    }
  }
);

apiRoutes.get("/jobs/:id", async (req, res, next) => {
  try {
    const cachedJob = await readCachedJob(req.params.id);

    if (cachedJob) {
      if (cachedJob.isActive === false) {
        await deleteCachedJob(req.params.id);
        return res.status(404).json({ message: "Job not found" });
      }

      return res.json({ job: cachedJob });
    }

    const job = await JobPosting.findOne({ _id: req.params.id, isActive: true });

    if (!job) {
      return res.status(404).json({ message: "Job not found" });
    }

    await writeCachedJob(job);
    return res.json({ job: formatJobDetail(job) });
  } catch (error) {
    return next(error);
  }
});

apiRoutes.get("/jobs/:id/related", async (req, res, next) => {
  try {
    const job = await JobPosting.findOne({ _id: req.params.id, isActive: true });

    if (!job) {
      return res.status(404).json({ message: "Job not found" });
    }

    const titleWords = job.title
      .split(/\s+/)
      .map((word) => word.trim())
      .filter((word) => word.length > 2)
      .slice(0, 3);
    const titlePattern = titleWords.length > 0 ? titleWords.map(escapeRegExp).join("|") : escapeRegExp(job.title);
    const baseFilter = { _id: { $ne: job._id }, isActive: true, city: job.city };

    const similarJobs = await JobPosting.find({
      ...baseFilter,
      title: { $regex: titlePattern, $options: "i" }
    })
      .sort({ lastUpdatedAt: -1 })
      .limit(3);

    let relatedJobs = similarJobs;

    if (relatedJobs.length < 3) {
      const currentIds = relatedJobs.map((item) => item._id);
      const otherJobs = await JobPosting.find({
        ...baseFilter,
        _id: { $ne: job._id, $nin: currentIds }
      })
        .sort({ lastUpdatedAt: -1 })
        .limit(3 - relatedJobs.length);

      relatedJobs = [...relatedJobs, ...otherJobs];
    }

    if (relatedJobs.length < 3) {
      const currentIds = relatedJobs.map((item) => item._id);
      const additionalJobs = await JobPosting.find({
        _id: { $ne: job._id, $nin: currentIds },
        isActive: true
      })
        .sort({ lastUpdatedAt: -1 })
        .limit(3 - relatedJobs.length);

      relatedJobs = [...relatedJobs, ...additionalJobs];
    }

    return res.json({ items: relatedJobs.map(formatJobDetail) });
  } catch (error) {
    return next(error);
  }
});

apiRoutes.get("/jobs/:id/application-status", verifyFirebaseToken, async (req, res, next) => {
  try {
    const job = await JobPosting.findOne({ _id: req.params.id, isActive: true });

    if (!job) {
      return res.status(404).json({ message: "Job not found" });
    }

    const application = await JobApplication.findOne({
      jobId: job._id,
      userId: req.user.uid
    });

    return res.json({
      applied: Boolean(application),
      applicationId: application?._id || null,
      appliedAt: application?.appliedAt || null
    });
  } catch (error) {
    return next(error);
  }
});

apiRoutes.post("/jobs/:id/apply", verifyFirebaseToken, async (req, res, next) => {
  try {
    const job = await JobPosting.findOne({ _id: req.params.id, isActive: true });

    if (!job) {
      return res.status(404).json({ message: "Job not found" });
    }

    const existingApplication = await JobApplication.findOne({
      jobId: job._id,
      userId: req.user.uid
    });

    if (existingApplication) {
      return res.status(409).json({ message: "You have already applied to this job" });
    }

    try {
      await JobApplication.create({
        jobId: job._id,
        userId: req.user.uid,
        fullName: req.body.fullName,
        email: req.body.email
      });
    } catch (error) {
      if (error.code === 11000) {
        return res.status(409).json({ message: "You have already applied to this job" });
      }

      throw error;
    }

    job.applicationCount = (job.applicationCount || 0) + 1;
    job.lastUpdatedAt = new Date();
    await job.save();
    await writeCachedJob(job);

    return res.status(201).json({ message: "Application submitted", job: formatJobDetail(job) });
  } catch (error) {
    return next(error);
  }
});

apiRoutes.put(
  "/jobs/:id",
  verifyFirebaseToken,
  requireRole(["admin", "company"]),
  async (req, res, next) => {
    try {
      const job = await JobPosting.findByIdAndUpdate(
        req.params.id,
        {
          ...req.body,
          lastUpdatedAt: new Date()
        },
        {
          new: true,
          runValidators: true
        }
      );

      if (!job) {
        return res.status(404).json({ message: "Job not found" });
      }

      await writeCachedJob(job);

      return res.json({ job });
    } catch (error) {
      return next(error);
    }
  }
);

apiRoutes.delete(
  "/jobs/:id",
  verifyFirebaseToken,
  requireRole(["admin", "company"]),
  async (req, res, next) => {
    try {
      const job = await JobPosting.findByIdAndUpdate(
        req.params.id,
        {
          isActive: false,
          lastUpdatedAt: new Date()
        },
        {
          new: true,
          runValidators: true
        }
      );

      if (!job) {
        return res.status(404).json({ message: "Job not found" });
      }

      await deleteCachedJob(req.params.id);

      return res.json({ message: "Job deactivated", job: formatJobDetail(job) });
    } catch (error) {
      return next(error);
    }
  }
);

apiRoutes.get("/companies", verifyFirebaseToken, async (req, res, next) => {
  try {
    const { page, limit, skip } = getPagination(req.query);
    const [companies, total] = await Promise.all([
      Company.find().sort({ createdAt: -1 }).skip(skip).limit(limit),
      Company.countDocuments()
    ]);

    res.json({
      companies,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    });
  } catch (error) {
    next(error);
  }
});

apiRoutes.get(
  "/applications",
  verifyFirebaseToken,
  requireRole(["admin", "company"]),
  async (req, res, next) => {
    try {
      const { page, limit, skip } = getPagination(req.query);
      const [applications, total] = await Promise.all([
        JobApplication.find()
          .populate("jobId", "title companyName city town country workType")
          .sort({ appliedAt: -1 })
          .skip(skip)
          .limit(limit),
        JobApplication.countDocuments()
      ]);

      res.json({
        applications,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      });
    } catch (error) {
      next(error);
    }
  }
);
