# Instructor reference (do not hand to participants during the exercise)

Copy completed files from here into a fork or use as grading rubric.

Expected completions:

- `installer/helmet.yaml` — three `local://` products
- Each bundle `config.yaml` with namespace `workshop-pXX` or shared data namespace
- `values.yaml.tpl` wiring AMQP URL Secret and app env
- Chart `depends-on-bundles` for producer and consumer
- Helm templates deploying apps + infra (or simplified Bitnami-style charts)

Build solution CLI the same way as participants: `make -C order-demo build`.
