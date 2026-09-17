# Consumer bundle

**Subscriber** that reads orders from the queue and processes them (log + optional DB write).

## Your tasks

Mirror producer bundle: `config.yaml`, `values.yaml.tpl`, **`depends-on-bundles: data`**.

Application source: `apps/consumer/`.
