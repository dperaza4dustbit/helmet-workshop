import amqp from "amqplib";

const queue = process.env.QUEUE_NAME || "orders";
const amqpUrl = process.env.AMQP_URL || "amqp://guest:guest@localhost:5672";

async function main() {
  const conn = await amqp.connect(amqpUrl);
  const ch = await conn.createChannel();
  await ch.assertQueue(queue, { durable: true });
  console.log(`consumer listening on ${queue}`);

  ch.consume(queue, (msg) => {
    if (!msg) return;
    const body = msg.content.toString();
    console.log("processed order:", body);
    ch.ack(msg);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
