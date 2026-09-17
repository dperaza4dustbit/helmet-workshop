# Data bundle

Deploy **PostgreSQL** and **RabbitMQ** for the order demo.

## Your tasks

1. Complete **`config.yaml`** — product name, namespace, properties (URLs, credentials placeholders).
2. Complete **`values.yaml.tpl`** — chart values for `order-postgres` and `order-rabbitmq`.
3. Ensure charts under **`charts/`** have correct **`Chart.yaml`** annotations.

Charts in this bundle should **not** depend on producer/consumer (data layer is shared infrastructure).
