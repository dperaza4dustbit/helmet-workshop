#!/usr/bin/env bash
# Apply all workshop-activities fixes to rewards-workshop and diff bundles vs rewards-demo.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
WORK="${ROOT}/.validate-workshop"
DEMO="${ROOT}/rewards-demo/installer"
WORKSHOP_SRC="${ROOT}/rewards-workshop"

rm -rf "$WORK"
cp -R "$WORKSHOP_SRC" "$WORK"
INST="${WORK}/installer"

# Activity 1
cp "${DEMO}/helmet.yaml" "${INST}/helmet.yaml"
sed -i '' 's/name: rewards-demo/name: rewards-workshop/' "${INST}/helmet.yaml"

# Activities 2–6: copy completed bundle configs and values from demo
for bundle in data producer consumer; do
  cp "${DEMO}/bundles/${bundle}/config.yaml" "${INST}/bundles/${bundle}/config.yaml"
  cp "${DEMO}/bundles/${bundle}/values.yaml.tpl" "${INST}/bundles/${bundle}/values.yaml.tpl"
done

# Activity 4 & 7: dependency annotations from demo charts
for chart in \
  data/charts/order-postgres/Chart.yaml \
  producer/charts/order-producer/Chart.yaml \
  consumer/charts/order-consumer/Chart.yaml; do
  cp "${DEMO}/bundles/${chart}" "${INST}/bundles/${chart}"
done

# Activities 9 & 10: fix deliberate chart bugs
cp "${DEMO}/bundles/data/charts/order-rabbitmq/templates/rabbitmq.yaml" \
  "${INST}/bundles/data/charts/order-rabbitmq/templates/rabbitmq.yaml"
cp "${DEMO}/bundles/data/charts/order-postgres/templates/postgres/pgsql-service.yaml" \
  "${INST}/bundles/data/charts/order-postgres/templates/postgres/pgsql-service.yaml"

DEMO_NORM="${WORK}/demo-bundles"
cp -R "${DEMO}/bundles" "$DEMO_NORM"
find "$DEMO_NORM" "${INST}/bundles" -type f -exec sed -i '' 's/rewards-demo/rewards-workshop/g' {} + 2>/dev/null || \
  find "$DEMO_NORM" "${INST}/bundles" -type f -exec sed -i '' 's/rewards-demo/rewards-workshop/g' {} +

echo "# Diff bundles/ (ignoring project name in part-of labels)"
if diff -ru "$DEMO_NORM" "${INST}/bundles"; then
  echo "OK: rewards-workshop bundles match rewards-demo after all activities."
  rm -rf "$WORK"
  exit 0
fi

echo "FAIL: bundle trees differ — review activities or demo reference." >&2
exit 1
