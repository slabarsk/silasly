import "dotenv/config";
import cors from "cors";
import express from "express";
import { connectMongoDB } from "./config/mongodb.js";
import { connectRabbitMQ } from "./config/rabbitmq.js";
import { connectRedis } from "./config/redis.js";
import { apiRoutes } from "./routes/index.js";

const app = express();
const port = process.env.PORT || 3003;

app.use(cors());
app.use(express.json());
app.get("/health", (req, res) => {
  res.json({ service: "agent-service", status: "ok" });
});
app.use("/api/v1", apiRoutes);

async function start() {
  app.listen(port);

  Promise.all([connectMongoDB(), connectRedis(), connectRabbitMQ()]).catch(() => {
    process.stderr.write("Agent service dependency connection failed.\n");
  });
}

start().catch(() => {
  process.stderr.write("Agent service failed to start.\n");
  process.exit(1);
});
