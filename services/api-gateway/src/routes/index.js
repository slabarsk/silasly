import { Router } from "express";
import { verifyFirebaseToken } from "../config/firebase.js";

export const apiRoutes = Router();

const serviceUnavailableMessage = "Service is temporarily unavailable.";
const proxyTimeoutMs = Number.parseInt(process.env.PROXY_TIMEOUT_MS, 10) || 10000;
const healthTimeoutMs = Number.parseInt(process.env.HEALTH_TIMEOUT_MS, 10) || 5000;
const serviceTargets = {
  jobSearch: {
    name: "job-search",
    url: process.env.JOB_SEARCH_SERVICE_URL || "http://localhost:3001"
  },
  jobPosting: {
    name: "job-posting",
    url: process.env.JOB_POSTING_SERVICE_URL || "http://localhost:3004"
  },
  notification: {
    name: "notification",
    url: process.env.NOTIFICATION_SERVICE_URL || "http://localhost:3002"
  },
  agent: {
    name: "agent",
    url: process.env.AI_AGENT_SERVICE_URL || "http://localhost:3003"
  }
};

function normalizeServiceUrl(serviceUrl) {
  return serviceUrl.replace(/\/+$/, "").replace(/\/api\/v1$/, "");
}

function buildServiceUrl(serviceUrl, originalUrl) {
  return `${normalizeServiceUrl(serviceUrl)}${originalUrl}`;
}

function copyRequestHeaders(req) {
  const headers = { ...req.headers };
  delete headers.host;
  delete headers.connection;
  delete headers["content-length"];

  return headers;
}

async function proxyRequest(req, res, serviceUrl) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), proxyTimeoutMs);

  try {
    const init = {
      method: req.method,
      headers: copyRequestHeaders(req),
      signal: controller.signal
    };

    if (!["GET", "HEAD"].includes(req.method)) {
      init.body = JSON.stringify(req.body || {});
      init.headers["content-type"] = init.headers["content-type"] || "application/json";
    }

    const response = await fetch(buildServiceUrl(serviceUrl, req.originalUrl), init);

    if (response.status >= 500) {
      return res.status(response.status).json({ message: serviceUnavailableMessage });
    }

    const contentType = response.headers.get("content-type") || "";

    if (contentType.includes("application/json")) {
      const data = await response.json().catch(() => ({}));
      return res.status(response.status).json(data);
    }

    const text = await response.text();
    return res.status(response.status).send(text);
  } catch {
    return res.status(503).json({ message: serviceUnavailableMessage });
  } finally {
    clearTimeout(timeout);
  }
}

async function checkServiceHealth(service) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), healthTimeoutMs);

  try {
    const response = await fetch(`${normalizeServiceUrl(service.url)}/health`, {
      signal: controller.signal
    });

    if (!response.ok) {
      return { service: service.name, status: "unavailable" };
    }

    return { service: service.name, status: "ok" };
  } catch {
    return { service: service.name, status: "unavailable" };
  } finally {
    clearTimeout(timeout);
  }
}

apiRoutes.get("/health", (req, res) => {
  res.json({ service: "api-gateway", status: "ok" });
});

apiRoutes.get("/health/services", async (req, res) => {
  const services = await Promise.all(Object.values(serviceTargets).map(checkServiceHealth));
  res.json({ services });
});

apiRoutes.get("/me", verifyFirebaseToken, (req, res) => {
  res.json({ user: req.user });
});

apiRoutes.use("/jobs", (req, res) => proxyRequest(req, res, serviceTargets.jobPosting.url));
apiRoutes.use("/companies", (req, res) => proxyRequest(req, res, serviceTargets.jobPosting.url));
apiRoutes.use("/applications", (req, res) => proxyRequest(req, res, serviceTargets.jobPosting.url));
apiRoutes.use("/search-history", (req, res) => proxyRequest(req, res, serviceTargets.jobSearch.url));
apiRoutes.use("/internal/search-history", (req, res) => proxyRequest(req, res, serviceTargets.jobSearch.url));
apiRoutes.use("/internal/jobs", (req, res) => proxyRequest(req, res, serviceTargets.jobPosting.url));
apiRoutes.use("/alerts", (req, res) => proxyRequest(req, res, serviceTargets.notification.url));
apiRoutes.use("/notifications", (req, res) => proxyRequest(req, res, serviceTargets.notification.url));
apiRoutes.use("/admin/alerts", (req, res) => proxyRequest(req, res, serviceTargets.notification.url));
apiRoutes.use("/admin/notifications", (req, res) => proxyRequest(req, res, serviceTargets.notification.url));
apiRoutes.use("/tasks", (req, res) => proxyRequest(req, res, serviceTargets.notification.url));
apiRoutes.use("/agent", (req, res) => proxyRequest(req, res, serviceTargets.agent.url));
