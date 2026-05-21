import { Router } from "express";
import { isAdmin, verifyFirebaseToken } from "../config/firebase.js";
import { JobAlert, NotificationLog } from "../models/index.js";
import { processPendingJobs, savePendingJob } from "../services/jobAlertProcessor.js";
import { processRelatedSearchNotifications } from "../services/relatedSearchProcessor.js";

export const apiRoutes = Router();

function canAccessUser(req, userId) {
  return req.user?.uid === userId || isAdmin(req.user);
}

function parseKeywords(value) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }

  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function buildAlertPayload(body) {
  return {
    keywords: parseKeywords(body.keywords),
    country: body.country,
    city: body.city,
    town: body.town,
    workType: body.workType,
    updatedAt: new Date()
  };
}

function getPagination(query) {
  const page = Math.max(Number.parseInt(query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(Number.parseInt(query.limit, 10) || 10, 1), 50);

  return {
    page,
    limit,
    skip: (page - 1) * limit
  };
}

function requireAdmin(req, res, next) {
  if (!isAdmin(req.user)) {
    return res.status(403).json({ message: "Access denied" });
  }

  return next();
}

function verifyInternalRequest(req, res, next) {
  const expectedKey = process.env.INTERNAL_SERVICE_KEY;
  const requestKey = req.headers["x-internal-service-key"];

  if (!expectedKey || requestKey !== expectedKey) {
    return res.status(401).json({ message: "Unauthorized request" });
  }

  return next();
}

apiRoutes.get("/health", (req, res) => {
  res.json({ service: "notification-service", status: "ok" });
});

apiRoutes.post("/internal/pending-jobs", verifyInternalRequest, async (req, res, next) => {
  try {
    const pendingJob = await savePendingJob(req.body.job);
    return res.status(202).json({ pendingJob });
  } catch (error) {
    return next(error);
  }
});

apiRoutes.post("/alerts", verifyFirebaseToken, async (req, res, next) => {
  try {
    const alert = await JobAlert.create({
      ...buildAlertPayload(req.body),
      userId: req.user.uid,
      isActive: true,
      createdAt: new Date()
    });

    res.status(201).json({ alert });
  } catch (error) {
    next(error);
  }
});

apiRoutes.get("/admin/alerts", verifyFirebaseToken, requireAdmin, async (req, res, next) => {
  try {
    const { page, limit, skip } = getPagination(req.query);
    const [items, total] = await Promise.all([
      JobAlert.find({ isActive: true }).sort({ createdAt: -1 }).skip(skip).limit(limit),
      JobAlert.countDocuments({ isActive: true })
    ]);

    return res.json({
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    });
  } catch (error) {
    return next(error);
  }
});

apiRoutes.get("/admin/notifications", verifyFirebaseToken, requireAdmin, async (req, res, next) => {
  try {
    const { page, limit, skip } = getPagination(req.query);
    const [items, total] = await Promise.all([
      NotificationLog.find().sort({ sentAt: -1 }).skip(skip).limit(limit),
      NotificationLog.countDocuments()
    ]);

    return res.json({
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    });
  } catch (error) {
    return next(error);
  }
});

apiRoutes.put("/alerts/:id", verifyFirebaseToken, async (req, res, next) => {
  try {
    const alert = await JobAlert.findById(req.params.id);

    if (!alert) {
      return res.status(404).json({ message: "Alert not found" });
    }

    if (!canAccessUser(req, alert.userId)) {
      return res.status(403).json({ message: "Access denied" });
    }

    Object.assign(alert, buildAlertPayload(req.body));

    if (typeof req.body.isActive === "boolean") {
      alert.isActive = req.body.isActive;
    }

    await alert.save();
    return res.json({ alert });
  } catch (error) {
    return next(error);
  }
});

apiRoutes.delete("/alerts/:id", verifyFirebaseToken, async (req, res, next) => {
  try {
    const alert = await JobAlert.findById(req.params.id);

    if (!alert) {
      return res.status(404).json({ message: "Alert not found" });
    }

    if (!canAccessUser(req, alert.userId)) {
      return res.status(403).json({ message: "Access denied" });
    }

    alert.isActive = false;
    alert.updatedAt = new Date();
    await alert.save();
    await NotificationLog.deleteMany({ alertId: alert._id, userId: alert.userId });

    return res.json({ message: "Alert disabled" });
  } catch (error) {
    return next(error);
  }
});

apiRoutes.get("/alerts/:userId", verifyFirebaseToken, async (req, res, next) => {
  try {
    if (!canAccessUser(req, req.params.userId)) {
      return res.status(403).json({ message: "Access denied" });
    }

    const { page, limit, skip } = getPagination(req.query);
    const filter = { userId: req.params.userId, isActive: true };
    const [alerts, total] = await Promise.all([
      JobAlert.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
      JobAlert.countDocuments(filter)
    ]);

    return res.json({
      alerts,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    });
  } catch (error) {
    return next(error);
  }
});

apiRoutes.post("/tasks/process-job-alerts", async (req, res, next) => {
  try {
    const result = await processPendingJobs();
    res.json(result);
  } catch (error) {
    next(error);
  }
});

apiRoutes.post("/tasks/process-related-search-notifications", async (req, res, next) => {
  try {
    const result = await processRelatedSearchNotifications();
    res.json(result);
  } catch (error) {
    next(error);
  }
});

apiRoutes.get("/notifications/:userId/unread-count", verifyFirebaseToken, async (req, res, next) => {
  try {
    if (!canAccessUser(req, req.params.userId)) {
      return res.status(403).json({ message: "Access denied" });
    }

    const count = await NotificationLog.countDocuments({
      userId: req.params.userId,
      readAt: null
    });

    return res.json({ count });
  } catch (error) {
    return next(error);
  }
});

apiRoutes.patch("/notifications/:userId/read", verifyFirebaseToken, async (req, res, next) => {
  try {
    if (!canAccessUser(req, req.params.userId)) {
      return res.status(403).json({ message: "Access denied" });
    }

    const result = await NotificationLog.updateMany(
      {
        userId: req.params.userId,
        readAt: null
      },
      {
        $set: { readAt: new Date() }
      }
    );

    return res.json({ updated: result.modifiedCount || 0 });
  } catch (error) {
    return next(error);
  }
});

apiRoutes.get("/notifications/:userId", verifyFirebaseToken, async (req, res, next) => {
  try {
    if (!canAccessUser(req, req.params.userId)) {
      return res.status(403).json({ message: "Access denied" });
    }

    const { page, limit, skip } = getPagination(req.query);
    const filter = { userId: req.params.userId };
    const [items, total] = await Promise.all([
      NotificationLog.find(filter).sort({ sentAt: -1 }).skip(skip).limit(limit),
      NotificationLog.countDocuments(filter)
    ]);

    return res.json({
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    });
  } catch (error) {
    return next(error);
  }
});
