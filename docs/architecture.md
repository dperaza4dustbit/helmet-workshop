# Workshop architecture

DevConf hands-on: build a **Helmet composable-bundles installer** for a small **order pub/sub** demo on a shared OpenShift cluster.

## Runtime picture (per participant)

```text
Namespace: workshop-p01 … workshop-p22
├── User: workshop-p01 (HTPasswd / cluster IdP) — console login, namespace-scoped edit
├── Deployment/workshop-pod — oc, helm, go, node, cloned repos
└── After `order-demo deploy`:
    ├── RabbitMQ + PostgreSQL  (data bundle)
    ├── order-producer         (publisher → queue)
    └── order-consumer         (subscriber ← queue)
```

Each participant works **only in their namespace**. The workshop pod is the shell: **OpenShift Console → Pod → Terminal**.

### Credential handout (coordinator)

After setup, a small Node.js app runs in **`workshop-coordinator`**:

1. Reads `credentials.csv` (mounted from a Secret — never baked into workshop images).
2. Serves a public Route; each new browser session dequeues the next row (FIFO).
3. Persists assignment state on a PVC so slots are not handed out twice.
4. Refreshing the page returns the **same** credentials (signed session cookie).

Share **one URL** with participants; instructor credentials stay in `out/credentials.csv` only (not in the coordinator queue).

Participants receive **`edit`** in their namespace (deploy/exec pods). Instructors receive **`admin`**. By default setup also removes **`self-provisioner`** from `system:authenticated-users` so console users cannot create new projects (set `RESTRICT_SELF_PROVISIONER=0` on shared clusters if needed).

## Helmet installer (three bundles)

| Bundle     | Role | Charts (typical) |
|-----------|------|------------------|
| **data**  | Messaging + persistence | PostgreSQL, RabbitMQ |
| **producer** | HTTP API publishes orders | `order-producer` |
| **consumer** | Worker consumes orders | `order-consumer` |

**`helmet.yaml`** lists all three under `products` as `local://data`, `local://producer`, `local://consumer`.

Each bundle owns:

- `config.yaml` — product name, namespace, properties
- `values.yaml.tpl` — Helm values for charts in that bundle
- `charts/<name>/` — Helm chart + `depends-on-*` annotations

Participants complete missing pieces; see [workshop-guide.md](workshop-guide.md).

## Workshop pod image

Built from `container/Dockerfile`:

- `oc`, `helm`, `go`, `node`, `git`, `make`
- **Local COPY at image build** — `helmet-workshop` + `helmet` (auto-detected as `../helmet` sibling checkout)
- Default `WORKDIR`: `/home/workshop/helmet-workshop/order-demo`

Participants run:

```bash
make build          # embed installer tarball → order-demo CLI
order-demo config --create
# edit bundles/*/config.yaml, values.yaml.tpl, helmet.yaml
order-demo template
order-demo topology
order-demo deploy
```

## Cluster provisioning

| Script | Purpose |
|--------|---------|
| `hack/setup-workshop.sh` | Namespaces, RBAC, workshop Deployments, HTPasswd users, coordinator Route |
| `hack/cleanup-workshop.sh` | Remove workshop + `workshop-coordinator` namespaces |

Requires **cluster-admin** (or sufficient privileges) once per cluster before the session.

## Instructor vs participant

- **20** namespaces: `workshop-p01` … `workshop-p20` — **`edit`** in their namespace only
- **2** instructor namespaces: `workshop-i01`, `workshop-i02` — **`admin`** in their own namespace plus **`edit`** (default) on every participant namespace so they can monitor and help, but not see other instructors’ namespaces
- Instructor credentials are **not** handed out via the coordinator; use `out/credentials.csv`

Credentials are written to `out/credentials.csv` when HTPasswd users are created (optional; may use your org’s existing IdP instead).
