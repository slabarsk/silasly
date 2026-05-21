import "dotenv/config";
import cors from "cors";
import express from "express";
import { connectMongoDB } from "./config/mongodb.js";
import { connectRabbitMQ } from "./config/rabbitmq.js";
import { connectRedis } from "./config/redis.js";
import { apiRoutes } from "./routes/index.js";

const app = express();
const port = process.env.PORT || 3004;
const mongoRetryIntervalMs = Number.parseInt(process.env.MONGODB_RETRY_INTERVAL_MS, 10) || 15000;
let mongoRetryTimer;

app.use(cors());
app.use(express.json());
app.get("/health", (req, res) => {
  res.json({ service: "job-posting-service", status: "ok" });
});
app.use("/api/v1", apiRoutes);
app.use((error, req, res, next) => {
  if (res.headersSent) {
    return next(error);
  }

  if (error.name === "ValidationError") {
    return res.status(400).json({ message: "Please check the submitted information" });
  }

  if (error.name === "CastError") {
    return res.status(400).json({ message: "Invalid request" });
  }

  return res.status(500).json({ message: "Something went wrong" });
});

async function connectMongoWithRetry() {
  try {
    await connectMongoDB();

    if (mongoRetryTimer) {
      clearInterval(mongoRetryTimer);
      mongoRetryTimer = null;
    }
  } catch {
    process.stderr.write("Job posting MongoDB connection failed.\n");

    if (!mongoRetryTimer) {
      mongoRetryTimer = setInterval(connectMongoWithRetry, mongoRetryIntervalMs);
    }
  }
}

async function start() {
  app.listen(port);

  connectMongoWithRetry();
  Promise.all([connectRedis(), connectRabbitMQ()]).catch(() => {
    process.stderr.write("Job posting dependency connection failed.\n");
  });
}

start().catch(() => {
  process.stderr.write("Job posting service failed to start.\n");
  process.exit(1);
});
