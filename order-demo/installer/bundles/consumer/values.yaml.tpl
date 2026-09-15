{{- $cons := required "Order Consumer product" .Installer.Products.Order_Consumer -}}
# TODO: same AMQP settings as producer; optional Postgres DSN from data bundle.

order-consumer:
  enabled: true
  namespace: {{ default .Installer.Namespace $cons.Namespace }}
  queueName: {{ default "orders" $cons.Properties.queueName }}
