# Producer bundle

HTTP **publisher** that sends orders to the queue.

## Your tasks

1. **`config.yaml`** — product namespace (usually same as data or dedicated).
2. **`values.yaml.tpl`** — env for AMQP URL, app image, route host.
3. **`Chart.yaml`** on `order-producer` — add **`depends-on-bundles: data`**.

Application source: `apps/producer/` (Node.js sample).
