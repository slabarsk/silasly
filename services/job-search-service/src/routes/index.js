import { Router } from "express";
import { verifyFirebaseToken } from "../config/firebase.js";
import { getJobSearchHistoryModel } from "../models/index.js";

export const apiRoutes = Router();

function verifyInternalRequest(req, res, next) {
  const expectedKey = process.env.INTERNAL_SERVICE_KEY;
  const requestKey = req.headers["x-internal-service-key"];

  if (!expectedKey || requestKey !== expectedKey) {
    return res.status(401).json({ message: "Unauthorized request" });
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

apiRoutes.get("/health", (req, res) => {
  res.json({ service: "job-search-service", status: "ok" });
});

apiRoutes.get("/internal/search-history/recent", verifyInternalRequest, async (req, res, next) => {
  try {
    const JobSearchHistory = getJobSearchHistoryModel();
    const { page, limit, skip } = getPagination(req.query);
    const filter = {};

    if (req.query.since) {
      filter.createdAt = { $gte: new Date(req.query.since) };
    }

    const [items, total] = await Promise.all([
      JobSearchHistory.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
      JobSearchHistory.countDocuments(filter)
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

apiRoutes.post("/search-history", verifyFirebaseToken, async (req, res, next) => {
  try {
    const JobSearchHistory = getJobSearchHistoryModel();
    const history = await JobSearchHistory.create({
      userId: req.user.uid,
      position: req.body.position,
      city: req.body.city,
      country: req.body.country
    });

    return res.status(201).json({ history });
  } catch (error) {
    return next(error);
  }
});

apiRoutes.get("/search-history/:userId", verifyFirebaseToken, async (req, res, next) => {
  try {
    const JobSearchHistory = getJobSearchHistoryModel();
    const roles = Array.isArray(req.user?.roles) ? req.user.roles : [req.user?.role];
    const canRead = req.user.uid === req.params.userId || roles.includes("admin") || req.user?.admin === true;

    if (!canRead) {
      return res.status(403).json({ message: "Access denied" });
    }

    const { page, limit, skip } = getPagination(req.query, 5);
    const filter = { userId: req.params.userId };
    const [history, total] = await Promise.all([
      JobSearchHistory.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
      JobSearchHistory.countDocuments(filter)
    ]);

    return res.json({
      history,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    });
  } catch (error) {
    return next(error);
  }
});
