{{- $prod := required "Order Producer product" .Installer.Products.Order_Producer -}}
# TODO: wire RabbitMQ connection from data bundle (Secret lookup or values from config).

order-producer:
  enabled: true
  namespace: {{ default .Installer.Namespace $prod.Namespace }}
  queueName: {{ default "orders" $prod.Properties.queueName }}
