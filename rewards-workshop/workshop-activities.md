# Helmet Corp Rewards Workshop — Activities

Track progress with the checkboxes below **or on this coordinator page** (expand
**Lab activities** when your instructor tells you; keep this browser tab open
alongside the OpenShift terminal).

When every box is checked, your `rewards-workshop` installer should match the
instructor **`rewards-demo`** reference in the same pod.

Reference (do not edit during the lab): `../rewards-demo/installer/`

Your pod terminal opens in `rewards-workshop` — no directory change needed.

**Rebuild cycle:**

| You changed | Then run |
|-------------|----------|
| Anything under `installer/` (charts, `values.yaml.tpl`, `helmet.yaml`, …) | `make build` |
| A bundle `config.yaml` (product properties) | `make build` **and** `./rewards-workshop config --create --force --namespace "$WORKSHOP_NAMESPACE"` |
| Ready to check ordering | `./rewards-workshop topology` |
| Ready to roll out | `./rewards-workshop deploy` |

First `config --create` comes after your first bundle config edit (Activity 2). Use `--force` whenever you change a bundle `config.yaml` again. `values.yaml.tpl` changes only need `make build`.

---

## Phase 0 — Watch the instructor demo

- [ ] Manager portal submits thank-you orders
- [ ] Store portal fulfills orders
- [ ] Instructor shows `rewards-demo` topology and deploy output

---

## Activity 1 — Register products in `helmet.yaml`

Create `installer/helmet.yaml` listing all three bundles.

- [ ] File exists at `installer/helmet.yaml`
- [ ] `name:` is `rewards-workshop`
- [ ] `products` includes `local://data`, `local://producer`, `local://consumer`
- [ ] `make build` produces `./rewards-workshop`

<details>
<summary>Hint</summary>

Copy the structure from `../rewards-demo/installer/helmet.yaml` and change
`name` to `rewards-workshop`. Until `helmet.yaml` exists, `make build` fails
with a clear message.
</details>

---

## Activity 2 — Data product config

Edit `installer/bundles/data/config.yaml`.

- [ ] Product `name` is `Order Data`
- [ ] `queueName` is **`orders`** (not `order`)
- [ ] `databaseName` is `orders`
- [ ] `make build`
- [ ] `./rewards-workshop config --create --namespace "$WORKSHOP_NAMESPACE"` (first time — merges bundle configs into the cluster)
- [ ] `./rewards-workshop topology` — expect errors or incomplete output until values are fixed (Activity 3)

<details>
<summary>Hint</summary>

The starter file uses `queueName: order` on purpose. All bundles must share
the same queue name.
</details>

---

## Activity 3 — Data bundle values template

Complete `installer/bundles/data/values.yaml.tpl`.

- [ ] `pgsqlService.instances` enables the `orders` Postgres instance in your namespace
- [ ] `rabbitmq.enabled` is `true`
- [ ] RabbitMQ `namespace` and `queueName` come from the Order Data product
- [ ] `make build`
- [ ] `./rewards-workshop topology` lists data charts (ordering may still be wrong)

<details>
<summary>Hint</summary>

See `../rewards-demo/installer/bundles/data/values.yaml.tpl`. Use
`required` / `default` helpers and `.Installer.Products.Order_Data`.
</details>

---

## Activity 4 — Chart dependency inside the data bundle

Open `installer/bundles/data/charts/order-postgres/Chart.yaml`.

- [ ] Add annotation `helmet.redhat-appstudio.github.com/depends-on-bundle-charts: order-rabbitmq`
- [ ] `make build`
- [ ] `./rewards-workshop topology` — **rabbitmq before postgres** within the data bundle

<details>
<summary>Why</summary>

RabbitMQ must exist before Postgres in the topology so secrets and ordering are
correct within the data bundle.
</details>

---

## Activity 5 — Producer bundle config and values

