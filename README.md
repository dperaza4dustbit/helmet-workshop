# Helmet composable bundles — DevConf workshop

Hands-on: **22 isolated namespaces** (20 participants + 2 instructors), each with a **workshop pod** (oc, helm, go, Node, Helmet @ `composable_bundles`). Participants complete an **order-demo** installer with three bundles:

| Bundle | Purpose |
|--------|---------|
| **data** | PostgreSQL + RabbitMQ |
| **producer** | Publishes orders to the queue |
| **consumer** | Subscribes and processes orders |

## Repository layout

```text
helmet-workshop/
├── apps/                 # Node.js producer & consumer (reference impl)
├── coordinator/          # FIFO web app: hands out console credentials
├── container/            # Workshop pod + coordinator image builds
├── docs/                 # Architecture, participant guide, instructor solution
├── hack/                 # setup-workshop.sh, cleanup-workshop.sh
└── order-demo/           # Helmet installer (full solution; workshop will start from a stripped copy)
    ├── main.go
    └── installer/
        ├── helmet.yaml   # Lists data, producer, consumer bundles
        └── bundles/{data,producer,consumer}/
```

## Before the session (instructors)

Copy and edit env once, then source it for **build** and **setup**:

```bash
cp hack/workshop.env.example hack/workshop.env   # gitignored
# edit hack/workshop.env
set -a && source hack/workshop.env && set +a
```

Example `hack/workshop.env`:

```bash
export WORKSHOP_IMAGE=quay.io/tsscdavp/helmet-workshop:dev
export HELMET_BRANCH=composable_bundles
export PLATFORM=linux/amd64
export PARTICIPANT_COUNT=20
export INSTRUCTOR_COUNT=2
# HELMET_DIR only if Helmet is not ../helmet (auto-detected by default)
```

1. **Build & push** both images (requires `podman login quay.io`; `DOCKER_BUILDKIT` is set by the script):

   ```bash
   ./container/build.sh
   ```

   Builds and pushes **workshop** + **coordinator** (`quay.io/.../helmet-workshop-coordinator:dev` derived from `WORKSHOP_IMAGE`). Local-only: `./container/build.sh --no-push`

2. **Provision namespaces** (requires `oc login` as cluster-admin):

   ```bash
   ./hack/setup-workshop.sh
   ```

   Uses the same `WORKSHOP_IMAGE` from your env. Coordinator URL is printed at the end; instructor backup: `out/credentials.csv`.

3. Optionally use `--skip-htpasswd` (Keycloak-only) or `--skip-coordinator`.

4. **Teardown**:

   ```bash
   ./hack/setup-workshop.sh --dry-run   # preview
   ./hack/cleanup-workshop.sh
   ```

## Participant flow

See [docs/workshop-guide.md](docs/workshop-guide.md) and bundle READMEs under `order-demo/installer/bundles/*/`.

Console → namespace → **workshop** pod terminal:

```bash
cd ~/helmet-workshop/order-demo   # or: cd "$ORDER_DEMO_HOME"
export KUBECONFIG=""              # in-cluster auth via workshop ServiceAccount
make build
./order-demo config --create --namespace "$WORKSHOP_NAMESPACE"
# edit helmet.yaml, bundles/*/config.yaml, values.yaml.tpl
./order-demo topology
./order-demo deploy
```

## Local development (outside the cluster)

Helmet is **not** selected inside the workshop pod. You choose the branch when building the **container image**:

```bash
cd ../helmet && git checkout "${HELMET_BRANCH:-composable_bundles}"
cd ../helmet-workshop/order-demo && make deps
HELMET_DIR=/path/to/helmet HELMET_BRANCH=composable_bundles WORKSHOP_IMAGE=... ./container/build.sh
```

Inside the pod, `order-demo/go.mod` uses `replace ... => ../../helmet` (the tree copied into the image at build time).

Requires sibling **`helmet`** (branch set via **`HELMET_BRANCH`** when building the image):

```bash
git clone -b composable_bundles https://github.com/redhat-appstudio/helmet.git ../helmet
# or: HELMET_BRANCH=your-branch HELMET_CHECKOUT=1 ./container/build.sh
cd order-demo && make deps && make build
```

## Next steps for instructors

- [ ] Fill `docs/solution/` with a working installer (keep private until after the lab)
- [ ] Replace stub Helm charts with minimal but working Postgres/RabbitMQ/app Deployments
- [ ] Add slide deck + timing (suggest 90–120 min)
- [ ] Pin image digest on Quay for reproducibility (Helmet branch + workshop git tag at build time)
- [ ] Test `setup-workshop.sh` on your DevConf cluster quota (22 namespaces × pod resources)

Architecture details: [docs/architecture.md](docs/architecture.md).
