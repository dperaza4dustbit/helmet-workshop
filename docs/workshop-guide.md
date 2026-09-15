# Participant guide (DevConf)

## Goal

Wire three composable bundles into one installer and deploy an order **publisher → RabbitMQ → subscriber** stack in **your** namespace.

## What is intentionally incomplete

You must fill in (at minimum):

1. **`installer/helmet.yaml`** — list all `local://` products
2. **`installer/bundles/data/config.yaml`** — product namespace and properties (DB, AMQP)
3. **`installer/bundles/data/values.yaml.tpl`** — values for PostgreSQL and RabbitMQ charts
4. **`installer/bundles/producer/`** and **`consumer/`** — same pattern
5. **Chart annotations** — `depends-on-bundles: data` on producer and consumer
6. **Root `installer/values.yaml.tpl`** — only if shared globals are needed

Hints live in `TODO` comments in the repo. Instructors have a full reference under `docs/solution/` (not distributed to participants if you prefer).

## Suggested flow

1. Open the **workshop coordinator** link from your instructor (one click → your console URL, username, password).
2. Log in to OpenShift console → your namespace → **Workloads → Pods → workshop** → **Terminal**.
2. `cd ~/order-demo` (or path from pod env).
3. Read bundle READMEs under `installer/bundles/*/README.md`.
4. `order-demo config --create` and edit YAML as needed.
5. `order-demo topology` — fix cycles / missing deps until it succeeds.
6. `order-demo deploy` — wait for Helm releases.
7. Verify: producer HTTP endpoint enqueues; consumer logs processed orders.

## Success criteria

- `order-demo topology` prints producer → data → consumer order without errors
- RabbitMQ queue receives messages from producer
- Consumer pod logs show consumed orders
- PostgreSQL holds order rows (if your charts persist there)