- [ ] `installer/bundles/producer/config.yaml` — set `queueName: orders`
- [ ] `make build`
- [ ] `./rewards-workshop config --create --force --namespace "$WORKSHOP_NAMESPACE"`
- [ ] `installer/bundles/producer/values.yaml.tpl` — enable `orderProducer`
- [ ] Wire DB/RabbitMQ secret names and manager route hostname in the same file
- [ ] `make build`

<details>
<summary>Hint</summary>

Reference `../rewards-demo/installer/bundles/producer/`. Route host pattern:
`rewards-managers-{{ $ns }}.{{ ingress }}`.
</details>

---

## Activity 6 — Consumer bundle config and values

- [ ] `installer/bundles/consumer/config.yaml` — set `queueName: orders`
- [ ] `make build`
- [ ] `./rewards-workshop config --create --force --namespace "$WORKSHOP_NAMESPACE"`
- [ ] `installer/bundles/consumer/values.yaml.tpl` — enable `orderConsumer`
- [ ] Wire DB/RabbitMQ secret names in the same file
- [ ] Wire **both** route hostnames (store + manager portal link)
- [ ] `make build`

<details>
<summary>Hint</summary>

Reference `../rewards-demo/installer/bundles/consumer/`.
</details>

---

## Activity 7 — Cross-bundle dependencies

Edit producer and consumer chart metadata.

- [ ] `order-producer/Chart.yaml` — add `depends-on-bundles: data`
- [ ] `order-consumer/Chart.yaml` — add `depends-on-bundles: data`
- [ ] `make build`
- [ ] `./rewards-workshop topology` shows: rabbitmq → postgres → producer → consumer (no errors)

<details>
<summary>Expected topology</summary>

```
 1  order-rabbitmq
 2  order-postgres   (Order Data)
 3  order-producer   (Order Producer)
 4  order-consumer   (Order Consumer)
```

</details>

---

## Activity 8 — First deploy attempt

With topology clean, try a full rollout.

- [ ] `./rewards-workshop deploy` — fails on **order-rabbitmq** (template/render error)
- [ ] Note the error message (unknown field / typo) before fixing in Activity 9

<details>
<summary>Why it fails</summary>

The starter chart templates contain deliberate bugs. Helmet stops the rollout on
the first failing chart — producer and consumer are not reached yet.
</details>

---

## Activity 9 — Fix RabbitMQ chart bug

- [ ] Open `installer/bundles/data/charts/order-rabbitmq/templates/rabbitmq.yaml`
- [ ] Fix typo **`queuName` → `queueName`** (two places)
- [ ] `make build`
- [ ] `./rewards-workshop deploy` — RabbitMQ and Postgres releases deploy (consumer/producer may still be pending)

<details>
<summary>Hint</summary>

Re-run `deploy` after each fix; Helmet upgrades charts already on the cluster.
</details>

---

## Activity 10 — Fix PostgreSQL chart secret keys

Postgres may deploy but not become Ready, blocking later charts.

- [ ] Check `oc get pods` — postgres pod failing env/secret lookup
- [ ] Open `installer/bundles/data/charts/order-postgres/templates/postgres/pgsql-service.yaml`
- [ ] Secret `stringData` key must be **`dbname`** (not `database`) to match the container env
- [ ] `make build`
- [ ] `./rewards-workshop deploy` until postgres pod is Ready

<details>
<summary>Hint</summary>

Compare with `../rewards-demo/.../pgsql-service.yaml` around the Secret
`stringData` block.
</details>

---

## Activity 11 — Full deploy and verify rewards

- [ ] `./rewards-workshop deploy` completes all four charts
- [ ] Manager portal URL works (submit a test order)
- [ ] Store portal URL works (fulfill the order)
- [ ] `./rewards-workshop topology` matches the instructor demo

---

## Done?

Compare your installer tree with the reference:

```bash
diff -ru ../rewards-demo/installer/bundles rewards-workshop/installer/bundles
# helmet.yaml name differs; bundle contents should otherwise align
```

You built the same Helmet Corp rewards system the instructor demoed — from
composable bundles, config, values templates, topology annotations, and chart
fixes.
