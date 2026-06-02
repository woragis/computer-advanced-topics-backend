import amqp from "amqplib";
import { env } from "../config/env.js";

type LogLevel = "info" | "warn" | "error";

export type LogEvent = {
  service: "backend";
  level: LogLevel;
  event: string;
  message: string;
  metadata?: Record<string, unknown>;
};

let channel: amqp.Channel | null = null;

export async function initLogPublisher(): Promise<void> {
  if (!env.RABBITMQ_URL) {
    console.warn("Log publisher disabled: RABBITMQ_URL not set");
    return;
  }
  try {
    const conn = await amqp.connect(env.RABBITMQ_URL);
    channel = await conn.createChannel();
    await channel.assertQueue(env.LOG_QUEUE, { durable: true });
    publishLog({
      service: "backend",
      level: "info",
      event: "service.started",
      message: "Backend log publisher connected",
    });
    console.log(`Log publisher connected (queue=${env.LOG_QUEUE})`);
  } catch (e) {
    console.warn("Log publisher: could not connect to RabbitMQ", e);
  }
}

export function publishLog(event: Omit<LogEvent, "service"> & { service?: "backend" }): void {
  if (!channel) return;
  const payload: LogEvent = {
    service: "backend",
    ...event,
  };
  const body = JSON.stringify({
    ...payload,
    timestamp: new Date().toISOString(),
  });
  try {
    channel.sendToQueue(env.LOG_QUEUE, Buffer.from(body), { persistent: true });
  } catch (e) {
    console.warn("Log publisher: failed to send message", e);
  }
}
