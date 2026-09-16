import express from "express";
import pg from "pg";
import amqp from "amqplib";
import path from "path";
import { fileURLToPath } from "url";
import { CATALOG, DEPARTMENTS, STATUS_LABELS } from "./data.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT || 8080);
const queueName = process.env.QUEUE_NAME || "orders";

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

let pool;
let channel;

function pgConfig() {
  return {
    host: process.env.PGHOST,
    port: Number(process.env.PGPORT || 5432),
    user: process.env.PGUSER,
    password: process.env.PGPASSWORD,
    database: process.env.PGDATABASE,
  };
}

async function ensureSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS orders (
      order_id SERIAL PRIMARY KEY,
      employee_name VARCHAR(255) NOT NULL,
      employee_id VARCHAR(64) NOT NULL,
      department_name VARCHAR(255) NOT NULL,
      department_id VARCHAR(64) NOT NULL,
      item_id VARCHAR(64) NOT NULL,
      item_name VARCHAR(255) NOT NULL,
      order_status VARCHAR(32) NOT NULL DEFAULT 'pending',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

async function connectMessaging() {
  const amqpUrl = process.env.AMQP_URL;
  if (!amqpUrl) {
    throw new Error("AMQP_URL is required");
  }
  const conn = await amqp.connect(amqpUrl);
  channel = await conn.createChannel();
  await channel.assertQueue(queueName, { durable: true });
}

function rowToOrder(row) {
  return {
    orderId: row.order_id,
    employeeName: row.employee_name,
    employeeId: row.employee_id,
    departmentName: row.department_name,
    departmentId: row.department_id,
    itemId: row.item_id,
    itemName: row.item_name,
    orderStatus: row.order_status,
    statusLabel: STATUS_LABELS[row.order_status] || row.order_status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

app.get("/health", (_req, res) => res.json({ ok: true, role: "producer" }));

app.get("/api/catalog", (_req, res) => res.json(CATALOG));

app.get("/api/departments", (_req, res) => res.json(DEPARTMENTS));

app.get("/api/orders", async (_req, res, next) => {
  try {
    const result = await pool.query(
      "SELECT * FROM orders ORDER BY created_at DESC LIMIT 100"
    );
    res.json(result.rows.map(rowToOrder));
  } catch (err) {
    next(err);
  }
});

app.post("/api/orders", async (req, res, next) => {
  try {
    const { itemId, employeeName, employeeId, departmentId } = req.body ?? {};
    const item = CATALOG.find((entry) => entry.id === itemId);
    const department = DEPARTMENTS.find((entry) => entry.id === departmentId);

    if (!item || !department || !employeeName?.trim() || !employeeId?.trim()) {
      return res.status(400).json({ error: "Invalid order payload" });
    }

    const insert = await pool.query(
      `INSERT INTO orders
        (employee_name, employee_id, department_name, department_id, item_id, item_name, order_status)
       VALUES ($1, $2, $3, $4, $5, $6, 'pending')
       RETURNING *`,
      [
        employeeName.trim(),
        employeeId.trim(),
        department.name,
        department.id,
        item.id,
        item.name,
      ]
    );

    const order = rowToOrder(insert.rows[0]);
    channel.sendToQueue(queueName, Buffer.from(JSON.stringify(order)), {
      persistent: true,
    });

    res.status(201).json(order);
  } catch (err) {
    next(err);
  }
});

app.patch("/api/orders/:id/delivered", async (req, res, next) => {
  try {
    const orderId = Number(req.params.id);
    const result = await pool.query(
      `UPDATE orders
       SET order_status = 'delivered', updated_at = NOW()
       WHERE order_id = $1 AND order_status = 'shipped'
       RETURNING *`,
      [orderId]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({
        error: "Order not found or not yet shipped by the corp store",
      });
    }
    res.json(rowToOrder(result.rows[0]));
  } catch (err) {
    next(err);
  }
});

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
});

async function main() {
  pool = new pg.Pool(pgConfig());
  await ensureSchema();
  await connectMessaging();
  app.listen(port, () => {
    console.log(`Helmet Corp manager portal listening on :${port}`);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
