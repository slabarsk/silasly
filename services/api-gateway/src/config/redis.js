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
