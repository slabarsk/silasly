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
