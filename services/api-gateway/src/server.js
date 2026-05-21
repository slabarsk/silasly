import "dotenv/config";
import cors from "cors";
import express from "express";
import { connectMongoDB } from "./config/mongodb.js";
import { connectRabbitMQ } from "./config/rabbitmq.js";
import { connectRedis } from "./config/redis.js";
import { apiRoutes } from "./routes/index.js";

const app = express();
const port = process.env.PORT || 3000;
const frontendOrigins = (process.env.FRONTEND_ORIGIN || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
const developmentOrigins = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:3000",
  "http://127.0.0.1:3000"
];
const allowedOrigins = new Set([...frontendOrigins, ...developmentOrigins]);

function isLocalhostOrigin(origin) {
  return /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
}

app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.has(origin) || isLocalhostOrigin(origin)) {
      return callback(null, true);
    }

    return callback(null, false);
  }
}));
app.use(express.json());
app.get("/health", (req, res) => {
  res.json({ service: "api-gateway", status: "ok" });
});
app.use("/api/v1", apiRoutes);

async function start() {
  app.listen(port);

  Promise.all([connectMongoDB(), connectRedis(), connectRabbitMQ()]).catch(() => {
    process.stderr.write("API gateway dependency connection failed.\n");
  });
}

start().catch(() => {
  process.stderr.write("API gateway failed to start.\n");
  process.exit(1);
});
