import amqp from "amqplib";
import { processJobForAlerts, savePendingJob } from "../services/jobAlertProcessor.js";

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

export async function startJobCreatedConsumer() {
  if (!connection) {
    return null;
  }

  const channel = await connection.createChannel();
  const queueName = "job.created";

  await channel.assertQueue(queueName, { durable: true });
  await channel.consume(queueName, async (message) => {
    if (!message) {
      return;
    }

    try {
      const job = JSON.parse(message.content.toString());
      await processJobForAlerts(job);
      channel.ack(message);
    } catch (error) {
      process.stderr.write("Job notification processing failed.\n");
      try {
        const job = JSON.parse(message.content.toString());
        await savePendingJob(job, error);
      } catch {
        channel.ack(message);
        return;
      }
      channel.ack(message);
    }
  });

  return channel;
}
