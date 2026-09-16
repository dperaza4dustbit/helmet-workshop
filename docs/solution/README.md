# Instructor reference — full solution

This directory documents the **completed** order-demo installer used as the workshop answer key.

## Bundles

| Bundle | Product | Charts | Depends on |
|--------|---------|--------|------------|
| `data` | Order Data | `order-postgres`, `order-rabbitmq` | — |
| `producer` | Order Producer | `order-producer` | `data` |
| `consumer` | Order Consumer | `order-consumer` | `data` |

## Topology

1. **Order Data** — PostgreSQL (`orders-pgsql-user` secret) and RabbitMQ (`orders-rabbitmq-user`, queue `orders`)
2. **Order Producer** — manager portal Route `rewards-managers-<namespace>.<ingress>`
3. **Order Consumer** — store portal Route `rewards-store-<namespace>.<ingress>`

Producer and consumer both reference DB/AMQP secrets created by the data bundle in the same namespace.

## Application flow

1. Manager selects one of 10 reward items and submits employee + department details.
2. Order is persisted in PostgreSQL (`pending`) and published to the `orders` queue.
3. Store employee marks the order **shipped** in the consumer portal.
4. Manager marks the order **delivered** after handing the gift to the employee.

## Deploy (from workshop pod)

```bash
cd ~/helmet-workshop/order-demo
make build
export KUBECONFIG=""
./order-demo config --create --namespace "$WORKSHOP_NAMESPACE"
./order-demo topology
./order-demo deploy
```

After deploy, read Helm NOTES for both Route URLs (manager + store portals).

## Source layout

- Node apps: `apps/producer/`, `apps/consumer/` (copied into chart `files/` at build time)
- Installer: `order-demo/installer/bundles/{data,producer,consumer}/`

When preparing the participant starting point, strip TODOs from bundle configs/charts while keeping the same directory layout.
