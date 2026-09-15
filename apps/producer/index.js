import express from "express";
import amqp from "amqplib";

const port = process.env.PORT || 8080;
const queue = process.env.QUEUE_NAME || "orders";
const amqpUrl = process.env.AMQP_URL || "amqp://guest:guest@localhost:5672";

const app = express();
app.use(express.json());

let channel;

async function connect() {
  const conn = await amqp.connect(amqpUrl);
  channel = await conn.createChannel();
  await channel.assertQueue(queue, { durable: true });
  console.log(`connected to ${amqpUrl}, queue=${queue}`);
}

app.post("/orders", async (req, res) => {
  const order = req.body ?? { id: Date.now(), item: "demo" };
  channel.sendToQueue(queue, Buffer.from(JSON.stringify(order)), { persistent: true });
  res.json({ published: true, order });
});

app.get("/health", (_req, res) => res.json({ ok: true }));

connect()
  .then(() => app.listen(port, () => console.log(`producer on :${port}`)))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
