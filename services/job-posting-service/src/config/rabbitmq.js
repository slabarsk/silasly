import amqp from "amqplib";

let connection;

export async function connectRabbitMQ() {
  const url = process.env.RABBITMQ_URL;

  if (!url) {
    return null;
  }

  connection = await amqp.connect(url);
  return connection;
}

export function getRabbitMQConnection() {
  return connection;
}

export async function publishJobCreated(job) {
  if (!connection) {
    return null;
  }

  const channel = await connection.createChannel();
  const queueName = "job.created";
  const data = typeof job.toObject === "function" ? job.toObject() : job;

  await channel.assertQueue(queueName, { durable: true });
  channel.sendToQueue(queueName, Buffer.from(JSON.stringify(data)), { persistent: true });
  await channel.close();

  return true;
}
