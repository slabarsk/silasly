import "dotenv/config";
import cors from "cors";
import express from "express";
import { connectMongoDB } from "./config/mongodb.js";
import { connectRabbitMQ, startJobCreatedConsumer } from "./config/rabbitmq.js";
import { connectRedis } from "./config/redis.js";
import { apiRoutes } from "./routes/index.js";
import { startScheduledAlertTask } from "./services/jobAlertProcessor.js";
import { startRelatedSearchNotificationTask } from "./services/relatedSearchProcessor.js";

const app = express();
const port = process.env.PORT || 3002;

app.use(cors());
app.use(express.json());
app.get("/health", (req, res) => {
  res.json({ service: "notification-service", status: "ok" });
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

async function start() {
  app.listen(port);

  Promise.all([connectMongoDB(), connectRedis(), connectRabbitMQ()])
    .then(async () => {
      await startJobCreatedConsumer();
      startScheduledAlertTask();
      startRelatedSearchNotificationTask();
    })
    .catch(() => {
      process.stderr.write("Notification dependency connection failed.\n");
    });
}

start().catch(() => {
  process.stderr.write("Notification service failed to start.\n");
  process.exit(1);
});
